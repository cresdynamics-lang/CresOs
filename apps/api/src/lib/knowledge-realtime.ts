import type { PrismaClient } from "@prisma/client";
import { ingestKnowledgeChunk } from "./knowledge-ingest";
import { ingestKnowledgeFromEventLog } from "./knowledge-from-event";

export async function ingestKnowledgeFromTaskComment(prisma: PrismaClient, commentId: string): Promise<void> {
  const c = await prisma.taskComment.findFirst({
    where: { id: commentId, deletedAt: null },
    include: {
      author: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true, projectId: true, project: { select: { name: true } } } }
    }
  });
  if (!c?.body?.trim()) return;
  const who = c.author?.name?.trim() || c.author?.email || "Team member";
  await ingestKnowledgeChunk(prisma, {
    orgId: c.orgId,
    sourceType: "task_comment",
    sourceId: c.id,
    kind: "conversation",
    title: `Task comment on ${c.task.title}`,
    content: `${who} (${c.type}, audience: ${c.audience ?? "all"}): ${c.body.trim()}`,
    metadata: {
      taskId: c.taskId,
      projectId: c.task.projectId,
      projectName: c.task.project?.name,
      commentType: c.type
    },
    occurredAt: c.createdAt,
    projectId: c.task.projectId,
    actorId: c.authorId
  });
}

export async function ingestKnowledgeFromDeveloperReportComment(
  prisma: PrismaClient,
  commentId: string
): Promise<void> {
  const c = await prisma.developerReportComment.findUnique({
    where: { id: commentId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      report: { select: { orgId: true } }
    }
  });
  if (!c?.content?.trim() || !c.report) return;
  const who = c.author?.name?.trim() || c.author?.email || "User";
  await ingestKnowledgeChunk(prisma, {
    orgId: c.report.orgId,
    sourceType: "developer_report_comment",
    sourceId: c.id,
    kind: "conversation",
    title: `Developer report ${c.kind}`,
    content: `${who}: ${c.content.trim()}`,
    metadata: { reportId: c.reportId, kind: c.kind, source: c.source },
    occurredAt: c.createdAt,
    actorId: c.authorId
  });
}

export async function ingestKnowledgeFromSalesReportComment(prisma: PrismaClient, commentId: string): Promise<void> {
  const c = await prisma.salesReportComment.findUnique({
    where: { id: commentId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      report: { select: { orgId: true, title: true } }
    }
  });
  if (!c?.content?.trim() || !c.report) return;
  const who = c.author?.name?.trim() || c.author?.email || "User";
  await ingestKnowledgeChunk(prisma, {
    orgId: c.report.orgId,
    sourceType: "sales_report_comment",
    sourceId: c.id,
    kind: "conversation",
    title: `Sales report ${c.kind}: ${c.report.title}`,
    content: `${who}: ${c.content.trim()}`,
    metadata: { reportId: c.reportId, kind: c.kind, source: c.source },
    occurredAt: c.createdAt,
    actorId: c.authorId
  });
}

export function attachKnowledgeRealtimeHooks(prisma: PrismaClient): PrismaClient {
  return prisma.$extends({
    query: {
      eventLog: {
        async create({ args, query }) {
          const result = await query(args);
          if (result?.id) void ingestKnowledgeFromEventLog(prisma, result.id).catch(() => {});
          return result;
        }
      },
      taskComment: {
        async create({ args, query }) {
          const result = await query(args);
          if (result?.id) void ingestKnowledgeFromTaskComment(prisma, result.id).catch(() => {});
          return result;
        }
      },
      developerReportComment: {
        async create({ args, query }) {
          const result = await query(args);
          if (result?.id) void ingestKnowledgeFromDeveloperReportComment(prisma, result.id).catch(() => {});
          return result;
        }
      },
      salesReportComment: {
        async create({ args, query }) {
          const result = await query(args);
          if (result?.id) void ingestKnowledgeFromSalesReportComment(prisma, result.id).catch(() => {});
          return result;
        }
      }
    }
  }) as unknown as PrismaClient;
}
