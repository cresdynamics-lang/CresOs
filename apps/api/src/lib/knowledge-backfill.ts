import type { PrismaClient } from "@prisma/client";
import { enrichPlatformEventSummaries } from "./platform-event-summary";
import { ingestKnowledgeChunk } from "./knowledge-ingest";
import { ingestKnowledgeFromEventLog } from "./knowledge-from-event";
import {
  ingestKnowledgeFromDeveloperReportComment,
  ingestKnowledgeFromSalesReportComment,
  ingestKnowledgeFromTaskComment
} from "./knowledge-realtime";

const BATCH = 250;

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p?.trim()).join("\n\n");
}

export type KnowledgeSyncResult = {
  ingested: number;
  bySource: Record<string, number>;
};

export type KnowledgeSyncOptions = {
  /** 0 = entire history */
  sinceDays?: number;
};

function sinceDate(sinceDays?: number): Date | undefined {
  if (sinceDays === 0) return undefined;
  const days = sinceDays ?? 3650;
  return new Date(Date.now() - days * 86_400_000);
}

async function paginateIds<T extends { id: string }>(
  fetch: (cursor: string | undefined) => Promise<T[]>,
  onBatch: (rows: T[]) => Promise<void>
): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await fetch(cursor);
    if (rows.length === 0) break;
    await onBatch(rows);
    count += rows.length;
    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  return count;
}

