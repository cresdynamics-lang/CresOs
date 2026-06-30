import type { PrismaClient } from "@prisma/client";
import { findOrgUsersForKnowledgeSearch } from "./knowledge-team-index";

export type KnowledgeContextOptions = {
  projectId?: string;
  sinceDays?: number;
  limit?: number;
  q?: string;
  sourceType?: string;
  kind?: string;
};

export type KnowledgeChunkRow = {
  id: string;
  kind: string;
  sourceType: string;
  title: string | null;
  content: string;
  occurredAt: Date;
  projectId: string | null;
  actorId: string | null;
  metadata: unknown;
};

export async function fetchKnowledgeChunksForUsers(
  prisma: PrismaClient,
  orgId: string,
  userIds: string[],
  options?: { sinceDays?: number; limit?: number }
): Promise<KnowledgeChunkRow[]> {
  if (userIds.length === 0) return [];
  const sinceDays = options?.sinceDays ?? 0;
  const since = sinceDays === 0 ? undefined : new Date(Date.now() - sinceDays * 86_400_000);
  const limit = Math.min(options?.limit ?? 60, 200);

  return prisma.knowledgeChunk.findMany({
    where: {
      orgId,
      ...(since ? { occurredAt: { gte: since } } : {}),
      OR: [{ actorId: { in: userIds } }, { userId: { in: userIds } }]
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      sourceType: true,
      title: true,
      content: true,
      occurredAt: true,
      projectId: true,
      actorId: true,
      metadata: true
    }
  });
}

export async function fetchKnowledgeChunks(
  prisma: PrismaClient,
  orgId: string,
  options?: KnowledgeContextOptions
): Promise<KnowledgeChunkRow[]> {
  const q = options?.q?.trim();
  const hasQuery = Boolean(q);
  const sinceDays = options?.sinceDays ?? (hasQuery ? 0 : 30);
  const since = sinceDays === 0 ? undefined : new Date(Date.now() - sinceDays * 86_400_000);
  const limit = Math.min(options?.limit ?? (hasQuery ? 80 : 40), 200);

  const matchedUsers = hasQuery && q ? await findOrgUsersForKnowledgeSearch(prisma, orgId, q) : [];
  const matchedUserIds = matchedUsers.map((u) => u.id);

  const textOr = q
    ? [
        { content: { contains: q, mode: "insensitive" as const } },
        { title: { contains: q, mode: "insensitive" as const } },
        { sourceType: { contains: q, mode: "insensitive" as const } },
        { kind: { contains: q, mode: "insensitive" as const } }
      ]
    : [];

  const searchOr =
    matchedUserIds.length > 0
      ? [...textOr, { actorId: { in: matchedUserIds } }, { userId: { in: matchedUserIds } }]
      : textOr;

  return prisma.knowledgeChunk.findMany({
    where: {
      orgId,
      ...(since ? { occurredAt: { gte: since } } : {}),
      ...(options?.projectId ? { projectId: options.projectId } : {}),
      ...(options?.sourceType ? { sourceType: options.sourceType } : {}),
      ...(options?.kind ? { kind: options.kind } : {}),
      ...(searchOr.length ? { OR: searchOr } : {})
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      sourceType: true,
      title: true,
      content: true,
      occurredAt: true,
      projectId: true,
      actorId: true,
      metadata: true
    }
  });
}

export async function getKnowledgePoolStats(prisma: PrismaClient, orgId: string) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [total, recent, byKind, bySource] = await Promise.all([
    prisma.knowledgeChunk.count({ where: { orgId } }),
    prisma.knowledgeChunk.count({ where: { orgId, occurredAt: { gte: since30 } } }),
    prisma.knowledgeChunk.groupBy({
      by: ["kind"],
      where: { orgId },
      _count: { _all: true }
    }),
    prisma.knowledgeChunk.groupBy({
      by: ["sourceType"],
      where: { orgId },
      _count: { _all: true }
    })
  ]);
  return {
    total,
    recent30Days: recent,
    byKind: Object.fromEntries(byKind.map((r) => [r.kind, r._count._all])),
    bySource: Object.fromEntries(bySource.map((r) => [r.sourceType, r._count._all]))
  };
}

/** Compact narrative block for Groq PM / director prompts. */
export async function buildKnowledgeContextBlock(
  prisma: PrismaClient,
  orgId: string,
  options?: KnowledgeContextOptions
): Promise<string> {
  const chunks = await fetchKnowledgeChunks(prisma, orgId, { ...options, limit: options?.limit ?? 25 });
  if (chunks.length === 0) {
    return "No indexed knowledge yet — run knowledge sync to ingest actions and conversations.";
  }

  const actorIds = [...new Set(chunks.map((c) => c.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true }
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.id, a.name?.trim() || a.email || "User"]));

  const lines = chunks.map((c) => {
    const when = c.occurredAt.toISOString().slice(0, 16).replace("T", " ");
    const who = c.actorId ? actorMap.get(c.actorId) ?? "someone" : "system";
    const label = c.title?.trim() || c.kind;
    const body = c.content.length > 400 ? `${c.content.slice(0, 400)}…` : c.content;
    return `[${when}] (${c.kind}/${c.sourceType}) ${who} — ${label}: ${body}`;
  });

  return lines.join("\n");
}
