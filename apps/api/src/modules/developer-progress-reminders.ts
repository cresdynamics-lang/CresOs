import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";
import { DEFAULT_ORG_DAY_TZ, getUtcRangeForZonedDate, getZonedDateKey } from "./org-zoned-day";
import {
  findTodayFocusTask,
  isFocusSetToday
} from "../lib/daily-project-focus";
import { parseReminderSnoozePhrase, snoozeUntilFromPreset } from "../lib/reminder-snooze";

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
const DAILY_NUDGE_HOUR = Math.min(23, Math.max(6, Number(process.env.DEVELOPER_PROGRESS_NUDGE_HOUR ?? 9)));
const FOCUS_REMINDER_HOUR = Math.min(23, Math.max(7, Number(process.env.DEVELOPER_FOCUS_REMINDER_HOUR ?? 10)));
const FOCUS_TASK_DEADLINE_HOUR = Math.min(23, Math.max(12, Number(process.env.DEVELOPER_FOCUS_TASK_DEADLINE_HOUR ?? 18)));

export type DeveloperProgressReminderBanner = {
  reminderKey: string;
  subject: string;
  body: string;
  projectId?: string;
  projectName?: string;
  severity: "info" | "warning";
};

async function isSnoozed(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  reminderKey: string,
  now: Date
): Promise<boolean> {
  const row = await prisma.developerReminderSnooze.findUnique({
    where: { orgId_userId_reminderKey: { orgId, userId, reminderKey } }
  });
  return !!(row && row.snoozeUntil > now);
}

async function markSent(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  reminderKey: string,
  bucketKey: string
): Promise<boolean> {
  const { count } = await prisma.developerProgressReminderSent.createMany({
    data: [{ orgId, userId, reminderKey, bucketKey }],
    skipDuplicates: true
  });
  return count > 0;
}

async function notifyDeveloperInApp(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  subject: string,
  body: string,
  type: string
): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: {
      orgId,
      channel: "in_app",
      to: userId,
      type,
      subject,
      createdAt: { gte: new Date(Date.now() - 2 * ONE_HOUR_MS) }
    }
  });
  if (recent) return;

  await prisma.notification.create({
    data: {
      orgId,
      channel: "in_app",
      to: userId,
      subject,
      body,
      status: "sent",
      type,
      tier: "execution"
    }
  });
}

/** Notify the developer's assigned director when they postpone a reminder. */
export async function notifyDirectorOnDeveloperSnooze(
  prisma: PrismaClient,
  orgId: string,
  developerId: string,
  developerLabel: string,
  reminderKey: string,
  snoozeLabel: string,
  snoozeUntil: Date
): Promise<void> {
  const dev = await prisma.user.findFirst({
    where: { id: developerId, orgId, deletedAt: null },
    select: { reportsToDirectorId: true }
  });
  const directorId = dev?.reportsToDirectorId;
  if (!directorId) return;

  const subject = `${developerLabel} postponed a progress reminder`;
  const body = `${developerLabel} snoozed “${reminderKey}” until ${snoozeUntil.toLocaleString()} (${snoozeLabel}). They were nudged to update tasks, milestones, or project delivery on assigned work.`;

  await prisma.notification.create({
    data: {
      orgId,
      channel: "in_app",
      to: directorId,
      subject,
      body,
      status: "sent",
      type: "developer.reminder_snoozed",
      tier: "governance"
    }
  });
}

export async function upsertDeveloperReminderSnooze(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  reminderKey: string,
  until: Date,
  label: string,
  developerLabel: string
): Promise<void> {
  await prisma.developerReminderSnooze.upsert({
    where: { orgId_userId_reminderKey: { orgId, userId, reminderKey } },
    create: { orgId, userId, reminderKey, snoozeUntil: until, label },
    update: { snoozeUntil: until, label }
  });
  await notifyDirectorOnDeveloperSnooze(prisma, orgId, userId, developerLabel, reminderKey, label, until);
}

