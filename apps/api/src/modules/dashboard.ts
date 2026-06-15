// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { logEmailSent } from "./admin-activity";
import { notifyAdminsInApp } from "./director-notifications";
import { processAiAlignmentNotifications } from "./ai-alignment-notifications";
import { processNegligenceAlerts } from "./negligence-alerts";
import { processDueReminders } from "./lead-reminders";
import { processScheduleReminders } from "./schedule-reminders";
import { processTaskDueReminders } from "./task-reminders";
import { processQueuedEmails } from "./email-delivery";
import { processFinanceApprovalEscalations } from "./finance-approval-escalation";
import { processStaleActivityAdminDigest, TWELVE_HOURS_MS } from "./stale-activity-admin-digest";
import { generateDashboardFocusCoachGroq } from "./director-ai-automation";
import {
  getDeveloperProjectAnalytics,
  processDeveloperProgressReminders,
  resolveSnoozeInput,
  upsertDeveloperReminderSnooze
} from "./developer-progress-reminders";
import { SNOOZE_PRESET_OPTIONS } from "../lib/reminder-snooze";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_REMINDER_THROTTLE_MS = TWELVE_HOURS_MS;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ensureReportSubmissionReminder(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  userEmail: string,
  lastSubmittedAt: Date | null
): Promise<void> {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      notificationEmail: true,
      name: true,
      currentFocusUpdatedAt: true,
      reportsToDirector: { select: { name: true, email: true } }
    }
  });
  const email = profile?.notificationEmail?.trim() || profile?.email?.trim() || userEmail;
  if (profile?.currentFocusUpdatedAt && Date.now() - profile.currentFocusUpdatedAt.getTime() < TWELVE_HOURS_MS) {
    return;
  }

  const since = lastSubmittedAt ? Date.now() - lastSubmittedAt.getTime() : Infinity;
  if (since < TWELVE_HOURS_MS) return;

  const recent = await prisma.notification.findFirst({
    where: {
      orgId,
      type: "report_submission_reminder",
      to: userId,
      channel: "in_app",
      createdAt: { gte: new Date(Date.now() - REPORT_REMINDER_THROTTLE_MS) }
    }
  });
  if (recent) return;

  const directorLabel =
    profile?.reportsToDirector?.name?.trim() || profile?.reportsToDirector?.email?.trim() || null;
  const submitTarget = directorLabel
    ? `Submit to ${directorLabel} for review on CresOS`
    : "Submit a report on the dashboard on CresOS";
  const subject = directorLabel ? `Submit your report to ${directorLabel}` : "Submit your report";
  const body = `It's been 12+ hours since your last report (and no current-focus update in the last 12 hours). ${submitTarget} to keep your streak and stay on track.`;
  const emailSubject = `Reminder: ${subject}`;
  await prisma.$transaction([
    prisma.notification.create({
      data: {
        orgId,
        channel: "in_app",
        to: userId,
        subject,
        body,
        status: "sent",
        type: "report_submission_reminder",
        tier: "execution"
      }
    }),
    prisma.notification.create({
      data: {
        orgId,
        channel: "email",
        to: email,
        subject: emailSubject,
        body,
        status: "queued",
        type: "report_submission_reminder",
        tier: "execution"
      }
    })
  ]);
  if (email) await logEmailSent(prisma, { orgId, to: email, subject: emailSubject, body, type: "report_submission_reminder" });
  const salesLabel = profile?.name?.trim() || profile?.email || "Sales user";
  await notifyAdminsInApp(
    prisma,
    orgId,
    `[Visibility] ${subject}`,
    `Sales report reminder for: ${salesLabel}. ${body}`,
    { type: "report_submission_reminder.admin_mirror", tier: "structural", excludeUserIds: [userId] }
  );
}

async function reportSubmissionStreak(prisma: PrismaClient, userId: string): Promise<number> {
  const reports = await prisma.salesReport.findMany({
    where: { submittedById: userId, status: "submitted", submittedAt: { not: null } },
    select: { submittedAt: true }
  });
  const dates = new Set(reports.map((r) => toDateKey(r.submittedAt!)));
  const today = toDateKey(new Date());
  if (!dates.has(today)) return 0;
  let streak = 0;
  let d = new Date();
  while (dates.has(toDateKey(d))) {
    streak++;
    d = new Date(d.getTime() - ONE_DAY_MS);
  }
  return streak;
}

