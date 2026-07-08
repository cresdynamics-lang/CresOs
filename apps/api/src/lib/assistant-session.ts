import type { PrismaClient } from "@prisma/client";
import type { AdminAssistantResponse } from "./admin-assistant-types";
import type { FinanceAssistantResponse } from "./finance-assistant-types";

export type LogAssistantSessionInput = {
  orgId: string;
  userId: string;
  assistantKind: "admin" | "finance";
  mode: string;
  focus?: string | null;
  message: string;
  transcript?: string | null;
  reply?: string | null;
  proposedActions?: unknown;
  executedResults?: unknown;
  aiGenerated?: boolean;
};

export async function logAssistantSession(
  prisma: PrismaClient,
  input: LogAssistantSessionInput
): Promise<string> {
  const row = await prisma.assistantSession.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      assistantKind: input.assistantKind,
      mode: input.mode,
      focus: input.focus ?? null,
      message: input.message.slice(0, 8000),
      transcript: input.transcript?.slice(0, 8000) ?? null,
      reply: input.reply?.slice(0, 12000) ?? null,
      proposedActions: input.proposedActions ?? undefined,
      executedResults: input.executedResults ?? undefined,
      aiGenerated: input.aiGenerated ?? false
    },
    select: { id: true }
  });
  return row.id;
}

export async function listAssistantSessions(
  prisma: PrismaClient,
  orgId: string,
  options?: { userId?: string; assistantKind?: string; limit?: number }
) {
  const limit = Math.min(options?.limit ?? 20, 50);
  return prisma.assistantSession.findMany({
    where: {
      orgId,
      ...(options?.userId ? { userId: options.userId } : {}),
      ...(options?.assistantKind ? { assistantKind: options.assistantKind } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      assistantKind: true,
      mode: true,
      focus: true,
      message: true,
      reply: true,
      aiGenerated: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } }
    }
  });
}

export function adminResponseForSession(result: AdminAssistantResponse) {
  return {
    proposedActions: result.proposedActions,
    executedResults: undefined,
    reply: result.reply,
    aiGenerated: result.aiGenerated
  };
}

export function financeResponseForSession(result: FinanceAssistantResponse) {
  return {
    proposedActions: result.proposedActions,
    reply: result.reply,
    aiGenerated: result.aiGenerated
  };
}