async function assignedProjectIds(prisma: PrismaClient, orgId: string, userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: {
      orgId,
      deletedAt: null,
      approvalStatus: "approved",
      OR: [
        { assignedDeveloperId: userId },
        { developerAssignments: { some: { userId, status: "accepted" } } }
      ]
    },
    select: { id: true }
  });
  return projects.map((p) => p.id);
}

export async function getDeveloperProjectAnalytics(
  prisma: PrismaClient,
  orgId: string,
  userId: string
) {
  const projectIds = await assignedProjectIds(prisma, orgId, userId);
  if (projectIds.length === 0) {
    return { projects: [], totals: { assigned: 0, overdue: 0, blocked: 0, avgProgress: 0 } };
  }

  const now = new Date();
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      name: true,
      status: true,
      developerReviewedAt: true
    }
  });

  const rows = await Promise.all(
    projects.map(async (p) => {
      const tasks = await prisma.task.findMany({
        where: { orgId, projectId: p.id, deletedAt: null, assigneeId: userId },
        select: { id: true, status: true, dueDate: true, updatedAt: true }
      });
      const allProjectTasks = await prisma.task.count({
        where: { orgId, projectId: p.id, deletedAt: null }
      });
      const done = tasks.filter((t) => t.status === "done").length;
      const overdue = tasks.filter(
        (t) => t.dueDate && t.status !== "done" && t.dueDate.getTime() < now.getTime()
      ).length;
      const blocked = tasks.filter((t) => t.status === "blocked").length;
      const lastUpdate = tasks.reduce<Date | null>((acc, t) => {
        if (!acc || t.updatedAt > acc) return t.updatedAt;
        return acc;
      }, null);

      const pendingMilestones = await prisma.milestone.count({
        where: { orgId, projectId: p.id, deletedAt: null, status: { not: "completed" } }
      });
      const overdueMilestones = await prisma.milestone.count({
        where: {
          orgId,
          projectId: p.id,
          deletedAt: null,
          status: { not: "completed" },
          dueDate: { lt: now }
        }
      });

      const progressPercent = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      const hoursSinceUpdate = lastUpdate
        ? Math.round((now.getTime() - lastUpdate.getTime()) / ONE_HOUR_MS)
        : null;
      const untasked = allProjectTasks === 0;
      const needsReview = !p.developerReviewedAt;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        needsReview,
        untasked,
        taskCount: tasks.length,
        projectTaskCount: allProjectTasks,
        doneTasks: done,
        overdueTasks: overdue,
        blockedTasks: blocked,
        pendingMilestones,
        overdueMilestones,
        progressPercent,
        lastTaskUpdateAt: lastUpdate?.toISOString() ?? null,
        hoursSinceUpdate,
        stale: hoursSinceUpdate !== null && hoursSinceUpdate >= 24
      };
    })
  );

  const overdue = rows.reduce((s, r) => s + r.overdueTasks, 0);
  const blocked = rows.reduce((s, r) => s + r.blockedTasks, 0);
  const avgProgress =
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.progressPercent, 0) / rows.length) : 0;

  return {
    projects: rows,
    totals: { assigned: rows.length, overdue, blocked, avgProgress },
    refreshedAt: now.toISOString()
  };
}

/**
 * Evaluate and send developer progress nudges; return active banners for the dashboard UI.
 */
