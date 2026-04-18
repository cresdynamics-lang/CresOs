// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { enforceApprovalConflicts } from "./conflict-engine";
import { notifyAdminsInApp } from "./director-notifications";
import { DEFAULT_ORG_DAY_TZ, getZonedDateKey } from "./org-zoned-day";
import { listPlatformActionsForZonedDay } from "./director-platform-summary";

export default function directorRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Strategic dashboard view for Director (and Admin for alignment)
  router.get(
    "/dashboard",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      try {
        const [
          revenueThisPeriod,
          outstandingInvoices,
          overdueInvoicesCount,
          expensesThisPeriod,
          pendingPayouts,
          pendingExpenses,
          paymentsNext30,
          expensesNext30,
          pipelineTotal,
          pipelineWeighted,
          dealsWon,
          dealsLost,
          stalledDeals,
          wonDealsForCycle,
          activeProjects,
          projectsAtRisk,
          blockedTasksOverThreshold,
          milestonesPendingApproval,
          teamOverload,
          topFinancialRisks,
          topOperationalRisks,
          topSalesRisks,
          pendingApprovals
        ] = await Promise.all([
          // Revenue this period = confirmed payments this month
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: "confirmed",
              receivedAt: { gte: startOfMonth }
            }
          }),
          // Outstanding invoices (sent/partial/overdue)
          prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: {
              orgId,
              deletedAt: null,
              OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
            }
          }),
          prisma.invoice.count({
            where: {
              orgId,
              deletedAt: null,
              status: "overdue"
            }
          }),
          // Expenses this period
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: { in: ["approved", "paid"] },
              spentAt: { gte: startOfMonth }
            }
          }),
          // Pending payouts
          prisma.payout.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              paidAt: null
            }
          }),
          // Pending expense approvals
          prisma.expense.count({
            where: {
              orgId,
              deletedAt: null,
              status: "pending"
            }
          }),
          // Simple 30 day cash in forecast (scheduled payouts are cash out)
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: "confirmed",
              receivedAt: { gte: now, lte: next30Days }
            }
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: { in: ["approved", "paid"] },
              spentAt: { gte: now, lte: next30Days }
            }
          }),
          // Sales pipeline total (open deals)
          prisma.deal.aggregate({
            _sum: { value: true },
            where: {
              orgId,
              deletedAt: null,
              stage: { in: ["prospect", "proposal"] }
            }
          }),
          // Weighted forecast (simple mapping of stage -> probability)
          prisma.deal.findMany({
            where: {
              orgId,
              deletedAt: null,
              stage: { in: ["prospect", "proposal", "won"] }
            },
            select: { value: true, stage: true }
          }),
          prisma.deal.count({
            where: { orgId, deletedAt: null, stage: "won" }
          }),
          prisma.deal.count({
            where: { orgId, deletedAt: null, stage: "lost" }
          }),
          // Stalled deals = no activity in last 14 days
          prisma.deal.findMany({
            where: {
              orgId,
              deletedAt: null,
              stage: { in: ["prospect", "proposal"] }
            },
            select: { id: true }
          }),
          prisma.deal.findMany({
            where: {
              orgId,
              deletedAt: null,
              stage: "won",
              closeDate: { not: null }
            },
            select: { createdAt: true, closeDate: true }
          }),
          // Operational health
          prisma.project.count({
            where: {
              orgId,
              deletedAt: null,
              approvalStatus: "approved",
              status: { in: ["planned", "active"] }
            }
          }),
          prisma.project.count({
            where: {
              orgId,
              deletedAt: null,
              OR: [
                { status: "paused" },
                { status: "active", endDate: { lt: now } }
              ]
            }
          }),
          prisma.project.count({
            where: {
              orgId,
              deletedAt: null,
              approvalStatus: "pending"
            }
          }),
          prisma.client.count({
            where: {
              orgId,
              deletedAt: null
            }
          }),
          prisma.task.count({
            where: {
              orgId,
              deletedAt: null,
              status: "blocked",
              updatedAt: {
                lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
              }
            }
          }),
          prisma.milestone.count({
            where: {
              orgId,
              deletedAt: null,
              status: "pending"
            }
          }),
          prisma.task.groupBy({
            by: ["assigneeId"],
            _count: { _all: true },
            where: {
              orgId,
              deletedAt: null,
              status: { in: ["todo", "in_progress", "blocked"] }
            }
          }),
          // Risk summaries
          prisma.risk.findMany({
            where: { orgId, status: "open", type: "financial" },
            orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
            take: 5
          }),
          prisma.risk.findMany({
            where: { orgId, status: "open", type: "operational" },
            orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
            take: 5
          }),
          prisma.risk.findMany({
            where: { orgId, status: "open", type: "sales" },
            orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
            take: 5
          }),
          prisma.approval.findMany({
            where: { orgId, status: "pending" },
            orderBy: { createdAt: "asc" }
          })
        ]);

        const revenueValue =
          revenueThisPeriod._sum.amount?.toNumber() ?? 0;
        const outstandingValue =
          outstandingInvoices._sum.totalAmount?.toNumber() ?? 0;
        const expensesValue =
          expensesThisPeriod._sum.amount?.toNumber() ?? 0;
        const pendingPayoutsValue =
          pendingPayouts._sum.amount?.toNumber() ?? 0;

        const forecastIn =
          paymentsNext30._sum.amount?.toNumber() ?? 0;
        const forecastOut =
          expensesNext30._sum.amount?.toNumber() ?? 0;

        const pipelineTotalValue =
          pipelineTotal._sum.value?.toNumber() ?? 0;

        const stageWeights: Record<string, number> = {
          prospect: 0.25,
          proposal: 0.6,
          won: 1
        };

        const weightedForecast = pipelineWeighted.reduce(
          (sum, d) => {
            if (!d.value) return sum;
            const weight = stageWeights[d.stage] ?? 0;
            return sum + d.value.toNumber() * weight;
          },
          0
        );

        const totalClosed = dealsWon + dealsLost;
        const winRate = totalClosed > 0 ? dealsWon / totalClosed : 0;

        const avgDealCycleDays =
          wonDealsForCycle.length > 0
            ? wonDealsForCycle.reduce((acc, d) => {
                const close = d.closeDate as Date;
                const diffMs = close.getTime() - d.createdAt.getTime();
                return acc + diffMs / (1000 * 60 * 60 * 24);
              }, 0) / wonDealsForCycle.length
            : 0;

        const blockedThresholdCount = blockedTasksOverThreshold;

        const teamCurrentFocus = await prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            currentFocusNote: true,
            currentFocusUpdatedAt: true,
            currentFocusProject: {
              select: { id: true, name: true, status: true, approvalStatus: true }
            },
            roles: {
              select: {
                role: {
                  select: { key: true, name: true }
                }
              }
            }
          },
          orderBy: [{ name: "asc" }, { email: "asc" }]
        });

        res.json({
          financialHealth: {
            revenueThisPeriod: revenueValue,
            outstandingInvoices: outstandingValue,
            overdueInvoices: overdueInvoicesCount,
            cashIn: revenueValue,
            cashOut: expensesValue,
            netFlow: revenueValue - expensesValue,
            forecast30Day: {
              cashIn: forecastIn,
              cashOut: forecastOut,
              netFlow: forecastIn - forecastOut
            },
            pendingPayouts: pendingPayoutsValue,
            pendingExpenseApprovals: pendingExpenses
          },
          salesHealth: {
            totalPipelineValue: pipelineTotalValue,
            weightedForecast,
            winRate,
            stalledDealsCount: stalledDeals.length,
            averageDealCycleDays: avgDealCycleDays,
            highValueDealsPendingClosure: pipelineTotalValue
          },
          operationalHealth: {
            activeProjects, // approved + in planned/active
            projectsAtRisk,
            blockedTasksAboveThreshold: blockedThresholdCount,
            milestonesPendingApproval,
            teamOverload: teamOverload
          },
          approvalQueue: {
            totalPending: pendingApprovals.length
          },
          teamCurrentFocus: teamCurrentFocus.map((u) => ({
            userId: u.id,
            name: u.name,
            email: u.email,
            roleKeys: u.roles.map((r) => r.role.key),
            project: u.currentFocusProject
              ? {
                  id: u.currentFocusProject.id,
                  name: u.currentFocusProject.name,
                  status: u.currentFocusProject.status,
                  approvalStatus: u.currentFocusProject.approvalStatus
                }
              : null,
            note: u.currentFocusNote,
            updatedAt: u.currentFocusUpdatedAt
          })),
          riskSummary: {
            financial: topFinancialRisks,
            operational: topOperationalRisks,
            sales: topSalesRisks
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ error: "Failed to load director dashboard" });
      }
    }
  );

  /** Today's (org-timezone) platform action log for the director panel + nightly AI briefing source. */
  router.get(
    "/summary-actions",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const tz = DEFAULT_ORG_DAY_TZ;
      const rawKey = typeof req.query.dateKey === "string" ? req.query.dateKey.trim() : "";
      const dateKey =
        rawKey && /^\d{4}-\d{2}-\d{2}$/.test(rawKey) ? rawKey : getZonedDateKey(new Date(), tz);

      try {
        const [actions, aiDailyBrief] = await Promise.all([
          listPlatformActionsForZonedDay(prisma, orgId, dateKey, tz, {
            order: "desc",
            activityLimit: 250,
            eventLimit: 150,
            maxRows: 300
          }),
          prisma.adminAiReport.findUnique({
            where: { orgId_dateKey: { orgId, dateKey } },
            select: { id: true, subject: true, createdAt: true }
          })
        ]);

        res.json({
          dateKey,
          tz,
          aiReportHourLocal: Math.min(23, Math.max(0, Number(process.env.DAILY_OPS_AI_REPORT_HOUR ?? 19))),
          actions,
          aiDailyBrief
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[director] summary-actions failed", e);
        res.status(500).json({ error: "Failed to load summary actions" });
      }
    }
  );

  // Director approval queue and decisions
  router.get(
    "/approvals",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { type, status } = req.query as {
        type?: string;
        status?: string;
      };

      const where: Prisma.ApprovalWhereInput = {
        orgId
      };
      if (type) {
        where.entityType = type;
      }
      if (status) {
        where.status = status;
      } else {
        where.status = "pending";
      }

      const approvals = await prisma.approval.findMany({
        where,
        orderBy: { createdAt: "asc" }
      });

      const now = new Date();
      const defaultSlaMs = 48 * 60 * 60 * 1000;

      const items = approvals.map((a) => {
        const ageMs = now.getTime() - a.createdAt.getTime();
        const remainingMs = defaultSlaMs - ageMs;
        let slaStatus: "ok" | "warning" | "breached" = "ok";
        if (remainingMs <= 0) {
          slaStatus = "breached";
        } else if (remainingMs < defaultSlaMs / 3) {
          slaStatus = "warning";
        }
        return {
          ...a,
          sla: {
            ageMs,
            remainingMs,
            status: slaStatus
          }
        };
      });

      res.json(items);
    }
  );

  router.post(
    "/approvals/:id/decision",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { decision, comment } = req.body as {
        decision: "approved" | "rejected";
        comment?: string;
      };

      if (!decision) {
        res.status(400).json({ error: "Missing decision" });
        return;
      }

      const approval = await prisma.approval.findUnique({
        where: { id }
      });

      if (!approval || approval.orgId !== orgId) {
        res.status(404).json({ error: "Approval not found" });
        return;
      }

      if (approval.status !== "pending") {
        res.status(400).json({ error: "Approval is not pending" });
        return;
      }

      if (decision === "approved") {
        try {
          await enforceApprovalConflicts(prisma, {
            orgId,
            userId,
            approval
          });
        } catch (err) {
          res.status(403).json({ error: "Approval blocked due to financial conflict of interest" });
          return;
        }
      }

      const decidedAt = new Date();
      const updated = await prisma.approval.update({
        where: { id },
        data: {
          status: decision,
          approverId: userId,
          decisionNote: comment,
          decidedAt
        }
      });

      const approvalTimeMs =
        decidedAt.getTime() - approval.createdAt.getTime();

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: `approval.${decision}`,
          entityType: approval.entityType,
          entityId: approval.entityId,
          approvalTimeMs,
          rejectionReason: decision === "rejected" ? comment ?? undefined : undefined,
          metadata: {
            approvalId: approval.id
          }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: `director.approval.${decision}`,
          entityType: approval.entityType,
          entityId: approval.entityId,
          metadata: { approvalId: approval.id, comment }
        }
      });

      res.json(updated);
    }
  );

  // Project priority and pause / resume
  router.post(
    "/projects/:id/priority",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { priority, reason } = req.body as {
        priority: string;
        reason: string;
      };

      if (!priority || !reason) {
        res.status(400).json({ error: "priority and reason are required" });
        return;
      }

      const project = await prisma.project.findUnique({ where: { id } });
      if (!project || project.orgId !== orgId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const updated = await prisma.project.update({
        where: { id },
        data: {
          priority
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "project.priority_changed",
          entityType: "project",
          entityId: id,
          metadata: { from: project.priority, to: priority, reason }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.project.priority_changed",
          entityType: "project",
          entityId: id,
          metadata: { from: project.priority, to: priority, reason }
        }
      });

      if (project.ownerUserId) {
        const subject = "Project priority changed";
        const body = `Priority changed to ${priority}. Reason: ${reason}`;
        await prisma.notification.create({
          data: {
            orgId,
            channel: "in_app",
            to: project.ownerUserId,
            subject,
            body,
            status: "queued",
            type: "project.priority_changed",
            tier: "governance"
          }
        });
        await notifyAdminsInApp(prisma, orgId, subject, body, {
          type: "project.priority_changed.admin_mirror",
          tier: "structural",
          excludeUserIds: [project.ownerUserId]
        });
      }

      res.json(updated);
    }
  );

  router.post(
    "/projects/:id/pause",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { reason } = req.body as { reason: string };

      if (!reason) {
        res.status(400).json({ error: "reason is required" });
        return;
      }

      const project = await prisma.project.findUnique({ where: { id } });
      if (!project || project.orgId !== orgId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const updated = await prisma.project.update({
        where: { id },
        data: {
          status: "paused"
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "project.paused",
          entityType: "project",
          entityId: id,
          metadata: { reason }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.project.paused",
          entityType: "project",
          entityId: id,
          metadata: { reason }
        }
      });

      if (project.ownerUserId) {
        const subject = "Project paused";
        const body = `Project has been paused. Reason: ${reason}`;
        await prisma.notification.create({
          data: {
            orgId,
            channel: "in_app",
            to: project.ownerUserId,
            subject,
            body,
            status: "queued",
            type: "project.paused",
            tier: "governance"
          }
        });
        await notifyAdminsInApp(prisma, orgId, subject, body, {
          type: "project.paused.admin_mirror",
          tier: "structural",
          excludeUserIds: [project.ownerUserId]
        });
      }

      res.json(updated);
    }
  );

  router.post(
    "/projects/:id/resume",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { reason } = req.body as { reason: string };

      if (!reason) {
        res.status(400).json({ error: "reason is required" });
        return;
      }

      const project = await prisma.project.findUnique({ where: { id } });
      if (!project || project.orgId !== orgId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const updated = await prisma.project.update({
        where: { id },
        data: {
          status: "active"
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "project.resumed",
          entityType: "project",
          entityId: id,
          metadata: { reason }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.project.resumed",
          entityType: "project",
          entityId: id,
          metadata: { reason }
        }
      });

      if (project.ownerUserId) {
        const subject = "Project resumed";
        const body = `Project has been resumed. Reason: ${reason}`;
        await prisma.notification.create({
          data: {
            orgId,
            channel: "in_app",
            to: project.ownerUserId,
            subject,
            body,
            status: "queued",
            type: "project.resumed",
            tier: "governance"
          }
        });
        await notifyAdminsInApp(prisma, orgId, subject, body, {
          type: "project.resumed.admin_mirror",
          tier: "structural",
          excludeUserIds: [project.ownerUserId]
        });
      }

      res.json(updated);
    }
  );

  // Risk management panel
  router.get(
    "/risks",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { type, severity, status } = req.query as {
        type?: string;
        severity?: string;
        status?: string;
      };

      const where: Prisma.RiskWhereInput = {
        orgId
      };
      if (type) where.type = type;
      if (severity) where.severity = severity;
      if (status) where.status = status;

      const risks = await prisma.risk.findMany({
        where,
        orderBy: { detectedAt: "desc" }
      });

      res.json(risks);
    }
  );

  // Change request decisions
  router.post(
    "/change-requests/:id/decision",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { decision, reason } = req.body as {
        decision: "approved" | "rejected";
        reason?: string;
      };

      if (!decision) {
        res.status(400).json({ error: "decision is required" });
        return;
      }

      const existing = await prisma.changeRequest.findFirst({
        where: { id, orgId }
      });
      if (!existing) {
        res.status(404).json({ error: "Change request not found" });
        return;
      }

      const updated = await prisma.changeRequest.update({
        where: { id },
        data: {
          status: decision,
          approvedByUserId: userId,
          decidedAt: new Date()
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: `change_request.${decision}`,
          entityType: "change_request",
          entityId: id,
          rejectionReason: decision === "rejected" ? reason ?? undefined : undefined
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: `change_request.${decision}`,
          entityType: "change_request",
          entityId: id,
          metadata: { reason }
        }
      });

      res.json(updated);
    }
  );

  router.post(
    "/risks/:id/assign-owner",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { ownerUserId } = req.body as { ownerUserId: string };

      if (!ownerUserId) {
        res.status(400).json({ error: "ownerUserId is required" });
        return;
      }

      const risk = await prisma.risk.findUnique({ where: { id } });
      if (!risk || risk.orgId !== orgId) {
        res.status(404).json({ error: "Risk not found" });
        return;
      }

      const updated = await prisma.risk.update({
        where: { id },
        data: {
          ownerUserId
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "risk.assigned_owner",
          entityType: "risk",
          entityId: id,
          metadata: { from: risk.ownerUserId, to: ownerUserId }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.risk.assigned_owner",
          entityType: "risk",
          entityId: id,
          metadata: { from: risk.ownerUserId, to: ownerUserId }
        }
      });

      res.json(updated);
    }
  );

  router.post(
    "/risks/:id/change-severity",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { severity, reason } = req.body as {
        severity: string;
        reason: string;
      };

      if (!severity || !reason) {
        res.status(400).json({ error: "severity and reason are required" });
        return;
      }

      const risk = await prisma.risk.findUnique({ where: { id } });
      if (!risk || risk.orgId !== orgId) {
        res.status(404).json({ error: "Risk not found" });
        return;
      }

      const updated = await prisma.risk.update({
        where: { id },
        data: {
          severity
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "risk.changed_severity",
          entityType: "risk",
          entityId: id,
          metadata: { from: risk.severity, to: severity, reason }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.risk.changed_severity",
          entityType: "risk",
          entityId: id,
          metadata: { from: risk.severity, to: severity, reason }
        }
      });

      res.json(updated);
    }
  );

  router.post(
    "/risks/:id/close",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { status, notes } = req.body as {
        status: "mitigated" | "resolved";
        notes?: string;
      };

      if (!status) {
        res.status(400).json({ error: "status is required" });
        return;
      }

      const risk = await prisma.risk.findUnique({ where: { id } });
      if (!risk || risk.orgId !== orgId) {
        res.status(404).json({ error: "Risk not found" });
        return;
      }

      const updated = await prisma.risk.update({
        where: { id },
        data: {
          status,
          mitigationNotes: notes ?? risk.mitigationNotes
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "risk.closed",
          entityType: "risk",
          entityId: id,
          metadata: { status, notes }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.risk.closed",
          entityType: "risk",
          entityId: id,
          metadata: { status, notes }
        }
      });

      res.json(updated);
    }
  );

  // Decision log view
  router.get(
    "/decisions",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { limit = "100" } = req.query as { limit?: string };
      const take = Math.min(parseInt(limit, 10) || 100, 500);

      const decisions = await prisma.directorDecision.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take
      });

      res.json(decisions);
    }
  );

  // Decision metrics (approval time, rejection ratio, decisions per week)
  router.get(
    "/decisions/metrics",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const thirtyDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 30
      );

      const decisions = await prisma.directorDecision.findMany({
        where: {
          orgId,
          createdAt: { gte: thirtyDaysAgo }
        }
      });

      if (!decisions.length) {
        res.json({
          averageApprovalResponseTimeMs: 0,
          approvalRejectionRatio: 0,
          decisionsPerWeek: 0
        });
        return;
      }

      const approvalDecisions = decisions.filter((d) =>
        d.action.startsWith("approval.")
      );
      const approvalsWithTime = approvalDecisions.filter(
        (d) => d.approvalTimeMs != null
      );

      const averageApprovalResponseTimeMs =
        approvalsWithTime.length > 0
          ? approvalsWithTime.reduce(
              (sum, d) => sum + (d.approvalTimeMs ?? 0),
              0
            ) / approvalsWithTime.length
          : 0;

      const approvalsCount = approvalDecisions.length;
      const rejectionsCount = approvalDecisions.filter((d) =>
        d.action.endsWith(".rejected")
      ).length;
      const approvalRejectionRatio =
        approvalsCount > 0 ? rejectionsCount / approvalsCount : 0;

      const daysWindow = Math.max(
        1,
        (now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24)
      );
      const decisionsPerWeek =
        (decisions.length / daysWindow) * 7;

      res.json({
        averageApprovalResponseTimeMs,
        approvalRejectionRatio,
        decisionsPerWeek
      });
    }
  );

  // Financial control thresholds
  router.get(
    "/financial-controls",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const config = await prisma.directorConfig.findUnique({
        where: { orgId }
      });

      const defaults = {
        invoiceOverdueDaysThreshold: 14,
        largePayoutAmount: "10000",
        expenseSpikeMultiplier: 1.5,
        negativeCashflowThreshold: 0,
        dealStalledDaysThreshold: 14,
        developerOverloadTaskCount: 20
      };

      res.json({
        thresholds: (config?.thresholds as unknown) ?? defaults
      });
    }
  );

  router.post(
    "/financial-controls",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { thresholds, reason } = req.body as {
        thresholds: Record<string, unknown>;
        reason?: string;
      };

      if (!thresholds) {
        res.status(400).json({ error: "thresholds is required" });
        return;
      }

      const existing = await prisma.directorConfig.findUnique({
        where: { orgId }
      });

      const updated = await prisma.directorConfig.upsert({
        where: { orgId },
        create: {
          orgId,
          thresholds
        },
        update: {
          thresholds
        }
      });

      await prisma.directorDecision.create({
        data: {
          orgId,
          actorUserId: userId,
          action: "financial_controls.updated",
          entityType: "director_config",
          entityId: updated.id,
          metadata: { previous: existing?.thresholds, next: thresholds, reason }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.financial_controls.updated",
          entityType: "director_config",
          entityId: updated.id,
          metadata: { previous: existing?.thresholds, next: thresholds, reason }
        }
      });

      res.json(updated);
    }
  );

  // Strategic communications
  router.post(
    "/communications",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { toUserId, type, entityType, entityId, message } = req.body as {
        toUserId?: string;
        type: string;
        entityType?: string;
        entityId?: string;
        message: string;
      };

      if (!type || !message) {
        res.status(400).json({ error: "type and message are required" });
        return;
      }

      const allowedTypes = [
        "StrategicDirective",
        "ApprovalNote",
        "RejectionExplanation",
        "RiskAssignment",
        "PriorityChange"
      ];
      if (!allowedTypes.includes(type)) {
        res.status(400).json({ error: "Invalid communication type" });
        return;
      }

      const communication = await prisma.directorCommunication.create({
        data: {
          orgId,
          fromUserId: userId,
          toUserId: toUserId ?? null,
          type,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          message
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "director.communication.created",
          entityType: entityType ?? "communication",
          entityId: entityId ?? communication.id,
          metadata: {
            communicationId: communication.id,
            toUserId,
            type
          }
        }
      });

      res.status(201).json(communication);
    }
  );

  router.get(
    "/communications",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { entityType, entityId, limit = "100" } = req.query as {
        entityType?: string;
        entityId?: string;
        limit?: string;
      };
      const take = Math.min(parseInt(limit, 10) || 100, 500);

      const where: Prisma.DirectorCommunicationWhereInput = {
        orgId
      };
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;

      const communications = await prisma.directorCommunication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take
      });

      res.json(communications);
    }
  );

  return router;
}