async function countOverdueSalesReportQuestions(
  prisma: PrismaClient,
  orgId: string,
  userId: string
): Promise<number> {
  const reports = await prisma.salesReport.findMany({
    where: { orgId, submittedById: userId, status: "submitted" },
    select: { id: true }
  });
  const reportIds = reports.map((r) => r.id);
  if (reportIds.length === 0) return 0;
  const questions = await prisma.salesReportComment.findMany({
    where: { reportId: { in: reportIds }, kind: "question", parentId: null }
  });
  const deadlineMs = 24 * 60 * 60 * 1000;
  let n = 0;
  for (const q of questions) {
    const reply = await prisma.salesReportComment.findFirst({
      where: { parentId: q.id }
    });
    if (!reply && Date.now() > q.createdAt.getTime() + deadlineMs) {
      n++;
    }
  }
  return n;
}

async function buildFocusCoachPayload(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  roleKeys: string[]
): Promise<{
  checks: Record<string, unknown>;
  deterministicTips: string[];
  contextForAi: Record<string, unknown>;
}> {
  const now = new Date();
  const uy = now.getUTCFullYear();
  const um = now.getUTCMonth();
  const ud = now.getUTCDate();
  const utcDayStart = new Date(Date.UTC(uy, um, ud, 0, 0, 0, 0));
  const utcDayEnd = new Date(Date.UTC(uy, um, ud, 23, 59, 59, 999));

  const isSales = roleKeys.includes(ROLE_KEYS.sales);
  const isDev = roleKeys.includes(ROLE_KEYS.developer);
  const isReviewer = roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));
  const canApprove = roleKeys.some((k) =>
    [ROLE_KEYS.director, ROLE_KEYS.admin, ROLE_KEYS.finance].includes(k)
  );

  const [userRow, unreadInApp, activeProjectsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    }),
    prisma.notification.count({
      where: { orgId, channel: "in_app", to: userId, readAt: null }
    }),
    prisma.project.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["planned", "active", "paused"] },
        OR: [
          { assignedDeveloperId: userId },
          { createdByUserId: userId },
          { ownerUserId: userId },
          { developerAssignments: { some: { userId, status: "accepted" } } }
        ]
      }
    })
  ]);

  const firstName =
    userRow?.name?.trim().split(/\s+/)[0] ||
    userRow?.email?.split("@")[0]?.split(".")[0] ||
    "there";

  const tips: string[] = [];
  const checks: Record<string, unknown> = {
    unreadInAppNotifications: unreadInApp,
    activeProjectsYouTouch: activeProjectsCount
  };

  if (unreadInApp > 0) {
    tips.push(
      `Clear ${unreadInApp} unread in-app notification${unreadInApp === 1 ? "" : "s"} (bell / Community) so messages don’t pile up.`
    );
  }

  if (activeProjectsCount > 0) {
    tips.push(
      `You’re linked to ${activeProjectsCount} active or in-flight project${activeProjectsCount === 1 ? "" : "s"} — confirm status and blockers on Projects.`
    );
  }

  if (isSales) {
    const [latestSales, salesToday, overdueQs] = await Promise.all([
      prisma.salesReport.findFirst({
        where: { orgId, submittedById: userId, status: "submitted" },
        orderBy: { submittedAt: "desc" },
        select: { id: true, reviewStatus: true, submittedAt: true }
      }),
      prisma.salesReport.findFirst({
        where: {
          orgId,
          submittedById: userId,
          status: "submitted",
          submittedAt: { gte: utcDayStart, lte: utcDayEnd }
        },
        select: { id: true }
      }),
      countOverdueSalesReportQuestions(prisma, orgId, userId)
    ]);
    checks.salesSubmittedTodayUtc = !!salesToday;
    checks.salesLatestReviewStatus = latestSales?.reviewStatus ?? null;
    checks.salesReportThreadsNeedingReplyOverdue24h = overdueQs;

    if (!salesToday) {
      tips.push(
        `Submit today’s sales report (Reports) so leadership stays aligned on pipeline activity.`
      );
    }
    if (latestSales?.reviewStatus === "pending") {
      tips.push(
        `Your latest submitted sales report is awaiting formal review — watch for director questions.`
      );
    }
    if (overdueQs > 0) {
      tips.push(
        `${overdueQs} question${overdueQs === 1 ? "" : "s"} on your reports need a reply (open Reports / threads).`
      );
    }
  }

  if (isDev) {
    const [latestDev, devToday, myTasksOverdue] = await Promise.all([
      prisma.developerReport.findFirst({
        where: { orgId, submittedById: userId },
        orderBy: { reportDate: "desc" },
        select: {
          reviewStatus: true,
          reportDate: true,
          needsAttention: true
        }
      }),
      prisma.developerReport.findFirst({
        where: {
          orgId,
          submittedById: userId,
          reportDate: { gte: utcDayStart, lte: utcDayEnd }
        },
        select: { id: true }
      }),
      prisma.task.count({
        where: {
          orgId,
          assigneeId: userId,
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: now }
        }
      })
    ]);
    checks.developerSubmittedTodayUtc = !!devToday;
    checks.developerLatestReviewStatus = latestDev?.reviewStatus ?? null;
    checks.developerLatestNeedsAttentionSnippet = latestDev?.needsAttention?.trim()
      ? String(latestDev.needsAttention).slice(0, 200)
      : null;
    checks.developerOverdueTasks = myTasksOverdue;

    if (!devToday) {
      tips.push(`Submit today’s developer report so delivery and risks stay visible to the team.`);
    }
    if (latestDev?.reviewStatus === "pending") {
      tips.push(`Your latest developer report is awaiting review — respond quickly to feedback.`);
    }
    if (latestDev?.needsAttention?.trim()) {
      tips.push(
        `Your last developer report flagged needs-attention items — close the loop on Projects or with your lead.`
      );
    }
    if (myTasksOverdue > 0) {
      tips.push(
        `${myTasksOverdue} overdue task${myTasksOverdue === 1 ? "" : "s"} assigned to you — clear the oldest blocker first.`
      );
    }
  }

  if (isReviewer) {
    const [salesPending, devPending] = await Promise.all([
      prisma.salesReport.count({
        where: { orgId, status: "submitted", reviewStatus: "pending" }
      }),
      prisma.developerReport.count({
        where: { orgId, reviewStatus: "pending" }
      })
    ]);
    checks.salesReportsAwaitingLeadershipReview = salesPending;
    checks.developerReportsAwaitingLeadershipReview = devPending;
    const totalRep = salesPending + devPending;
    if (totalRep > 0) {
      tips.push(
        `${totalRep} submitted report${totalRep === 1 ? "" : "s"} await your review (sales + developer).`
      );
    }
  }

  if (canApprove) {
    const pendingApprovals = await prisma.approval.count({
      where: { orgId, status: "pending" }
    });
    checks.pendingApprovalRecords = pendingApprovals;
    if (pendingApprovals > 0) {
      tips.push(`${pendingApprovals} approval record(s) need a decision — open Approvals.`);
    }
  }

  const deterministicTips = tips.slice(0, 7);

  const contextForAi: Record<string, unknown> = {
    firstName,
    roleKeys,
    ...checks,
    coachingBullets: deterministicTips
  };

  return { checks, deterministicTips, contextForAi };
}

