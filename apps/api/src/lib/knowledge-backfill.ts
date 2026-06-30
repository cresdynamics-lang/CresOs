import type { PrismaClient } from "@prisma/client";
import { enrichPlatformEventSummaries } from "./platform-event-summary";
import { ingestKnowledgeChunk } from "./knowledge-ingest";

const BATCH = 200;

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p?.trim()).join("\n\n");
}

export type KnowledgeSyncResult = {
  ingested: number;
  bySource: Record<string, number>;
};

export async function syncOrgKnowledgePool(
  prisma: PrismaClient,
  orgId: string,
  options?: { sinceDays?: number }
): Promise<KnowledgeSyncResult> {
  const sinceDays = options?.sinceDays ?? 120;
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const bySource: Record<string, number> = {};
  let ingested = 0;

  const bump = (source: string) => {
    bySource[source] = (bySource[source] ?? 0) + 1;
    ingested += 1;
  };

  let eventCursor: string | undefined;
  for (;;) {
    const events = await prisma.eventLog.findMany({
      where: { orgId, createdAt: { gte: since } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(eventCursor ? { cursor: { id: eventCursor }, skip: 1 } : {})
    });
    if (events.length === 0) break;
    eventCursor = events[events.length - 1].id;

    const summaries = await enrichPlatformEventSummaries(prisma, events);
    for (const e of events) {
      const enriched = summaries.get(e.id);
      const content = enriched?.summary || `${e.type} on ${e.entityType}`;
      await ingestKnowledgeChunk(prisma, {
        orgId,
        sourceType: "event_log",
        sourceId: e.id,
        kind: "action",
        title: e.type,
        content: enriched?.actorLabel ? `${enriched.actorLabel}: ${content}` : content,
        metadata: { entityType: e.entityType, entityId: e.entityId, type: e.type },
        occurredAt: e.createdAt,
        actorId: e.actorId
      });
      bump("event_log");
    }
    if (events.length < BATCH) break;
  }

  let actCursor: string | undefined;
  for (;;) {
    const rows = await prisma.adminActivityMessage.findMany({
      where: { orgId, createdAt: { gte: since } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(actCursor ? { cursor: { id: actCursor }, skip: 1 } : {})
    });
    if (rows.length === 0) break;
    actCursor = rows[rows.length - 1].id;

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
    if (rows.length < BATCH) break;
  }

  let msgCursor: string | undefined;
  for (;;) {
    const messages = await prisma.message.findMany({
      where: {
        deletedAt: null,
        revokedAt: null,
        createdAt: { gte: since },
        conversation: { orgId }
      },
      orderBy: { id: "asc" },
      take: BATCH,
      include: {
        sender: { select: { id: true, name: true, email: true } },
        conversation: { select: { id: true, projectId: true, name: true, type: true } }
      },
      ...(msgCursor ? { cursor: { id: msgCursor }, skip: 1 } : {})
    });
    if (messages.length === 0) break;
    msgCursor = messages[messages.length - 1].id;

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
        metadata: {
          conversationId: m.conversation.id,
          conversationType: m.conversation.type
        },
        occurredAt: m.createdAt,
        projectId: m.conversation.projectId,
        actorId: m.senderId
      });
      bump("message");
    }
    if (messages.length < BATCH) break;
  }

  const notes = await prisma.projectPlanningNote.findMany({
    where: { orgId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  for (const n of notes) {
    await ingestKnowledgeChunk(prisma, {
      orgId,
      sourceType: "planning_note",
      sourceId: n.id,
      kind: "plan",
      title: n.aiSummary?.slice(0, 120) || `Planning (${n.source})`,
      content: joinParts([n.aiSummary, n.rawText?.slice(0, 8000)]),
      metadata: { source: n.source, authorRole: n.authorRole, fileName: n.fileName },
      occurredAt: n.createdAt,
      projectId: n.projectId,
      actorId: n.authorUserId
    });
    bump("planning_note");
  }

  const checkIns = await prisma.pmDeveloperCheckIn.findMany({
    where: { orgId, createdAt: { gte: since } },
    include: { project: { select: { name: true } } },
    take: 500
  });
  for (const c of checkIns) {
    const answers = c.answersJson && typeof c.answersJson === "object" ? JSON.stringify(c.answersJson) : "";
    await ingestKnowledgeChunk(prisma, {
      orgId,
      sourceType: "pm_check_in",
      sourceId: c.id,
      kind: "check_in",
      title: `Check-in: ${c.project?.name ?? "project"}`,
      content: joinParts([c.message, answers, c.response]),
      metadata: { status: c.status, developerUserId: c.developerId },
      occurredAt: c.respondedAt ?? c.createdAt,
      projectId: c.projectId,
      userId: c.developerId,
      actorId: c.sentById
    });
    bump("pm_check_in");
  }

  const reports = await prisma.developerReport.findMany({
    where: { orgId, createdAt: { gte: since } },
    take: 500
  });
  for (const r of reports) {
    await ingestKnowledgeChunk(prisma, {
      orgId,
      sourceType: "developer_report",
      sourceId: r.id,
      kind: "report",
      title: `Developer report ${r.reportDate.toISOString().slice(0, 10)}`,
      content: joinParts([r.implemented, r.pending, r.blockers, r.needsAttention, r.whatWorked, r.nextPlan]),
      metadata: { reportDate: r.reportDate.toISOString() },
      occurredAt: r.createdAt,
      userId: r.submittedById,
      actorId: r.submittedById
    });
    bump("developer_report");
  }

  return { ingested, bySource };
}
