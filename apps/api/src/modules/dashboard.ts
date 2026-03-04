import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { processDueReminders } from "./lead-reminders";
import { processScheduleReminders } from "./schedule-reminders";
import { processTaskDueReminders } from "./task-reminders";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ELEVEN_HOURS_MS = 11 * 60 * 60 * 1000;
const REPORT_REMINDER_THROTTLE_MS = 11 * 60 * 60 * 1000; // don't send again within 11h

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
  const since = lastSubmittedAt ? Date.now() - lastSubmittedAt.getTime() : Infinity;
  if (since < ELEVEN_HOURS_MS) return;

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

  const subject = "Submit your report";
  const body = "It's been 11+ hours since your last report. Submit a report on the dashboard to keep your streak and stay on track.";
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
        to: userEmail,
        subject: `Reminder: ${subject}`,
        body,
        status: "queued",
        type: "report_submission_reminder",
        tier: "execution"
      }
    })
  ]);
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

export default function dashboardRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // What needs your attention + stats (notifications, messages, due, work progress, report streak)
  router.get(
    "/attention",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.developer, ROLE_KEYS.admin, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);

      await Promise.all([
        processDueReminders(prisma),
        processTaskDueReminders(prisma),
        processScheduleReminders(prisma)
      ]);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(startOfToday.getTime() + ONE_DAY_MS - 1);

      let lastReportSubmittedAt: Date | null = null;
      if (isSales) {
        const lastReport = await prisma.salesReport.findFirst({
          where: { submittedById: userId, status: "submitted", submittedAt: { not: null } },
          orderBy: { submittedAt: "desc" },
          select: { submittedAt: true }
        });
        lastReportSubmittedAt = lastReport?.submittedAt ?? null;
      }

      const isDeveloper = req.auth!.roleKeys.includes(ROLE_KEYS.developer);
      const [projectsNeedingReview, handoffRequestsReceived] =
        isDeveloper && !isDirector
          ? await Promise.all([
              prisma.project.findMany({
                where: { orgId, deletedAt: null, approvalStatus: "approved", assignedDeveloperId: userId, developerReviewedAt: null },
                select: { id: true, name: true }
              }),
              prisma.projectHandoffRequest.findMany({
                where: { orgId, toUserId: userId, status: "pending" },
                select: { id: true, projectId: true, fromUserId: true },
                include: { project: { select: { name: true } }, fromUser: { select: { name: true, email: true } } }
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
        isDirector
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
        (lastReportSubmittedAt === null || Date.now() - lastReportSubmittedAt.getTime() >= ELEVEN_HOURS_MS);

      if (reportReminderDue && isSales) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, notificationEmail: true }
        });
        const email = user?.notificationEmail ?? user?.email ?? "";
        await ensureReportSubmissionReminder(
          prisma,
          orgId,
          userId,
          email,
          lastReportSubmittedAt
        );
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
          workProgressPercent: 0,
          reportStreakDays: reportStreak
        },
        messages: overdueReportQuestions,
        dueToday,
        reportReminderDue: reportReminderDue ?? false,
        lastReportSubmittedAt: lastReportSubmittedAt?.toISOString() ?? null,
        projectsNeedingReview,
        handoffRequestsReceived
      });
    }
  );

  return router;
}
