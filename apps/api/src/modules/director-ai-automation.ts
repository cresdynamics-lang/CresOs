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

async function buildUserDeliveryContext(prisma: PrismaClient, orgId: string, userId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId, deletedAt: null },
    select: {
      currentFocusProjectId: true,
      currentFocusNote: true,
      currentFocusUpdatedAt: true,
      currentFocusProject: {
        select: { id: true, name: true, status: true, approvalStatus: true, assignedDeveloperId: true }
      }
    }
  });

  const focusId = user?.currentFocusProjectId ?? null;
  const focusLine = (() => {
    if (!focusId || !user?.currentFocusProject) return "Current focus project: Not set.";
    const p = user.currentFocusProject;
    const note = user.currentFocusNote?.trim() ? ` | Note: ${user.currentFocusNote.trim()}` : "";
    const at = user.currentFocusUpdatedAt ? ` | Updated: ${user.currentFocusUpdatedAt.toISOString()}` : "";
    return `Current focus project: ${p.name} (status=${p.status}, approval=${p.approvalStatus})${note}${at}`;
  })();

  const projects = await prisma.project.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { assignedDeveloperId: userId },
        { createdByUserId: userId },
        { ownerUserId: userId },
        { developerAssignments: { some: { userId, status: "accepted" } } },
        ...(focusId ? [{ id: focusId }] : [])
      ]
    },
    select: { id: true, name: true, status: true, approvalStatus: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 8
  });

  const projectIds = projects.map((p) => p.id);
  const now = new Date();
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [taskCounts, overdueTasks, dueSoonTasks, overdueMilestones, dueSoonMilestones] = await Promise.all([
    projectIds.length
      ? prisma.task.groupBy({
          by: ["status"],
          where: { orgId, deletedAt: null, projectId: { in: projectIds }, assigneeId: userId },
          _count: { _all: true }
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.task.findMany({
          where: {
            orgId,
            deletedAt: null,
            projectId: { in: projectIds },
            assigneeId: userId,
            status: { not: "done" },
            dueDate: { lt: now }
          },
          select: { title: true, status: true, dueDate: true, project: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 8
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.task.findMany({
          where: {
            orgId,
            deletedAt: null,
            projectId: { in: projectIds },
            assigneeId: userId,
            status: { not: "done" },
            dueDate: { gte: now, lte: next7 }
          },
          select: { title: true, status: true, dueDate: true, project: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 8
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.milestone.findMany({
          where: {
            orgId,
            deletedAt: null,
            projectId: { in: projectIds },
            status: { not: "completed" },
            dueDate: { lt: now }
          },
          select: { name: true, status: true, dueDate: true, project: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 6
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.milestone.findMany({
          where: {
            orgId,
            deletedAt: null,
            projectId: { in: projectIds },
            status: { not: "completed" },
            dueDate: { gte: now, lte: next7 }
          },
          select: { name: true, status: true, dueDate: true, project: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 6
        })
      : Promise.resolve([])
  ]);

  const counts = taskCounts.reduce(
    (acc, row) => {
      const s = String((row as any).status ?? "").toLowerCase();
      const n = (row as any)._count?._all ?? 0;
      acc[s] = (acc[s] ?? 0) + n;
      return acc;
    },
    {} as Record<string, number>
  );
  const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");

  const projectLines = projects.length
    ? projects.map((p) => `- ${p.name} (status=${p.status}, approval=${p.approvalStatus})`).join("\n")
    : "No linked projects found for this user (by assignment/ownership/creation/current focus).";

  const overdueLines = overdueTasks.length
    ? overdueTasks
        .map((t) => `- ${t.project?.name ?? "Project"} — ${t.title} (${t.status}) due ${fmtDate(t.dueDate)}`)
        .join("\n")
    : "None found.";
  const dueSoonLines = dueSoonTasks.length
    ? dueSoonTasks
        .map((t) => `- ${t.project?.name ?? "Project"} — ${t.title} (${t.status}) due ${fmtDate(t.dueDate)}`)
        .join("\n")
    : "None found.";
  const msOverdueLines = overdueMilestones.length
    ? overdueMilestones
        .map((m) => `- ${m.project?.name ?? "Project"} — ${m.name} (${m.status}) due ${fmtDate(m.dueDate)}`)
        .join("\n")
    : "None found.";
  const msDueSoonLines = dueSoonMilestones.length
    ? dueSoonMilestones
        .map((m) => `- ${m.project?.name ?? "Project"} — ${m.name} (${m.status}) due ${fmtDate(m.dueDate)}`)
        .join("\n")
    : "None found.";

  return [
    "CresOS system context (for cross-checking this report):",
    focusLine,
    "",
    "Linked projects (recent):",
    projectLines,
    "",
    `Tasks (assigned to this user, linked projects): todo=${counts.todo ?? 0}, in_progress=${counts.in_progress ?? 0}, blocked=${counts.blocked ?? 0}, done=${counts.done ?? 0}`,
    "",
    "Overdue tasks (not done):",
    overdueLines,
    "",
    "Due in next 7 days (tasks, not done):",
    dueSoonLines,
    "",
    "Overdue milestones (not completed):",
    msOverdueLines,
    "",
    "Milestones due in next 7 days (not completed):",
    msDueSoonLines
  ].join("\n");
}

async function buildSalesPipelineContext(prisma: PrismaClient, orgId: string, userId: string): Promise<string> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [deals, leads, followUpsSoon] = await Promise.all([
    prisma.deal.findMany({
      where: { orgId, ownerId: userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        stage: true,
        value: true,
        currency: true,
        closeDate: true,
        updatedAt: true,
        lead: { select: { id: true, title: true, status: true } }
      }
    }),
    prisma.lead.findMany({
      where: { orgId, ownerId: userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, status: true, approvalStatus: true, updatedAt: true }
    }),
    prisma.leadFollowUp.findMany({
      where: { orgId, assignedToId: userId, scheduledAt: { gte: now, lte: next7 } },
      orderBy: { scheduledAt: "asc" },
      take: 6,
      select: {
        type: true,
        scheduledAt: true,
        lead: { select: { title: true, status: true } }
      }
    })
  ]);

  const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");

  const dealLines = deals.length
    ? deals
        .map((d) => {
          const leadTag = d.lead?.title ? ` | Lead: ${d.lead.title} (${d.lead.status})` : "";
          const val = d.value != null ? ` | Value: ${d.currency ?? "USD"} ${String(d.value)}` : "";
          const close = d.closeDate ? ` | Close: ${fmtDate(d.closeDate)}` : "";
          const stale = d.updatedAt < staleCutoff ? " | STALE (no update 7d+)" : "";
          return `- ${d.title} (stage=${d.stage})${val}${close}${leadTag}${stale}`;
        })
        .join("\n")
    : "No owned deals found.";

  const leadLines = leads.length
    ? leads
        .map((l) => {
          const stale = l.updatedAt < staleCutoff ? " | STALE (no update 7d+)" : "";
          return `- ${l.title} (status=${l.status}, approval=${l.approvalStatus})${stale}`;
        })
        .join("\n")
    : "No owned leads found.";

  const followUpLines = followUpsSoon.length
    ? followUpsSoon
        .map((f) => `- ${fmtDate(f.scheduledAt)} ${f.type} — ${f.lead?.title ?? "Lead"} (${f.lead?.status ?? "—"})`)
        .join("\n")
    : "No follow-ups scheduled in next 7 days.";

  return [
    "CresOS sales pipeline context (for cross-checking this report):",
    "Owned deals (recent):",
    dealLines,
    "",
    "Owned leads (recent):",
    leadLines,
    "",
    "Scheduled follow-ups (next 7 days):",
    followUpLines
  ].join("\n");
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
  const deliveryContext = await buildUserDeliveryContext(prisma, report.orgId, report.submittedById);
  const pipelineContext = await buildSalesPipelineContext(prisma, report.orgId, report.submittedById);
  const prev = await prisma.salesReport.findMany({
    where: {
      orgId: report.orgId,
      submittedById: report.submittedById,
      status: "submitted",
      submittedAt: { lt: report.submittedAt }
    },
    orderBy: { submittedAt: "desc" },
    take: 4,
    select: { id: true, title: true, body: true, submittedAt: true }
  });
  const previousReports = prev
    .map((r, idx) => {
      const when = r.submittedAt ? r.submittedAt.toISOString() : "unknown time";
      const flat = (r.body ?? "").replace(/\s+/g, " ").trim();
      const excerpt = flat.length > 1400 ? `${flat.slice(0, 1400)}…` : flat;
      return `#${idx + 1} [${when}] ${r.title}\n${excerpt}`;
    })
    .join("\n\n");
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
    threadContext,
    previousReports,
    platformContext: [deliveryContext, "", pipelineContext].filter(Boolean).join("\n")
  });

  const raw = await groqPlainText(DIRECTOR_REPLY_SYSTEM, userMsg, 1050, 0.32);
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
  const prevReports = await prisma.developerReport.findMany({
    where: {
      orgId: report.orgId,
      submittedById: devId,
      reportDate: { lt: dayStart }
    },
    orderBy: { reportDate: "desc" },
    take: 5,
    select: {
      id: true,
      reportDate: true,
      blockers: true,
      needsAttention: true,
      implemented: true,
      pending: true,
      nextPlan: true
    }
  });
  const previousReports = prevReports
    .map((r, idx) => {
      const dateKey = r.reportDate.toISOString().slice(0, 10);
      const compact = [
        r.implemented ? `Implemented: ${String(r.implemented).trim()}` : null,
        r.pending ? `Pending: ${String(r.pending).trim()}` : null,
        r.blockers ? `Blockers: ${String(r.blockers).trim()}` : null,
        r.needsAttention ? `Needs attention: ${String(r.needsAttention).trim()}` : null,
        r.nextPlan ? `Next plan: ${String(r.nextPlan).trim()}` : null
      ]
        .filter(Boolean)
        .join(" | ");
      const clipped = compact.length > 1200 ? `${compact.slice(0, 1200)}…` : compact || "No detail captured.";
      return `#${idx + 1} [${dateKey}] ${clipped}`;
    })
    .join("\n");
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
  const deliveryContext = await buildUserDeliveryContext(prisma, report.orgId, devId);

  const userMsg = buildDirectorReplyUserDeveloper({
    teamMemberName,
    reportDateIso,
    whatWorked: report.whatWorked,
    blockers: report.blockers,
    needsAttention: report.needsAttention,
    implemented: report.implemented,
    pending: report.pending,
    nextPlan: report.nextPlan,
    platformContext: [platformContext, "", deliveryContext].filter(Boolean).join("\n"),
    previousReports
  });

  const raw = await groqPlainText(DIRECTOR_REPLY_SYSTEM, userMsg, 1050, 0.32);
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
