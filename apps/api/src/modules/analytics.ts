import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function reportStreakDays(prisma: PrismaClient, userId: string, kind: "sales" | "developer"): Promise<number> {
  const todayKey = toDateKey(new Date());
  const dates =
    kind === "sales"
      ? new Set(
          (await prisma.salesReport.findMany({
            where: { submittedById: userId, status: "submitted", submittedAt: { not: null } },
            select: { submittedAt: true }
          })).map((r) => toDateKey(r.submittedAt!))
        )
      : new Set(
          (await prisma.developerReport.findMany({
            where: { submittedById: userId },
            select: { reportDate: true }
          })).map((r) => toDateKey(r.reportDate))
        );

  if (!dates.has(todayKey)) return 0;
  let streak = 0;
  let d = new Date();
  while (dates.has(toDateKey(d))) {
    streak++;
    d = new Date(d.getTime() - ONE_DAY_MS);
  }
  return streak;
}

export default function analyticsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Simple summary used by the main dashboard
  router.get(
    "/summary",
    requireRoles([
      ROLE_KEYS.admin,
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.analyst
    ]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [
      leadsThisWeek,
      dealsWon,
      revenueReceived,
      invoiceOutstanding,
      activeProjects,
      teamMembers
    ] = await Promise.all([
      prisma.lead.count({
        where: {
          orgId,
          createdAt: { gte: startOfWeek },
          deletedAt: null
        }
      }),
      prisma.deal.count({
        where: {
          orgId,
          stage: "won",
          deletedAt: null
        }
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          orgId,
          deletedAt: null
        }
      }),
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          orgId,
          deletedAt: null,
          OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
        }
      }),
      prisma.project.count({
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["planned", "active"] }
        }
      }),
      prisma.orgMember.count({ where: { orgId } })
    ]);

    res.json({
      leadsThisWeek,
      dealsWon,
      revenueReceived: revenueReceived._sum.amount?.toNumber() ?? 0,
      invoiceOutstanding: invoiceOutstanding._sum.totalAmount?.toNumber() ?? 0,
      activeProjects,
      teamMembers
    });
    }
  );

  // CEO-level dashboard: revenue, projects, lead conversion, workload
  router.get(
    "/ceo",
    requireRoles([
      ROLE_KEYS.admin,
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.analyst
    ]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueThisMonth,
      outstandingInvoices,
      overdueInvoices,
      expensesThisMonth,
      activeProjects,
      overdueTasks,
      blockedTasks,
      milestonesDone,
      milestonesPending,
      leadsThisMonth,
      dealsWon,
      dealsLost,
      wonDealsForCycle,
      taskWorkload,
      overdueTaskWorkload
    ] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          orgId,
          deletedAt: null,
          receivedAt: { gte: startOfMonth }
        }
      }),
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
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["approved", "paid"] },
          spentAt: { gte: startOfMonth }
        }
      }),
      prisma.project.count({
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["planned", "active"] }
        }
      }),
      prisma.task.count({
        where: {
          orgId,
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: now }
        }
      }),
      prisma.task.count({
        where: {
          orgId,
          deletedAt: null,
          status: "blocked"
        }
      }),
      prisma.milestone.count({
        where: { orgId, deletedAt: null, status: "completed" }
      }),
      prisma.milestone.count({
        where: {
          orgId,
          deletedAt: null,
          status: { not: "completed" }
        }
      }),
      prisma.lead.count({
        where: {
          orgId,
          deletedAt: null,
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.deal.count({
        where: { orgId, deletedAt: null, stage: "won" }
      }),
      prisma.deal.count({
        where: { orgId, deletedAt: null, stage: "lost" }
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
      prisma.task.groupBy({
        by: ["assigneeId"],
        _count: { _all: true },
        where: { orgId, deletedAt: null }
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        _count: { _all: true },
        where: {
          orgId,
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: now }
        }
      })
    ]);

    const totalClosed = dealsWon + dealsLost;
    const winRate = totalClosed > 0 ? dealsWon / totalClosed : 0;

    const avgTimeToCloseDays =
      wonDealsForCycle.length > 0
        ? wonDealsForCycle.reduce((sum, d) => {
            const close = d.closeDate as Date;
            const diffMs = close.getTime() - d.createdAt.getTime();
            return sum + diffMs / (1000 * 60 * 60 * 24);
          }, 0) / wonDealsForCycle.length
        : 0;

    const workloadByUser: Record<
      string,
      { tasks: number; overdueTasks: number }
    > = {};
    taskWorkload.forEach((row) => {
      workloadByUser[row.assigneeId ?? "unassigned"] = {
        tasks: row._count._all,
        overdueTasks: 0
      };
    });
    overdueTaskWorkload.forEach((row) => {
      const key = row.assigneeId ?? "unassigned";
      if (!workloadByUser[key]) {
        workloadByUser[key] = { tasks: 0, overdueTasks: 0 };
      }
      workloadByUser[key].overdueTasks = row._count._all;
    });

    res.json({
      revenueHealth: {
        revenueReceivedThisMonth:
          revenueThisMonth._sum.amount?.toNumber() ?? 0,
        outstandingInvoices:
          outstandingInvoices._sum.totalAmount?.toNumber() ?? 0,
        overdueInvoiceCount: overdueInvoices,
        expensesThisMonth: expensesThisMonth._sum.amount?.toNumber() ?? 0
      },
      projectHealth: {
        activeProjects,
        overdueTasks,
        blockedTasks,
        milestonesDone,
        milestonesPending
      },
      leadConversion: {
        leadsThisMonth,
        dealsWon,
        dealsLost,
        winRate,
        avgTimeToCloseDays
      },
      teamWorkload: workloadByUser
    });
  });

  // Admin extended dashboard — operational analytics (aggregates + lists)
  router.get(
    "/admin-extended",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(Date.now() - 14 * ONE_DAY_MS);
      const thirtyDaysAgo = new Date(Date.now() - 30 * ONE_DAY_MS);
      const ninetyDaysAgo = new Date(Date.now() - 90 * ONE_DAY_MS);

      const [
        projects,
        taskGroups,
        closedDeals,
        approvalsDecided,
        approvalsAllMonth,
        invoicesOutstandingAgg,
        paymentsCollectedAgg,
        paymentsRolling,
        expensesRolling,
        developerUsers,
        tasksByAssigneeActive,
        taskCompletedEvents14d,
        handoffsAccepted30d,
        repeatHandoffs90d,
        projectsStale72h,
        blockedTasksOld,
        stalledDeals,
        salesAndDevUsers
      ] = await Promise.all([
        prisma.project.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, type: true, status: true, approvalStatus: true, updatedAt: true, endDate: true, createdAt: true }
        }),
        prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { orgId, deletedAt: null },
          _count: { _all: true }
        }),
        prisma.deal.findMany({
          where: {
            orgId,
            deletedAt: null,
            stage: { in: ["won", "lost"] },
            closeDate: { not: null }
          },
          select: { createdAt: true, closeDate: true, stage: true }
        }),
        prisma.approval.findMany({
          where: { orgId, status: { in: ["approved", "rejected", "cancelled"] }, decidedAt: { not: null } },
          select: { id: true, entityType: true, status: true, reason: true, decisionNote: true, createdAt: true, decidedAt: true }
        }),
        prisma.approval.findMany({
          where: { orgId, createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
          select: { id: true, status: true }
        }),
        prisma.invoice.aggregate({
          where: { orgId, deletedAt: null, status: { in: ["sent", "partial", "overdue"] } },
          _sum: { totalAmount: true }
        }),
        prisma.payment.aggregate({
          where: { orgId, deletedAt: null, status: "confirmed" },
          _sum: { amount: true }
        }),
        prisma.payment.findMany({
          where: { orgId, deletedAt: null, status: "confirmed", receivedAt: { gte: ninetyDaysAgo } },
          select: { receivedAt: true, amount: true }
        }),
        prisma.expense.findMany({
          where: { orgId, deletedAt: null, status: { in: ["approved", "paid"] }, spentAt: { gte: ninetyDaysAgo } },
          select: { spentAt: true, amount: true }
        }),
        prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        }),
        prisma.task.groupBy({
          by: ["assigneeId"],
          where: { orgId, deletedAt: null, status: { in: ["todo", "not_started", "in_progress", "waiting_response", "blocked"] } },
          _count: { _all: true }
        }),
        prisma.eventLog.findMany({
          where: { orgId, type: "task.completed", createdAt: { gte: fourteenDaysAgo } },
          select: { actorId: true, createdAt: true }
        }),
        prisma.projectHandoffRequest.count({
          where: { orgId, status: "accepted", respondedAt: { gte: thirtyDaysAgo } }
        }),
        prisma.projectHandoffRequest.findMany({
          where: { orgId, status: "accepted", respondedAt: { gte: ninetyDaysAgo } },
          select: { projectId: true }
        }),
        prisma.project.findMany({
          where: { orgId, deletedAt: null, status: { in: ["active", "paused"] }, updatedAt: { lt: seventyTwoHoursAgo } },
          select: { id: true, name: true, updatedAt: true, status: true }
        }),
        prisma.task.findMany({
          where: { orgId, deletedAt: null, status: "blocked", updatedAt: { lt: seventyTwoHoursAgo } },
          select: { id: true, title: true, projectId: true, updatedAt: true }
        }),
        prisma.deal.findMany({
          where: { orgId, deletedAt: null, stage: { in: ["prospect", "proposal"] }, updatedAt: { lt: fourteenDaysAgo } },
          select: { id: true, title: true, stage: true, updatedAt: true, value: true }
        }),
        prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        })
      ]);

      // Completion rates per project
      const countsByProject: Record<string, { total: number; done: number }> = {};
      for (const p of projects) countsByProject[p.id] = { total: 0, done: 0 };
      for (const row of taskGroups) {
        const pid = row.projectId as string;
        if (!countsByProject[pid]) countsByProject[pid] = { total: 0, done: 0 };
        const c = row._count._all;
        countsByProject[pid].total += c;
        if (String(row.status) === "done") countsByProject[pid].done += c;
      }
      const completionRates = projects
        .map((p) => {
          const c = countsByProject[p.id] ?? { total: 0, done: 0 };
          const rate = c.total > 0 ? c.done / c.total : 0;
          return { projectId: p.id, name: p.name, approvalStatus: p.approvalStatus, status: p.status, totalTasks: c.total, doneTasks: c.done, completionRate: rate };
        })
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 25);

      // Avg days to close
      const avgDaysToClose =
        closedDeals.length === 0
          ? 0
          : closedDeals.reduce((s, d) => s + (((d.closeDate as Date).getTime() - d.createdAt.getTime()) / ONE_DAY_MS), 0) / closedDeals.length;

      // Delay frequency by project type (past endDate & not completed)
      const delayedByType: Record<string, number> = {};
      for (const p of projects) {
        const type = p.type ?? "unknown";
        const isDelayed = !!(p.endDate && p.endDate.getTime() < now.getTime() && p.status !== "completed");
        if (isDelayed) delayedByType[type] = (delayedByType[type] ?? 0) + 1;
      }

      // Module velocity per developer (tasks completed events in last 14d)
      const completedByDev: Record<string, number> = {};
      for (const e of taskCompletedEvents14d) {
        if (!e.actorId) continue;
        completedByDev[e.actorId] = (completedByDev[e.actorId] ?? 0) + 1;
      }
      const moduleVelocityPerDeveloper = developerUsers
        .map((u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          tasksCompleted14d: completedByDev[u.id] ?? 0
        }))
        .sort((a, b) => b.tasksCompleted14d - a.tasksCompleted14d)
        .slice(0, 25);

      // Finance analytics
      const decidedDurationsHrs = approvalsDecided
        .filter((a) => a.decidedAt)
        .map((a) => ((a.decidedAt as Date).getTime() - a.createdAt.getTime()) / (1000 * 60 * 60))
        .filter((x) => Number.isFinite(x) && x >= 0)
        .sort((a, b) => a - b);
      const avgApprovalTurnaroundHours =
        decidedDurationsHrs.length === 0 ? 0 : decidedDurationsHrs.reduce((s, x) => s + x, 0) / decidedDurationsHrs.length;
      const p50ApprovalTurnaroundHours =
        decidedDurationsHrs.length === 0 ? 0 : decidedDurationsHrs[Math.floor(decidedDurationsHrs.length * 0.5)];
      const p90ApprovalTurnaroundHours =
        decidedDurationsHrs.length === 0 ? 0 : decidedDurationsHrs[Math.floor(decidedDurationsHrs.length * 0.9)];

      const declined = approvalsDecided.filter((a) => a.status === "rejected");
      const decidedCount = approvalsDecided.length;
      const declineRate = decidedCount > 0 ? declined.length / decidedCount : 0;
      const declineReasons = new Map<string, number>();
      for (const a of declined) {
        const key = (a.decisionNote?.trim() || a.reason?.trim() || "No reason").slice(0, 140);
        declineReasons.set(key, (declineReasons.get(key) ?? 0) + 1);
      }
      const topDeclineReasons = Array.from(declineReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([reason, count]) => ({ reason, count }));

      const outstandingVsCollected = {
        outstandingInvoices: Number(invoicesOutstandingAgg._sum.totalAmount ?? 0),
        collectedPayments: Number(paymentsCollectedAgg._sum.amount ?? 0)
      };

      function sumWindow(list: { at: Date; amount: any }[], start: Date, end: Date): number {
        const s = start.getTime();
        const e = end.getTime();
        return list.reduce((acc, r) => {
          const t = r.at.getTime();
          if (t >= s && t < e) acc += Number(r.amount ?? 0);
          return acc;
        }, 0);
      }
      const payments = paymentsRolling.map((p) => ({ at: p.receivedAt, amount: p.amount }));
      const expenses = expensesRolling.map((e) => ({ at: e.spentAt, amount: e.amount }));
      const cashFlowTrend = [
        { window: "7d", in: sumWindow(payments, new Date(Date.now() - 7 * ONE_DAY_MS), now), out: sumWindow(expenses, new Date(Date.now() - 7 * ONE_DAY_MS), now) },
        { window: "30d", in: sumWindow(payments, new Date(Date.now() - 30 * ONE_DAY_MS), now), out: sumWindow(expenses, new Date(Date.now() - 30 * ONE_DAY_MS), now) },
        { window: "90d", in: sumWindow(payments, new Date(Date.now() - 90 * ONE_DAY_MS), now), out: sumWindow(expenses, new Date(Date.now() - 90 * ONE_DAY_MS), now) }
      ].map((w) => ({ ...w, net: w.in - w.out }));

      // Team analytics: active load and streaks
      const activeTasksByAssignee: Record<string, number> = {};
      for (const row of tasksByAssigneeActive) {
        const key = row.assigneeId ?? "unassigned";
        activeTasksByAssignee[key] = row._count._all;
      }
      const perUserLoad = salesAndDevUsers
        .map((u) => ({ userId: u.id, name: u.name, email: u.email, activeTasks: activeTasksByAssignee[u.id] ?? 0 }))
        .sort((a, b) => b.activeTasks - a.activeTasks);
      const loads = perUserLoad.map((u) => u.activeTasks).sort((a, b) => a - b);
      const median = loads.length ? loads[Math.floor(loads.length / 2)] : 0;
      const overload = perUserLoad.filter((u) => u.activeTasks >= Math.max(10, median * 2)).slice(0, 10);
      const underutilised = perUserLoad.filter((u) => u.activeTasks <= Math.floor(median / 3)).slice(0, 10);

      const reportStreaks = await Promise.all(
        salesAndDevUsers.slice(0, 30).map(async (u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          salesReportStreakDays: await reportStreakDays(prisma, u.id, "sales"),
          developerReportStreakDays: await reportStreakDays(prisma, u.id, "developer")
        }))
      );

      // Repeat swap patterns: projects with >=2 accepted handoffs in 90d
      const handoffCountByProject = new Map<string, number>();
      for (const h of repeatHandoffs90d) {
        handoffCountByProject.set(h.projectId, (handoffCountByProject.get(h.projectId) ?? 0) + 1);
      }
      const repeatSwapPatterns = Array.from(handoffCountByProject.entries())
        .filter(([, c]) => c >= 2)
        .map(([projectId, count]) => {
          const p = projects.find((x) => x.id === projectId);
          return { projectId, projectName: p?.name ?? projectId, count90d: count };
        })
        .sort((a, b) => b.count90d - a.count90d)
        .slice(0, 10);

      res.json({
        projectAnalytics: {
          completionRates,
          avgDaysToClose,
          moduleVelocityPerDeveloper,
          delayFrequencyByProjectType: delayedByType
        },
        financeAnalytics: {
          approvalTurnaroundHours: { avg: avgApprovalTurnaroundHours, p50: p50ApprovalTurnaroundHours, p90: p90ApprovalTurnaroundHours },
          declineRate,
          topDeclineReasons,
          outstandingVsCollected,
          cashFlowTrend
        },
        teamAnalytics: {
          developerUtilisationSignals: perUserLoad.slice(0, 20),
          swapHandoffFrequency30d: handoffsAccepted30d,
          overloadPatterns: { medianActiveTasks: median, overloaded: overload, underutilised },
          reportStreakPerUser: reportStreaks.sort((a, b) => (b.salesReportStreakDays + b.developerReportStreakDays) - (a.salesReportStreakDays + a.developerReportStreakDays))
        },
        riskAnalytics: {
          projectsNoUpdate72h: projectsStale72h,
          blockedTasksAbove72h: blockedTasksOld,
          stalledDeals14d: stalledDeals,
          repeatSwapPatterns
        }
      });
    }
  );

  // Red flag view for Director-only alerts
  router.get(
    "/red-flags",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();

      const fourteenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 14
      );
      const sevenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );
      const previous14Start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 28
      );

      const [
        overdueInvoices,
        longBlockedTasks,
        recentExpenses,
        previousExpenses,
        paymentsThisPeriod,
        paymentsPreviousPeriod,
        overloadedAssignees
      ] = await Promise.all([
        // Invoice overdue > 14 days
        prisma.invoice.findMany({
          where: {
            orgId,
            deletedAt: null,
            status: "overdue",
            dueDate: { lt: fourteenDaysAgo }
          },
          select: { id: true, number: true, clientId: true, dueDate: true }
        }),
        // Tasks blocked > 7 days
        prisma.task.findMany({
          where: {
            orgId,
            deletedAt: null,
            status: "blocked",
            updatedAt: { lt: sevenDaysAgo }
          },
          select: { id: true, projectId: true, title: true, updatedAt: true }
        }),
        // Expenses last 14 days
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["approved", "paid"] },
            spentAt: { gte: fourteenDaysAgo }
          }
        }),
        // Expenses previous 14 days
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["approved", "paid"] },
            spentAt: { gte: previous14Start, lt: fourteenDaysAgo }
          }
        }),
        // Revenue this 30 days
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            receivedAt: { gte: fourteenDaysAgo }
          }
        }),
        // Revenue previous 30 days
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            receivedAt: { gte: previous14Start, lt: fourteenDaysAgo }
          }
        }),
        // Team overload: many active tasks
        prisma.task.groupBy({
          by: ["assigneeId"],
          _count: { _all: true },
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["todo", "in_progress", "blocked"] }
          }
        })
      ]);

      const expenseCurrent =
        recentExpenses._sum.amount?.toNumber() ?? 0;
      const expensePrev =
        previousExpenses._sum.amount?.toNumber() ?? 0;
      const expenseSpike =
        expensePrev > 0 && expenseCurrent > expensePrev * 1.5;

      const revenueCurrent =
        paymentsThisPeriod._sum.amount?.toNumber() ?? 0;
      const revenuePrev =
        paymentsPreviousPeriod._sum.amount?.toNumber() ?? 0;
      const revenueDrop =
        revenuePrev > 0 && revenueCurrent < revenuePrev * 0.8;

      const teamOverload = overloadedAssignees.filter(
        (row) => row._count._all > 20
      );

      res.json({
        invoiceOverdue: {
          hasIssue: overdueInvoices.length > 0,
          items: overdueInvoices
        },
        projectBlocked: {
          hasIssue: longBlockedTasks.length > 0,
          items: longBlockedTasks
        },
        expenseSpike: {
          hasIssue: expenseSpike,
          currentWindow: expenseCurrent,
          previousWindow: expensePrev
        },
        revenueDrop: {
          hasIssue: revenueDrop,
          currentWindow: revenueCurrent,
          previousWindow: revenuePrev
        },
        teamOverload: {
          hasIssue: teamOverload.length > 0,
          assignees: teamOverload
        }
      });
    }
  );

  return router;
}