export async function syncOrgKnowledgePool(
  prisma: PrismaClient,
  orgId: string,
  options?: KnowledgeSyncOptions
): Promise<KnowledgeSyncResult> {
  const since = sinceDate(options?.sinceDays);
  const sinceFilter = since ? { gte: since } : undefined;
  const bySource: Record<string, number> = {};
  let ingested = 0;

  const bump = (source: string, n = 1) => {
    bySource[source] = (bySource[source] ?? 0) + n;
    ingested += n;
  };

  // —— Event log (all project/task/milestone/finance actions) ——
  await paginateIds(
    (cursor) =>
      prisma.eventLog.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (events) => {
      for (const e of events) {
        await ingestKnowledgeFromEventLog(prisma, e.id);
        bump("event_log");
      }
    }
  );

  // —— Admin activity ——
  await paginateIds(
    (cursor) =>
      prisma.adminActivityMessage.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const row of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "admin_activity",
          sourceId: row.id,
          kind: "action",
          title: row.summary,
          content: joinParts([row.summary, row.body]),
          metadata: { type: row.type, entityType: row.entityType, entityId: row.entityId },
          occurredAt: row.createdAt,
          actorId: row.actorId
        });
        bump("admin_activity");
      }
    }
  );

  // —— Community messages ——
  await paginateIds(
    (cursor) =>
      prisma.message.findMany({
        where: {
          deletedAt: null,
          revokedAt: null,
          conversation: { orgId },
          ...(sinceFilter ? { createdAt: sinceFilter } : {})
        },
        orderBy: { id: "asc" },
        take: BATCH,
        include: {
          sender: { select: { id: true, name: true, email: true } },
          conversation: { select: { id: true, projectId: true, name: true, type: true } }
        },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (messages) => {
      for (const m of messages) {
        if (!m.content?.trim()) continue;
        const senderLabel = m.sender?.name?.trim() || m.sender?.email || "User";
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "message",
          sourceId: m.id,
          kind: "conversation",
          title: `${m.conversation.name || m.conversation.type}: ${senderLabel}`,
          content: m.content.trim(),
          metadata: { conversationId: m.conversation.id, conversationType: m.conversation.type },
          occurredAt: m.createdAt,
          projectId: m.conversation.projectId,
          actorId: m.senderId
        });
        bump("message");
      }
    }
  );

  // —— Task comments (dev/sales updates on tasks) ——
  await paginateIds(
    (cursor) =>
      prisma.taskComment.findMany({
        where: { orgId, deletedAt: null, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const row of rows) {
        await ingestKnowledgeFromTaskComment(prisma, row.id);
        bump("task_comment");
      }
    }
  );

  // —— Projects (current scope snapshot) ——
  const projects = await prisma.project.findMany({
    where: { orgId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      projectDetails: true,
      successCriteria: true,
      agileSprintNotes: true,
      updatedAt: true,
      createdByUserId: true
    }
  });
  for (const p of projects) {
    const content = joinParts([
      `Project: ${p.name}`,
      `Status: ${p.status}`,
      p.projectDetails,
      p.successCriteria ? `Success criteria: ${p.successCriteria}` : null,
      p.agileSprintNotes ? `Sprint notes: ${p.agileSprintNotes}` : null
    ]);
    if (!content.trim()) continue;
    await ingestKnowledgeChunk(prisma, {
      orgId,
      sourceType: "project_snapshot",
      sourceId: p.id,
      kind: "plan",
      title: `Project: ${p.name}`,
      content,
      metadata: { status: p.status },
      occurredAt: p.updatedAt,
      projectId: p.id,
      actorId: p.createdByUserId
    });
    bump("project_snapshot");
  }

  // —— Tasks (delivery items) ——
  await paginateIds(
    (cursor) =>
      prisma.task.findMany({
        where: { orgId, deletedAt: null, ...(sinceFilter ? { updatedAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { project: { select: { name: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (tasks) => {
      for (const t of tasks) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "task",
          sourceId: t.id,
          kind: "action",
          title: `Task: ${t.title}`,
          content: joinParts([
            `Project: ${t.project?.name ?? "—"}`,
            `Status: ${t.status}`,
            t.description,
            t.blockedReason ? `Blocked: ${t.blockedReason}` : null,
            t.priority ? `Priority: ${t.priority}` : null
          ]),
          metadata: { status: t.status, projectId: t.projectId },
          occurredAt: t.updatedAt,
          projectId: t.projectId,
          actorId: t.assigneeId
        });
        bump("task");
      }
    }
  );

  // —— Milestones ——
  await paginateIds(
    (cursor) =>
      prisma.milestone.findMany({
        where: { orgId, deletedAt: null, ...(sinceFilter ? { updatedAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { project: { select: { name: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const m of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "milestone",
          sourceId: m.id,
          kind: "action",
          title: `Milestone: ${m.name}`,
          content: joinParts([
            `Project: ${m.project?.name ?? "—"}`,
            `Status: ${m.status}`,
            m.acceptanceCriteria,
            m.completionNotes
          ]),
          metadata: { status: m.status, projectId: m.projectId },
          occurredAt: m.updatedAt,
          projectId: m.projectId
        });
        bump("milestone");
      }
    }
  );

  // —— Planning notes ——
  await paginateIds(
    (cursor) =>
      prisma.projectPlanningNote.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (notes) => {
      for (const n of notes) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "planning_note",
          sourceId: n.id,
          kind: "plan",
          title: n.aiSummary?.slice(0, 120) || `Planning (${n.source})`,
          content: joinParts([n.aiSummary, n.rawText?.slice(0, 12_000)]),
          metadata: { source: n.source, authorRole: n.authorRole, fileName: n.fileName },
          occurredAt: n.createdAt,
          projectId: n.projectId,
          actorId: n.authorUserId
        });
        bump("planning_note");
      }
    }
  );

  // —— PM check-ins ——
  await paginateIds(
    (cursor) =>
      prisma.pmDeveloperCheckIn.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { project: { select: { name: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const c of rows) {
        const answers =
          c.answersJson && typeof c.answersJson === "object" ? JSON.stringify(c.answersJson) : "";
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "pm_check_in",
          sourceId: c.id,
          kind: "check_in",
          title: `Check-in: ${c.project?.name ?? "project"}`,
          content: joinParts([c.message, answers, c.response]),
          metadata: { status: c.status, senderRole: c.senderRole },
          occurredAt: c.respondedAt ?? c.createdAt,
          projectId: c.projectId,
          userId: c.developerId,
          actorId: c.sentById
        });
        bump("pm_check_in");
      }
    }
  );

  // —— Developer reports + comments ——
  await paginateIds(
    (cursor) =>
      prisma.developerReport.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (reports) => {
      for (const r of reports) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "developer_report",
          sourceId: r.id,
          kind: "report",
          title: `Developer report ${r.reportDate.toISOString().slice(0, 10)}`,
          content: joinParts([r.implemented, r.pending, r.blockers, r.needsAttention, r.whatWorked, r.nextPlan, r.remarks]),
          metadata: { reportDate: r.reportDate.toISOString(), reviewStatus: r.reviewStatus },
          occurredAt: r.createdAt,
          userId: r.submittedById,
          actorId: r.submittedById
        });
        bump("developer_report");
      }
    }
  );

  await paginateIds(
    (cursor) =>
      prisma.developerReportComment.findMany({
        where: {
          report: { orgId },
          ...(sinceFilter ? { createdAt: sinceFilter } : {})
        },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const row of rows) {
        await ingestKnowledgeFromDeveloperReportComment(prisma, row.id);
        bump("developer_report_comment");
      }
    }
  );

  // —— Sales reports + comments ——
  await paginateIds(
    (cursor) =>
      prisma.salesReport.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const r of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "sales_report",
          sourceId: r.id,
          kind: "report",
          title: r.title,
          content: joinParts([r.title, r.body, r.remarks]),
          metadata: { status: r.status, reviewStatus: r.reviewStatus },
          occurredAt: r.submittedAt ?? r.createdAt,
          actorId: r.submittedById
        });
        bump("sales_report");
      }
    }
  );

  await paginateIds(
    (cursor) =>
      prisma.salesReportComment.findMany({
        where: {
          report: { orgId },
          ...(sinceFilter ? { createdAt: sinceFilter } : {})
        },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const row of rows) {
        await ingestKnowledgeFromSalesReportComment(prisma, row.id);
        bump("sales_report_comment");
      }
    }
  );

  // —— Director reports ——
  await paginateIds(
    (cursor) =>
      prisma.directorReport.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const r of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "director_report",
          sourceId: r.id,
          kind: "report",
          title: r.title,
          content: joinParts([r.title, r.body, r.remarks]),
          metadata: { status: r.status, reviewStatus: r.reviewStatus },
          occurredAt: r.submittedAt ?? r.createdAt,
          actorId: r.submittedById
        });
        bump("director_report");
      }
    }
  );

  // —— CRM: lead comments & activities ——
  await paginateIds(
    (cursor) =>
      prisma.leadComment.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { lead: { select: { title: true } }, author: { select: { name: true, email: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const c of rows) {
        const who = c.author?.name?.trim() || c.author?.email || "Sales";
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "lead_comment",
          sourceId: c.id,
          kind: "conversation",
          title: `Lead ${c.lead?.title ?? ""}: comment`,
          content: `${who}: ${c.content.trim()}`,
          metadata: { leadId: c.leadId },
          occurredAt: c.createdAt,
          actorId: c.authorId
        });
        bump("lead_comment");
      }
    }
  );

  await paginateIds(
    (cursor) =>
      prisma.leadActivity.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { lead: { select: { title: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const a of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "lead_activity",
          sourceId: a.id,
          kind: "action",
          title: `Lead activity: ${a.type}`,
          content: `${a.lead?.title ?? "Lead"}: ${a.summary}`,
          metadata: { leadId: a.leadId, type: a.type },
          occurredAt: a.occurredAt,
        });
        bump("lead_activity");
      }
    }
  );

  await paginateIds(
    (cursor) =>
      prisma.dealActivity.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { deal: { select: { title: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const a of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "deal_activity",
          sourceId: a.id,
          kind: "action",
          title: `Deal activity: ${a.type}`,
          content: `${a.deal?.title ?? "Deal"}: ${a.summary}`,
          metadata: { dealId: a.dealId, type: a.type },
          occurredAt: a.occurredAt
        });
        bump("deal_activity");
      }
    }
  );

  // —— Email threads ——
  await paginateIds(
    (cursor) =>
      prisma.emailThread.findMany({
        where: { orgId, ...(sinceFilter ? { receivedAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const e of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "email_thread",
          sourceId: e.id,
          kind: "conversation",
          title: `Email: ${e.subject}`,
          content: joinParts([
            `From: ${e.fromName || e.fromEmail}`,
            `Subject: ${e.subject}`,
            e.body?.slice(0, 12_000),
            e.draftReply ? `Draft reply: ${e.draftReply.slice(0, 2000)}` : null
          ]),
          metadata: { fromEmail: e.fromEmail, status: e.status, senderType: e.senderType },
          occurredAt: e.receivedAt
        });
        bump("email_thread");
      }
    }
  );

  // —— Meeting requests ——
  await paginateIds(
    (cursor) =>
      prisma.meetingRequest.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const m of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "meeting_request",
          sourceId: m.id,
          kind: "action",
          title: `Meeting request (${m.status})`,
          content: joinParts([m.reason, m.responseNote, m.adminComment]),
          metadata: { status: m.status },
          occurredAt: m.respondedAt ?? m.createdAt,
          actorId: m.requestedById
        });
        bump("meeting_request");
      }
    }
  );

  // —— Director communications ——
  await paginateIds(
    (cursor) =>
      prisma.directorCommunication.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const d of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "director_communication",
          sourceId: d.id,
          kind: "action",
          title: `Director: ${d.type}`,
          content: d.message,
          metadata: { type: d.type, entityType: d.entityType, entityId: d.entityId },
          occurredAt: d.createdAt,
          actorId: d.fromUserId,
          userId: d.toUserId
        });
        bump("director_communication");
      }
    }
  );

  // —— Change requests ——
  await paginateIds(
    (cursor) =>
      prisma.changeRequest.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const c of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "change_request",
          sourceId: c.id,
          kind: "action",
          title: `Change request (${c.status})`,
          content: joinParts([c.description, c.impact ? `Impact: ${c.impact}` : null]),
          metadata: { status: c.status, taskId: c.taskId },
          occurredAt: c.decidedAt ?? c.createdAt,
          projectId: c.projectId,
          actorId: c.createdByUserId
        });
        bump("change_request");
      }
    }
  );

  // —— Project handoffs ——
  await paginateIds(
    (cursor) =>
      prisma.projectHandoffRequest.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        include: { project: { select: { name: true } } },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const h of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "project_handoff",
          sourceId: h.id,
          kind: "action",
          title: `Handoff: ${h.project?.name ?? "project"} (${h.status})`,
          content: `Developer handoff request — status ${h.status}`,
          metadata: { status: h.status, fromUserId: h.fromUserId, toUserId: h.toUserId },
          occurredAt: h.respondedAt ?? h.createdAt,
          projectId: h.projectId,
          actorId: h.fromUserId
        });
        bump("project_handoff");
      }
    }
  );

  // —— Admin AI daily reports ——
  await paginateIds(
    (cursor) =>
      prisma.adminAiReport.findMany({
        where: { orgId, ...(sinceFilter ? { createdAt: sinceFilter } : {}) },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      }),
    async (rows) => {
      for (const r of rows) {
        await ingestKnowledgeChunk(prisma, {
          orgId,
          sourceType: "admin_ai_report",
          sourceId: r.id,
          kind: "report",
          title: `Daily AI digest ${r.dateKey}`,
          content: r.body,
          metadata: { dateKey: r.dateKey, subject: r.subject },
          occurredAt: r.createdAt
        });
        bump("admin_ai_report");
      }
    }
  );

  return { ingested, bySource };
}
