import type { PrismaClient } from "@prisma/client";
import { enrichPlatformEventSummaries } from "./platform-event-summary";
import { ingestKnowledgeChunk } from "./knowledge-ingest";

export async function ingestKnowledgeFromEventLog(prisma: PrismaClient, eventId: string): Promise<void> {
  const e = await prisma.eventLog.findUnique({ where: { id: eventId } });
  if (!e) return;

  const summaries = await enrichPlatformEventSummaries(prisma, [e]);
  const enriched = summaries.get(e.id);
  const content = enriched?.summary || `${e.type} on ${e.entityType}`;
  const meta = (e.metadata && typeof e.metadata === "object" ? e.metadata : {}) as Record<string, unknown>;

  let projectId: string | null = null;
  if (e.entityType === "project") projectId = e.entityId;
  if (e.entityType === "task") {
    const task = await prisma.task.findFirst({
      where: { id: e.entityId },
      select: { projectId: true }
    });
    projectId = task?.projectId ?? null;
  }
  if (e.entityType === "milestone") {
    const ms = await prisma.milestone.findFirst({
      where: { id: e.entityId },
      select: { projectId: true }
    });
    projectId = ms?.projectId ?? null;
  }

  await ingestKnowledgeChunk(prisma, {
    orgId: e.orgId,
    sourceType: "event_log",
    sourceId: e.id,
    kind: "action",
    title: e.type,
    content: enriched?.actorLabel ? `${enriched.actorLabel}: ${content}` : content,
    metadata: {
      entityType: e.entityType,
      entityId: e.entityId,
      type: e.type,
      ...meta
    },
    occurredAt: e.createdAt,
    projectId,
    actorId: e.actorId
  });
}