export async function processDeveloperProgressReminders(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  developerLabel: string
): Promise<DeveloperProgressReminderBanner[]> {
  const now = new Date();
  const banners: DeveloperProgressReminderBanner[] = [];
  const dateKey = getZonedDateKey(now, DEFAULT_ORG_DAY_TZ);
  const { hour } = (() => {
    const f = new Intl.DateTimeFormat("en-GB", {
      timeZone: DEFAULT_ORG_DAY_TZ,
      hour: "numeric",
      hour12: false
    });
    const parts = f.formatToParts(now);
    return { hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0) };
  })();

  const analytics = await getDeveloperProjectAnalytics(prisma, orgId, userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentFocusProjectId: true,
      currentFocusUpdatedAt: true,
      currentFocusProject: { select: { id: true, name: true } }
    }
  });

  // Daily nudge (org morning hour): update tasks + milestones on assigned projects
  const dailyKey = "daily_progress";
  if (hour >= DAILY_NUDGE_HOUR) {
    const staleProjects = analytics.projects.filter((p) => p.stale || p.overdueMilestones > 0);
    const noReportToday = !(await prisma.developerReport.findFirst({
      where: {
        orgId,
        submittedById: userId,
        reportDate: {
          gte: (await getUtcRangeForZonedDate(prisma, dateKey, DEFAULT_ORG_DAY_TZ)).start,
          lt: (await getUtcRangeForZonedDate(prisma, dateKey, DEFAULT_ORG_DAY_TZ)).end
        }
      },
      select: { id: true }
    }));

    if ((staleProjects.length > 0 || noReportToday) && !(await isSnoozed(prisma, orgId, userId, dailyKey, now))) {
      const bucketKey = dateKey;
      const subject = "Daily delivery check-in";
      const names = staleProjects.map((p) => p.name).slice(0, 3).join(", ");
      const body = noReportToday
        ? `Submit today's developer report and update tasks and milestones on your assigned projects${names ? ` (${names}${staleProjects.length > 3 ? ", …" : ""} need attention)` : ""}.`
        : `Update tasks and milestones on assigned projects — ${staleProjects.length} project(s) have no task activity in 24+ hours${names ? `: ${names}` : ""}.`;

      banners.push({ reminderKey: dailyKey, subject, body, severity: "warning" });

      if (await markSent(prisma, orgId, userId, dailyKey, bucketKey)) {
        await notifyDeveloperInApp(prisma, orgId, userId, subject, body, "developer.daily_progress");
      }
    }
  }

  // Missing daily focus after morning cutoff
  const missingFocusKey = "missing_daily_focus";
  if (hour >= FOCUS_REMINDER_HOUR && !(await isSnoozed(prisma, orgId, userId, missingFocusKey, now))) {
    const focusToday = isFocusSetToday(user?.currentFocusUpdatedAt, dateKey);
    if (!focusToday) {
      const bucketKey = dateKey;
      const subject = "Set today's project focus";
      const body =
        "You haven't set today's project focus yet. Choose your project and a short note — it adds a task for today and updates milestone success criteria for your team.";

      banners.push({ reminderKey: missingFocusKey, subject, body, severity: "warning" });

      if (await markSent(prisma, orgId, userId, missingFocusKey, bucketKey)) {
        await notifyDeveloperInApp(prisma, orgId, userId, subject, body, "developer.missing_focus");
      }
    }
  }

  // Incomplete daily focus task after end-of-day cutoff
  if (user?.currentFocusProjectId && user.currentFocusUpdatedAt && hour >= FOCUS_TASK_DEADLINE_HOUR) {
    const focusToday = isFocusSetToday(user.currentFocusUpdatedAt, dateKey);
    if (focusToday) {
      const focusTask = await findTodayFocusTask(
        prisma,
        orgId,
        userId,
        user.currentFocusProjectId
      );
      const incompleteKey = `incomplete_focus_task:${user.currentFocusProjectId}`;
      if (
        focusTask &&
        focusTask.status !== "done" &&
        !(await isSnoozed(prisma, orgId, userId, incompleteKey, now))
      ) {
        const bucketKey = dateKey;
        const subject = `Complete today's focus: ${focusTask.title}`;
        const body = `Your daily focus task on "${user.currentFocusProject?.name ?? "your project"}" is still open. Mark it done in Tasks or update your focus if plans changed.`;

        banners.push({
          reminderKey: incompleteKey,
          subject,
          body,
          projectId: user.currentFocusProjectId,
          projectName: user.currentFocusProject?.name ?? undefined,
          severity: "warning"
        });

        if (await markSent(prisma, orgId, userId, incompleteKey, bucketKey)) {
          await notifyDeveloperInApp(prisma, orgId, userId, subject, body, "developer.incomplete_focus_task");
        }
      }
    }
  }

  // Untasked focus project: 1h after setting focus on a project with zero tasks
  if (user?.currentFocusProjectId && user.currentFocusUpdatedAt) {
    const focusId = user.currentFocusProjectId;
    const untaskedKey = `untasked_focus:${focusId}`;
    const focusProject = analytics.projects.find((p) => p.id === focusId);
    const msSinceFocus = now.getTime() - user.currentFocusUpdatedAt.getTime();

    if (
      focusProject?.untasked &&
      msSinceFocus >= ONE_HOUR_MS &&
      !(await isSnoozed(prisma, orgId, userId, untaskedKey, now))
    ) {
      const bucketKey = `${dateKey}:${Math.floor(user.currentFocusUpdatedAt.getTime() / ONE_HOUR_MS)}`;
      const subject = `Add tasks to ${user.currentFocusProject?.name ?? "your focus project"}`;
      const body = `You've had "${user.currentFocusProject?.name ?? "this project"}" as today's focus for over an hour, but it has no delivery tasks yet. Create or claim tasks so directors see progress on the strategic overview.`;

      banners.push({
        reminderKey: untaskedKey,
        subject,
        body,
        projectId: focusId,
        projectName: user.currentFocusProject?.name ?? undefined,
        severity: "warning"
      });

      if (await markSent(prisma, orgId, userId, untaskedKey, bucketKey)) {
        await notifyDeveloperInApp(prisma, orgId, userId, subject, body, "developer.untasked_focus");
      }
    }
  }

  // Per-project stale progress (24h+ without task updates)
  for (const p of analytics.projects) {
    if (!p.stale || p.untasked) continue;
    const key = `stale_project:${p.id}`;
    if (await isSnoozed(prisma, orgId, userId, key, now)) continue;

    const bucketKey = `${dateKey}:${p.id}`;
    const subject = `Update progress on ${p.name}`;
    const body = `No task updates on "${p.name}" in ${p.hoursSinceUpdate ?? 24}+ hours. Refresh task status, unblock milestones (${p.overdueMilestones} overdue), or note blockers in your developer report.`;

    banners.push({
      reminderKey: key,
      subject,
      body,
      projectId: p.id,
      projectName: p.name,
      severity: "info"
    });

    if (await markSent(prisma, orgId, userId, key, bucketKey)) {
      await notifyDeveloperInApp(prisma, orgId, userId, subject, body, "developer.stale_project");
    }
  }

  return banners;
}

