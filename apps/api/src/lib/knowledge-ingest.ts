import type { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

export type KnowledgeSourceType =
  | "event_log"
  | "admin_activity"
  | "message"
  | "planning_note"
  | "pm_check_in"
  | "developer_report"
  | "task_comment";

export type KnowledgeKind = "action" | "conversation" | "plan" | "report" | "check_in";

export type IngestKnowledgeInput = {
  orgId: string;
  sourceType: KnowledgeSourceType | string;
  sourceId: string;
  kind: KnowledgeKind | string;
  content: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
  projectId?: string | null;
  userId?: string | null;
  actorId?: string | null;
};

function contentHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex").slice(0, 32);
}

/** Idempotent upsert into the org knowledge pool. */
export async function ingestKnowledgeChunk(prisma: PrismaClient, input: IngestKnowledgeInput): Promise<void> {
  const content = input.content?.trim();
  if (!content || content.length < 2) return;

  const title = input.title?.trim() || null;
  const hash = contentHash(content);

  await prisma.knowledgeChunk.upsert({
    where: {
      orgId_sourceType_sourceId: {
        orgId: input.orgId,
        sourceType: input.sourceType,
        sourceId: input.sourceId
      }
    },
    create: {
      orgId: input.orgId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      kind: input.kind,
      title,
      content: content.slice(0, 50_000),
      metadata: {
        ...(input.metadata ?? {}),
        contentHash: hash
      },
      occurredAt: input.occurredAt,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      actorId: input.actorId ?? null
    },
    update: {
      kind: input.kind,
      title,
      content: content.slice(0, 50_000),
      metadata: {
        ...(input.metadata ?? {}),
        contentHash: hash
      },
      occurredAt: input.occurredAt,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      actorId: input.actorId ?? null,
      indexedAt: new Date()
    }
  });
}

/** Fire-and-forget helper — never throws to callers. */
export function ingestKnowledgeChunkAsync(prisma: PrismaClient, input: IngestKnowledgeInput): void {
  void ingestKnowledgeChunk(prisma, input).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[knowledge] ingest failed:", input.sourceType, input.sourceId, e);
  });
}

export async function ingestKnowledgeFromMessage(prisma: PrismaClient, messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      conversation: { select: { id: true, orgId: true, projectId: true, name: true, type: true } }
    }
  });
  if (!message || message.deletedAt || message.revokedAt) return;
  if (!message.content?.trim() || message.type === "deleted") return;

  const conv = message.conversation;
  const senderLabel = message.sender?.name?.trim() || message.sender?.email || "User";
  const convLabel = conv.name?.trim() || conv.type;
  const title = `${convLabel}: ${senderLabel}`;
  const meta = message.metadata as Record<string, unknown> | null;

  await ingestKnowledgeChunk(prisma, {
    orgId: conv.orgId,
    sourceType: "message",
    sourceId: message.id,
    kind: "conversation",
    title,
    content: message.content.trim(),
    metadata: {
      conversationId: conv.id,
      conversationType: conv.type,
      messageType: message.type,
      ...(meta?.roleCheckIn ? { roleCheckIn: true } : {}),
      ...(meta?.pmCheckIn ? { pmCheckIn: true } : {})
    },
    occurredAt: message.createdAt,
    projectId: conv.projectId,
    actorId: message.senderId
  });
}
