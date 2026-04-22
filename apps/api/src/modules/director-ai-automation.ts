import Groq from "groq-sdk";
import type { PrismaClient } from "@prisma/client";
import {
  DIRECTOR_BRIEFING_SYSTEM,
  DIRECTOR_REPLY_SYSTEM,
  buildDirectorBriefingUser,
  buildDirectorReplyUserDeveloper,
  buildDirectorReplyUserSales
} from "../prompts/director-ai-prompts";
import { ROLE_KEYS } from "./auth-middleware";
import { getAdminUsers, getDirectorAndAdminUserIds, getDirectorUsers } from "./director-notifications";
import { DEFAULT_ORG_DAY_TZ } from "./org-zoned-day";
import { listPlatformActionsForZonedDay } from "./director-platform-summary";

const AUTO_REPLY_ENABLED = process.env.DIRECTOR_AI_AUTO_REPLY !== "false";
const BRIEFING_GROQ_ENABLED = process.env.DIRECTOR_AI_BRIEFING_GROQ !== "false";

const GROQ_MODEL =
  process.env.GROQ_DIRECTOR_MODEL?.trim() ||
  process.env.GROQ_REMINDER_MODEL?.trim() ||
  "llama-3.1-8b-instant";

const MARKED = "Marked reviewed. ✓";

let groqClient: Groq | null = null;
let groqKey: string | null = null;

function getGroq(): Groq | null {
  const candidates = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
    process.env.GROQ_API_KEY_TERTIARY
  ];
  const key = candidates.find((k) => typeof k === "string" && k.trim().length > 0)?.trim();
  if (!key) return null;
  if (!groqClient || groqKey !== key) {
    groqClient = new Groq({ apiKey: key });
    groqKey = key;
  }
  return groqClient;
}

async function groqPlainText(system: string, user: string, maxTokens: number, temperature: number): Promise<string | null> {
  const client = getGroq();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
      temperature
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    return raw && raw.length > 0 ? raw : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[director-ai] Groq request failed:", e);
    return null;
  }
}

function ensureMarkedReviewed(text: string): string {
  const t = text.trim();
  if (t.includes(MARKED)) return t;
  return `${t}\n\n${MARKED}`;
}

async function pickDirectorAuthorId(prisma: PrismaClient, orgId: string): Promise<string | null> {
  const dirs = await getDirectorUsers(prisma, orgId);
  if (dirs.length) {
    return [...dirs].sort((a, b) => a.email.localeCompare(b.email))[0]!.id;
  }
  const admins = await getAdminUsers(prisma, orgId);
  if (admins.length) {
    return [...admins].sort((a, b) => a.email.localeCompare(b.email))[0]!.id;
  }
  return null;
}

function randomDelayMs(): number {
  const min = 3 * 60 * 1000;
  const max = 8 * 60 * 1000;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** When set to a non-negative number (e.g. 0 in Vitest), skips the 3–8 min human-like delay. */
function queueDelayMs(): number {
  const raw = process.env.DIRECTOR_AI_E2E_DELAY_MS?.trim();
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return randomDelayMs();
}

export function queueAutoDirectorReplyForSalesReport(prisma: PrismaClient, reportId: string): void {
  if (!AUTO_REPLY_ENABLED) return;
  const delayMs = queueDelayMs();
  setTimeout(() => {
    void runAutoDirectorReplySalesReport(prisma, reportId).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[director-ai] sales auto-reply error:", e);
    });
  }, delayMs);
}

export function queueAutoDirectorReplyForDeveloperReport(prisma: PrismaClient, reportId: string): void {
  if (!AUTO_REPLY_ENABLED) return;
  const delayMs = queueDelayMs();
  setTimeout(() => {
    void runAutoDirectorReplyDeveloperReport(prisma, reportId).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[director-ai] developer auto-reply error:", e);
    });
  }, delayMs);
}