export default function dashboardRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get(
    "/kpis",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const startOfMonthUtc = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const startOfNextMonthUtc = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));

      const canSeeFinanceStats =
        req.auth!.roleKeys.includes(ROLE_KEYS.finance) ||
        req.auth!.roleKeys.includes(ROLE_KEYS.admin);

      const emptyFinance = {
        revenueThisMonth: 0,
        outstandingInvoicesAmount: 0,
        overdueInvoicesCount: 0,
        expensesThisMonth: 0,
        payoutsPaidThisMonth: 0,
        cashOutflowsThisMonth: 0,
        projectContractTotal: 0,
        projectAmountReceivedTotal: 0,
        projectPendingTotal: 0
      };

      const [
        activeProjectsCount,
        overdueTasksCount,
        blockedTasksCount,
        milestonesDone,
        milestonesPending,
        projectsFromLeadsThisMonth,
        dealsWon,
        dealsLost,
        closedDeals
      ] = await Promise.all([
        prisma.project.count({
          where: { orgId, deletedAt: null, status: "active" }
        }),
        prisma.task.count({
          where: {
            orgId,
            deletedAt: null,
            status: { not: "done" },
            dueDate: { not: null, lt: now }
          }
        }),
        prisma.task.count({
          where: { orgId, deletedAt: null, status: "blocked" }
        }),
        prisma.milestone.count({
          where: { orgId, deletedAt: null, status: "completed" }
        }),
        prisma.milestone.count({
          where: { orgId, deletedAt: null, status: { not: "completed" } }
        }),
        prisma.lead
          .groupBy({
            by: ["projectId"],
            where: {
              orgId,
              deletedAt: null,
              projectId: { not: null },
              createdAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
            }
          })
          .then((rows) => rows.filter((r) => r.projectId != null).length),
        prisma.deal.count({
          where: {
            orgId,
            deletedAt: null,
            stage: "won",
            updatedAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
          }
        }),
        prisma.deal.count({
          where: {
            orgId,
            deletedAt: null,
            stage: "lost",
            updatedAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
          }
        }),
        prisma.deal.findMany({
          where: {
            orgId,
            deletedAt: null,
            stage: { in: ["won", "lost"] },
            updatedAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
          },
          select: { createdAt: true, updatedAt: true }
        })
      ]);

      let finance = emptyFinance;

      if (canSeeFinanceStats) {
        const approvedProjectsMoney = await prisma.project.findMany({
          where: { orgId, deletedAt: null, approvalStatus: "approved" },
          select: { price: true, amountReceived: true }
        });
        let projectContractTotal = 0;
        let projectReceivedTotal = 0;
        let projectPendingTotal = 0;
        for (const p of approvedProjectsMoney) {
          const priceNum = p.price != null ? Number(p.price) : null;
          const recNum = p.amountReceived != null ? Number(p.amountReceived) : 0;
          if (priceNum != null) {
            projectContractTotal += priceNum;
            projectPendingTotal += Math.max(0, priceNum - recNum);
          }
          projectReceivedTotal += recNum;
        }

        const [revenueThisMonthAgg, expensesThisMonthAgg, payoutsPaidMonthAgg, outstandingInvoicesAgg, overdueInvoicesCount] =
          await Promise.all([
            prisma.payment.aggregate({
              where: {
                orgId,
                deletedAt: null,
                status: "confirmed",
                receivedAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
              },
              _sum: { amount: true }
            }),
            prisma.expense.aggregate({
              where: {
                orgId,
                deletedAt: null,
                status: { in: ["approved", "paid"] },
                spentAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
              },
              _sum: { amount: true }
            }),
            prisma.payout.aggregate({
              where: {
                orgId,
                deletedAt: null,
                paidAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
              },
              _sum: { amount: true }
            }),
            prisma.invoice.aggregate({
              where: {
                orgId,
                deletedAt: null,
                status: { in: ["sent", "partial", "overdue"] }
              },
              _sum: { totalAmount: true }
            }),
            prisma.invoice.count({
              where: {
                orgId,
                deletedAt: null,
                OR: [
                  { status: "overdue" },
                  {
                    status: { in: ["sent", "partial"] },
                    dueDate: { not: null, lt: now }
                  }
                ]
              }
            })
          ]);

        const expPart = Number(expensesThisMonthAgg._sum.amount ?? 0);
        const payoutPart = Number(payoutsPaidMonthAgg._sum.amount ?? 0);

        finance = {
          revenueThisMonth: Number(revenueThisMonthAgg._sum.amount ?? 0),
          outstandingInvoicesAmount: Number(outstandingInvoicesAgg._sum.totalAmount ?? 0),
          overdueInvoicesCount,
          expensesThisMonth: expPart,
          payoutsPaidThisMonth: payoutPart,
          cashOutflowsThisMonth: expPart + payoutPart,
          projectContractTotal,
          projectAmountReceivedTotal: projectReceivedTotal,
          projectPendingTotal
        };
      }

      const won = dealsWon;
      const lost = dealsLost;
      const closedCount = won + lost;
      const winRate = closedCount > 0 ? (won / closedCount) * 100 : 0;

      const avgTimeToCloseDays =
        closedDeals.length === 0
          ? 0
          : closedDeals.reduce((sum, d) => {
              const ms = d.updatedAt.getTime() - d.createdAt.getTime();
              return sum + ms / (1000 * 60 * 60 * 24);
            }, 0) / closedDeals.length;

      res.json({
        period: {
          startOfMonth: startOfMonthUtc.toISOString(),
          endExclusive: startOfNextMonthUtc.toISOString()
        },
        finance,
        projectHealth: {
          activeProjects: activeProjectsCount,
          overdueTasks: overdueTasksCount,
          blockedTasks: blockedTasksCount,
          milestonesDone,
          milestonesPending
        },
        leadConversion: {
          // For leadership KPIs we treat “leads” as “lead → project created” so counts align with project reality.
          leadsThisMonth: projectsFromLeadsThisMonth,
          dealsWon: won,
          dealsLost: lost,
          winRate,
          avgTimeToCloseDays
        }
      });
    }
  );

  // What needs your attention + stats (notifications, messages, due, work progress, report streak)
  router.get(
    "/attention",
    requireRoles([
      ROLE_KEYS.sales,
      ROLE_KEYS.director,
      ROLE_KEYS.developer,
      ROLE_KEYS.admin,
      ROLE_KEYS.analyst,
      ROLE_KEYS.finance
    ]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));
      const canSeeOrgApprovalQueue = req.auth!.roleKeys.some((k) =>
        [ROLE_KEYS.director, ROLE_KEYS.admin, ROLE_KEYS.finance].includes(k)
      );
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);

      if (isAdmin) {
        void processFinanceApprovalEscalations(prisma, orgId).catch(() => {});
        void processStaleActivityAdminDigest(prisma, orgId).catch(() => {});
      }

      await Promise.all([
        processDueReminders(prisma),
        processTaskDueReminders(prisma),
        processScheduleReminders(prisma)
      ]);
      // Deliver queued emails (SMTP). Keep it best-effort so the dashboard stays responsive.
      void processQueuedEmails(prisma, orgId, 25).catch(() => {});
      // AI alignment + negligence notifications (throttled); run in background so dashboard responds quickly
      void processAiAlignmentNotifications(prisma, orgId).catch(() => {});
      void processNegligenceAlerts(prisma, orgId).catch(() => {});

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(startOfToday.getTime() + ONE_DAY_MS - 1);

      let lastReportSubmittedAt: Date | null = null;
      let salesFocusOk12h = false;
      if (isSales) {
        const [lastReport, salesProfile] = await Promise.all([
          prisma.salesReport.findFirst({
            where: { submittedById: userId, status: "submitted", submittedAt: { not: null } },
            orderBy: { submittedAt: "desc" },
            select: { submittedAt: true }
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { currentFocusUpdatedAt: true }
          })
        ]);
        lastReportSubmittedAt = lastReport?.submittedAt ?? null;
        salesFocusOk12h = !!(
          salesProfile?.currentFocusUpdatedAt &&
          Date.now() - salesProfile.currentFocusUpdatedAt.getTime() < TWELVE_HOURS_MS
        );
      }

      const isDeveloper = req.auth!.roleKeys.includes(ROLE_KEYS.developer);
      const [projectsNeedingReview, handoffRequestsReceived] =
        isDeveloper && !isDirector
          ? await Promise.all([
              prisma.project.findMany({
                where: {
                  orgId,
                  deletedAt: null,
                  approvalStatus: "approved",
                  developerReviewedAt: null,
                  OR: [
                    { assignedDeveloperId: userId },
                    { developerAssignments: { some: { userId, status: "accepted" } } }
                  ]
                },
                select: { id: true, name: true }
              }),
              prisma.projectHandoffRequest.findMany({
                where: { orgId, toUserId: userId, status: "pending" },
                select: {
                  id: true,
                  projectId: true,
                  fromUserId: true,
                  project: { select: { name: true } },
                  fromUser: { select: { name: true, email: true } }
                }
              })
            ])
          : [[], []];

      const [
        inAppNotifications,
        upcomingFollowUps,
        pendingLeads,
        pendingApprovals,
        overdueReportQuestions,
        reportStreak
      ] = await Promise.all([
        prisma.notification.findMany({
          where: { orgId, channel: "in_app", to: userId },
          orderBy: { createdAt: "desc" },
          take: 30
        }),
        prisma.leadFollowUp.findMany({
          where: {
            orgId,
            assignedToId: userId,
            scheduledAt: { gte: now, lte: new Date(Date.now() + 7 * ONE_DAY_MS) }
          },
          orderBy: { scheduledAt: "asc" },
          take: 20,
          include: { lead: { select: { id: true, title: true } } }
        }),
        isDirector
          ? prisma.lead.findMany({
              where: { orgId, deletedAt: null, approvalStatus: "pending_approval" },
              orderBy: { createdAt: "desc" },
              take: 20,
              include: { owner: { select: { id: true, name: true, email: true } } }
            })
          : [],
        canSeeOrgApprovalQueue
          ? prisma.approval.findMany({
              where: { orgId, status: "pending" },
              orderBy: { createdAt: "desc" },
              take: 10,
              include: { requester: { select: { id: true, name: true, email: true } } }
            })
          : [],
        isSales
          ? (async () => {
              const reports = await prisma.salesReport.findMany({
                where: { orgId, submittedById: userId, status: "submitted" },
                select: { id: true }
              });
              const reportIds = reports.map((r) => r.id);
              const questions = await prisma.salesReportComment.findMany({
                where: { reportId: { in: reportIds }, kind: "question", parentId: null }
              });
              const overdue: { id: string; reportId: string; content: string; askedAt: Date }[] = [];
              const deadlineMs = 24 * 60 * 60 * 1000;
              for (const q of questions) {
                const reply = await prisma.salesReportComment.findFirst({
                  where: { parentId: q.id }
                });
                if (!reply && Date.now() > q.createdAt.getTime() + deadlineMs) {
                  overdue.push({
                    id: q.id,
                    reportId: q.reportId,
                    content: q.content,
                    askedAt: q.createdAt
                  });
                }
              }
              return overdue;
            })()
          : [],
        isSales ? reportSubmissionStreak(prisma, userId) : 0
      ]);

      const upcomingMeetings = upcomingFollowUps.filter((f) => f.type === "meeting");
      const upcomingCalls = upcomingFollowUps.filter((f) => f.type === "call");
      const dueToday = upcomingFollowUps.filter(
        (f) => f.scheduledAt >= startOfToday && f.scheduledAt <= endOfToday
      );
      const unreadNotifications = inAppNotifications.filter((n) => !n.readAt);

      const reportReminderDue =
        isSales &&
        !salesFocusOk12h &&
        (lastReportSubmittedAt === null || Date.now() - lastReportSubmittedAt.getTime() >= TWELVE_HOURS_MS);

      if (reportReminderDue && isSales) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, notificationEmail: true }
        });
        const email = user?.notificationEmail ?? user?.email ?? "";
        await ensureReportSubmissionReminder(prisma, orgId, userId, email, lastReportSubmittedAt);
      }

      let workProgressPercent = 0;
      let tasksOverdue = 0;
      let tasksDueSoon = 0;
      let developerReportStreakDays = 0;
      let overdueTasks: { id: string; title: string; projectId: string; dueDate: string }[] = [];
      let latestDeveloperReportNeedsAttention: string | null = null;

      if (isDeveloper) {
        const myTasks = await prisma.task.findMany({
          where: { orgId, assigneeId: userId, deletedAt: null },
          select: { id: true, title: true, projectId: true, dueDate: true, status: true }
        });
        const totalTasks = myTasks.length;
        const doneTasks = myTasks.filter((t) => t.status === "done").length;
        workProgressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        const nowMs = now.getTime();
        const sevenDaysMs = 7 * ONE_DAY_MS;
        const overdue = myTasks.filter(
          (t) => t.dueDate && t.status !== "done" && t.dueDate.getTime() < nowMs
        );
        const dueSoon = myTasks.filter(
          (t) =>
            t.dueDate &&
            t.status !== "done" &&
            t.dueDate.getTime() >= nowMs &&
            t.dueDate.getTime() <= nowMs + sevenDaysMs
        );
        tasksOverdue = overdue.length;
        tasksDueSoon = dueSoon.length;
        overdueTasks = overdue.map((t) => ({
          id: t.id,
          title: t.title,
          projectId: t.projectId,
          dueDate: t.dueDate!.toISOString()
        }));

        const devReports = await prisma.developerReport.findMany({
          where: { orgId, submittedById: userId },
          orderBy: { reportDate: "desc" },
          select: { reportDate: true, needsAttention: true }
        });
        if (devReports.length > 0 && devReports[0].needsAttention?.trim()) {
          latestDeveloperReportNeedsAttention = devReports[0].needsAttention.trim();
        }
        const todayKey = toDateKey(now);
        let streak = 0;
        let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const reportDates = new Set(devReports.map((r) => toDateKey(r.reportDate)));
        while (reportDates.has(toDateKey(d))) {
          streak++;
          d.setDate(d.getDate() - 1);
        }
        developerReportStreakDays = streak;
      }

      const needsAttentionCount =
        (isDeveloper ? projectsNeedingReview.length + handoffRequestsReceived.length + tasksOverdue : 0) ||
        0;

      let developerProgressReminders: Awaited<ReturnType<typeof processDeveloperProgressReminders>> = [];
      if (isDeveloper) {
        const devUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true }
        });
        const devLabel = devUser?.name?.trim() || devUser?.email || "Developer";
        try {
          developerProgressReminders = await processDeveloperProgressReminders(
            prisma,
            orgId,
            userId,
            devLabel
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[dashboard] developer progress reminders:", e);
        }
      }

      res.json({
        notifications: inAppNotifications,
        upcomingMeetings,
        upcomingCalls,
        leadsPendingApproval: pendingLeads,
        approvalsPending: pendingApprovals,
        stats: {
          notificationsCount: unreadNotifications.length,
          messagesCount: overdueReportQuestions.length,
          dueCount: dueToday.length,
          workProgressPercent: isDeveloper ? workProgressPercent : 0,
          reportStreakDays: reportStreak,
          tasksOverdue: isDeveloper ? tasksOverdue : undefined,
          tasksDueSoon: isDeveloper ? tasksDueSoon : undefined,
          developerReportStreakDays: isDeveloper ? developerReportStreakDays : undefined,
          needsAttentionCount: isDeveloper ? needsAttentionCount : undefined
        },
        messages: overdueReportQuestions,
        dueToday,
        reportReminderDue: reportReminderDue ?? false,
        lastReportSubmittedAt: lastReportSubmittedAt?.toISOString() ?? null,
        projectsNeedingReview,
        handoffRequestsReceived,
        overdueTasks: isDeveloper ? overdueTasks : undefined,
        latestDeveloperReportNeedsAttention: isDeveloper ? latestDeveloperReportNeedsAttention : undefined,
        developerProgressReminders: isDeveloper ? developerProgressReminders : undefined
      });
    }
  );

  router.get(
    "/developer-analytics",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const data = await getDeveloperProjectAnalytics(prisma, orgId, userId);
        res.json({ data });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[dashboard] developer-analytics:", e);
        res.status(500).json({ error: "Failed to load developer analytics" });
      }
    }
  );

  router.post(
    "/developer-reminders/snooze",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const reminderKey = String(req.body?.reminderKey ?? "").trim();
        if (!reminderKey) {
          res.status(400).json({ error: "reminderKey is required" });
          return;
        }
        const parsed = resolveSnoozeInput({
          preset: req.body?.preset,
          phrase: req.body?.phrase,
          until: req.body?.until
        });
        if (!parsed) {
          res.status(400).json({
            error:
              "Could not parse snooze time. Use preset (5m, 15m, 20m, 30m, 1h, 2h, 5h, 12h, tomorrow) or a phrase like “remind me in 30 minutes” or “Monday”."
          });
          return;
        }
        const devUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true }
        });
        const devLabel = devUser?.name?.trim() || devUser?.email || "Developer";
        await upsertDeveloperReminderSnooze(
          prisma,
          orgId,
          userId,
          reminderKey,
          parsed.until,
          parsed.label,
          devLabel
        );
        res.json({
          data: {
            reminderKey,
            snoozeUntil: parsed.until.toISOString(),
            label: parsed.label
          }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[dashboard] developer-reminders/snooze:", e);
        res.status(500).json({ error: "Failed to snooze reminder" });
      }
    }
  );

  router.get(
    "/developer-reminders/snooze-presets",
    requireRoles([ROLE_KEYS.developer]),
    (_req, res) => {
      res.json({ presets: SNOOZE_PRESET_OPTIONS });
    }
  );

  /** Facts-only coaching bullets + optional Groq alignment hint (uses same roles as /attention). */
  router.get(
    "/focus-coach",
    requireRoles([
      ROLE_KEYS.sales,
      ROLE_KEYS.director,
      ROLE_KEYS.developer,
      ROLE_KEYS.admin,
      ROLE_KEYS.analyst,
      ROLE_KEYS.finance
    ]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const keys = req.auth!.roleKeys;
        const payload = await buildFocusCoachPayload(prisma, orgId, userId, keys);
        let aiHint = null;
        try {
          aiHint = await generateDashboardFocusCoachGroq(payload.contextForAi);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[dashboard] focus-coach AI:", e);
        }
        res.json({
          checks: payload.checks,
          deterministicTips: payload.deterministicTips,
          aiHint
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[dashboard] focus-coach:", e);
        res.status(500).json({ error: "Failed to load focus coach" });
      }
    }
  );

  return router;
}