export function resolveSnoozeInput(body: {
  preset?: string;
  phrase?: string;
  until?: string;
}): { until: Date; label: string } | null {
  if (body.until) {
    const d = new Date(body.until);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      return { until: d, label: d.toLocaleString() };
    }
  }
  if (body.preset) {
    return snoozeUntilFromPreset(body.preset);
  }
  if (body.phrase) {
    return parseReminderSnoozePhrase(body.phrase);
  }
  return null;
}

export async function processDeveloperProgressRemindersForOrg(prisma: PrismaClient, orgId: string): Promise<void> {
  const developerRole = await prisma.role.findFirst({
    where: { orgId, key: ROLE_KEYS.developer }
  });
  if (!developerRole) return;

  const memberIds = new Set(
    (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId)
  );
  const devIds = (
    await prisma.userRole.findMany({ where: { roleId: developerRole.id }, select: { userId: true } })
  )
    .map((r) => r.userId)
    .filter((id) => memberIds.has(id));

  const users = await prisma.user.findMany({
    where: { id: { in: devIds }, deletedAt: null },
    select: { id: true, name: true, email: true }
  });

  for (const u of users) {
    const label = u.name?.trim() || u.email;
    await processDeveloperProgressReminders(prisma, orgId, u.id, label).catch(() => {});
  }
}