async function runAutoDirectorReplySalesReport(prisma: PrismaClient, reportId: string): Promise<void> {
  // If Groq is not configured, do not post a canned/templated message.
  // We only want "ai_auto" replies when the AI provider is actually available.
  if (!getGroq()) return;

  const report = await prisma.salesReport.findUnique({
    where: { id: reportId },
    include: {
      submittedBy: { select: { name: true, email: true } },
      comments: {
        include: {
          author: { select: { name: true, email: true } },
          replies: { include: { author: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!report || report.status !== "submitted" || !report.submittedAt) return;

  const leadershipIds = await getDirectorAndAdminUserIds(prisma, report.orgId);
  if (leadershipIds.length === 0) return;

  const existingLeadershipComment = await prisma.salesReportComment.findFirst({
    where: {
      reportId,
      authorId: { in: leadershipIds },
      createdAt: { gte: report.submittedAt }
    }
  });
  if (existingLeadershipComment) return;

  const authorId = await pickDirectorAuthorId(prisma, report.orgId);
  if (!authorId) return;

  const teamMemberName = report.submittedBy?.name?.trim() || report.submittedBy?.email || "Team member";
  const threadContext = (report.comments ?? [])
    .filter((c) => !c.parentId)
    .map((c) => {
      const who = c.author?.name?.trim() || c.author?.email || c.authorId;
      const head = `[${c.createdAt.toISOString()}] ${who} (${c.kind}${c.source ? `, source=${c.source}` : ""}): ${c.content}`;
      const replies = (c.replies ?? []).map((r) => {
        const rWho = r.author?.name?.trim() || r.author?.email || r.authorId;
        return `  ↳ [${r.createdAt.toISOString()}] ${rWho} (${r.kind}${r.source ? `, source=${r.source}` : ""}): ${r.content}`;
      });
      return [head, ...replies].join("\n");
    })
    .join("\n\n");
  const userMsg = buildDirectorReplyUserSales({
    teamMemberName,
    reportTitle: report.title,
    reportBody: report.body,
    submittedAtIso: report.submittedAt.toISOString(),
    threadContext
  });

  const raw = await groqPlainText(DIRECTOR_REPLY_SYSTEM, userMsg, 900, 0.32);
  if (!raw) return;
  const content = ensureMarkedReviewed(raw.trim()).slice(0, 8000);

  await prisma.$transaction([
    prisma.salesReportComment.create({
      data: {
        reportId,
        authorId,
        kind: "comment",
        content,
        source: "ai_auto"
      }
    }),
    prisma.salesReport.update({
      where: { id: reportId },
      data: {
        reviewStatus: "viewed",
        reviewedAt: new Date(),
        reviewedById: authorId
      }
    })
  ]);
}

async function runAutoDirectorReplyDeveloperReport(prisma: PrismaClient, reportId: string): Promise<void> {
  // If Groq is not configured, do not write canned remarks.
  // Only generate remarks when the AI provider is actually available.
  if (!getGroq()) return;

  const report = await prisma.developerReport.findUnique({
    where: { id: reportId },
    include: { submittedBy: { select: { name: true, email: true } } }
  });
  if (!report) return;

  if (report.remarks?.trim()) return;
  if (report.reviewStatus === "checked") return;

  const authorId = await pickDirectorAuthorId(prisma, report.orgId);
  if (!authorId) return;

  if (report.reviewedById != null && report.reviewedById !== authorId) return;

  const teamMemberName = report.submittedBy?.name?.trim() || report.submittedBy?.email || "Team member";
  const reportDateIso = report.reportDate.toISOString().slice(0, 10);
  const dayStart = new Date(report.reportDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekStart = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Pull minimal “speed / deadlines” context from CresOS tasks & milestones.
  const devId = report.submittedById;
  const [tasksDay, tasksWeekDone, dueSoonTasks, overdueTasks, milestonesDueSoon, milestonesOverdue] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          orgId: report.orgId,
          deletedAt: null,
          assigneeId: devId,
          updatedAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          updatedAt: true,
          project: { select: { id: true, name: true, status: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 30
      }),
      prisma.task.count({
        where: {
          orgId: report.orgId,
          deletedAt: null,
          assigneeId: devId,
          status: "done",
          updatedAt: { gte: weekStart, lt: dayEnd }
        }
      }),
      prisma.task.findMany({
        where: {
          orgId: report.orgId,
          deletedAt: null,
          assigneeId: devId,
          status: { not: "done" },
          dueDate: { gte: now, lte: next7 }
        },
        select: {
          title: true,
          status: true,
          dueDate: true,
          project: { select: { name: true } }
        },
        orderBy: { dueDate: "asc" },
        take: 12
      }),
      prisma.task.findMany({
        where: {
          orgId: report.orgId,
          deletedAt: null,
          assigneeId: devId,
          status: { not: "done" },
          dueDate: { lt: now }
        },
        select: {
          title: true,
          status: true,
          dueDate: true,
          project: { select: { name: true } }
        },
        orderBy: { dueDate: "asc" },
        take: 12
      }),
      prisma.milestone.findMany({
        where: {
          orgId: report.orgId,
          deletedAt: null,
          status: { not: "completed" },
          dueDate: { gte: now, lte: next7 },
          project: {
            OR: [
              { assignedDeveloperId: devId },
              { developerAssignments: { some: { userId: devId, status: "accepted" } } }
            ]
          }
        },
        select: { name: true, status: true, dueDate: true, project: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 12
      }),
      prisma.milestone.findMany({
        where: {
          orgId: report.orgId,
          deletedAt: null,
          status: { not: "completed" },
          dueDate: { lt: now },
          project: {
            OR: [
              { assignedDeveloperId: devId },
              { developerAssignments: { some: { userId: devId, status: "accepted" } } }
            ]
          }
        },
        select: { name: true, status: true, dueDate: true, project: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 12
      })
    ]);

  const countsDay = tasksDay.reduce(
    (acc, t) => {
      const s = String(t.status || "").toLowerCase();
      if (s === "done") acc.done += 1;
      else if (s === "in_progress") acc.in_progress += 1;
      else if (s === "blocked") acc.blocked += 1;
      else acc.todo += 1;
      return acc;
    },
    { todo: 0, in_progress: 0, blocked: 0, done: 0 }
  );
  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

  const platformContext = [
    `Task activity on report day (by task.updatedAt, assignee=${devId}): ${countsDay.done} done, ${countsDay.in_progress} in progress, ${countsDay.blocked} blocked, ${countsDay.todo} todo (showing up to 30 recent).`,
    tasksDay.length
      ? tasksDay
          .slice(0, 12)
          .map((t) => `- [${fmtDate(t.updatedAt)}] ${t.project?.name ?? "Project"} — ${t.title} (${t.status})${t.dueDate ? ` due ${fmtDate(t.dueDate)}` : ""}`)
          .join("\n")
      : "No task updates recorded for this developer on that day.",
    "",
    `Throughput (approx): tasks marked done in last 7 days (by updatedAt): ${tasksWeekDone}.`,
    "",
    overdueTasks.length
      ? `Overdue tasks (not done):\n${overdueTasks
          .map((t) => `- ${t.project?.name ?? "Project"} — ${t.title} (${t.status}) due ${fmtDate(t.dueDate ?? null)}`)
          .join("\n")}`
      : "Overdue tasks (not done): none found.",
    "",
    dueSoonTasks.length
      ? `Due in next 7 days (tasks, not done):\n${dueSoonTasks
          .map((t) => `- ${t.project?.name ?? "Project"} — ${t.title} (${t.status}) due ${fmtDate(t.dueDate ?? null)}`)
          .join("\n")}`
      : "Due in next 7 days (tasks, not done): none found.",
    "",
    milestonesOverdue.length
      ? `Overdue milestones (not completed):\n${milestonesOverdue
          .map((m) => `- ${m.project?.name ?? "Project"} — ${m.name} (${m.status}) due ${fmtDate(m.dueDate ?? null)}`)
          .join("\n")}`
      : "Overdue milestones (not completed): none found.",
    "",
    milestonesDueSoon.length
      ? `Milestones due in next 7 days (not completed):\n${milestonesDueSoon
          .map((m) => `- ${m.project?.name ?? "Project"} — ${m.name} (${m.status}) due ${fmtDate(m.dueDate ?? null)}`)
          .join("\n")}`
      : "Milestones due in next 7 days (not completed): none found."
  ].join("\n");

  const userMsg = buildDirectorReplyUserDeveloper({
    teamMemberName,
    reportDateIso,
    whatWorked: report.whatWorked,
    blockers: report.blockers,
    needsAttention: report.needsAttention,
    implemented: report.implemented,
    pending: report.pending,
    nextPlan: report.nextPlan,
    platformContext
  });

  const raw = await groqPlainText(DIRECTOR_REPLY_SYSTEM, userMsg, 900, 0.32);
  if (!raw) return;
  const remarks = ensureMarkedReviewed(raw.trim()).slice(0, 8000);

  await prisma.developerReport.update({
    where: { id: reportId },
    data: {
      remarks,
      reviewStatus: "viewed",
      reviewedAt: new Date(),
      reviewedById: authorId
    }
  });
}

async function listRoleMembers(
  prisma: PrismaClient,
  orgId: string,
  roleKey: string
): Promise<{ id: string; name: string | null; email: string }[]> {
  const memberIds = new Set(
    (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId)
  );
  const role = await prisma.role.findFirst({ where: { orgId, key: roleKey }, select: { id: true } });
  if (!role) return [];
  const userIds = (await prisma.userRole.findMany({ where: { roleId: role.id }, select: { userId: true } }))
    .map((r) => r.userId)
    .filter((id) => memberIds.has(id));
  if (userIds.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true, name: true, email: true }
  });
}

/**
 * Rich end-of-day briefing (Prompt B). Returns null if Groq is unavailable or disabled.
 */
export async function generateDirectorBriefingGroq(
  prisma: PrismaClient,
  orgId: string,
  dateKey: string,
  range: { start: Date; end: Date }
): Promise<string | null> {
  if (!BRIEFING_GROQ_ENABLED) return null;
  if (!getGroq()) return null;

  const [salesReports, devReports, salesMembers, devMembers] = await Promise.all([
    prisma.salesReport.findMany({
      where: { orgId, status: "submitted", submittedAt: { gte: range.start, lt: range.end } },
      orderBy: { submittedAt: "asc" },
      include: { submittedBy: { select: { id: true, name: true, email: true } } }
    }),
    prisma.developerReport.findMany({
      where: { orgId, reportDate: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: "asc" },
      include: { submittedBy: { select: { id: true, name: true, email: true } } }
    }),
    listRoleMembers(prisma, orgId, ROLE_KEYS.sales),
    listRoleMembers(prisma, orgId, ROLE_KEYS.developer)
  ]);

  const salesSubmittedIds = new Set(salesReports.map((r) => r.submittedById));
  const devSubmittedIds = new Set(devReports.map((r) => r.submittedById));

  const platformActionsRaw = await listPlatformActionsForZonedDay(prisma, orgId, dateKey, DEFAULT_ORG_DAY_TZ, {
    order: "asc",
    activityLimit: 200,
    eventLimit: 120,
    maxRows: 200
  });
  const platform_actions = platformActionsRaw.slice(0, 100).map((r) => ({
    at: r.createdAt,
    source: r.source,
    type: r.type,
    summary: r.summary.slice(0, 280),
    actor: r.actorLabel,
    detail: r.detail ? String(r.detail).slice(0, 220) : undefined
  }));

  const payload = {
    dateKey,
    orgId,
    sales_reports_today: salesReports.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      submittedBy: r.submittedBy?.name || r.submittedBy?.email || r.submittedById,
      reviewStatus: r.reviewStatus,
      remarks: r.remarks
    })),
    developer_reports_today: devReports.map((r) => ({
      id: r.id,
      reportDate: r.reportDate.toISOString().slice(0, 10),
      submittedBy: r.submittedBy?.name || r.submittedBy?.email || r.submittedById,
      whatWorked: r.whatWorked,
      blockers: r.blockers,
      needsAttention: r.needsAttention,
      implemented: r.implemented,
      pending: r.pending,
      nextPlan: r.nextPlan,
      reviewStatus: r.reviewStatus,
      remarks: r.remarks
    })),
    expected_sales_submitters: salesMembers.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      submitted: salesSubmittedIds.has(u.id)
    })),
    expected_developer_submitters: devMembers.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      submitted: devSubmittedIds.has(u.id)
    })),
    platform_actions
  };

  const user = buildDirectorBriefingUser(JSON.stringify(payload, null, 2));
  const body = await groqPlainText(DIRECTOR_BRIEFING_SYSTEM, user, 4096, 0.35);
  return body;
}
