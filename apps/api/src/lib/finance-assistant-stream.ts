import type { PrismaClient } from "@prisma/client";
import { logAssistantSession } from "./assistant-session";
import type { AssistantSseWriter } from "./assistant-sse";
import { buildFinanceAssistantContextBlock } from "./finance-assistant-context";
import { groqChatStreamWithFallback } from "./groq-chat-stream";
import { listGroqApiKeys } from "./groq-model";
import { runFinanceAssistant } from "./finance-assistant-intent";
import type { FinanceAssistantMode } from "./finance-assistant-types";
import { enrichFinanceActionPreviews } from "./finance-assistant-preview";

/**
 * Finance stream orchestration microservice:
 * status phases → token stream (intelligence) or buffered JSON (execute) → done.
 */
export async function streamFinanceAssistant(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  options: { message: string; mode: FinanceAssistantMode },
  sse: AssistantSseWriter
): Promise<void> {
  const message = options.message.trim();
  const mode = options.mode;

  if (!message) {
    sse.error("message is required");
    sse.end();
    return;
  }

  try {
    sse.status("queued", "Request received…");
    sse.status("analyzing", "Understanding your finance question…");

    if (!listGroqApiKeys().length) {
      const fallback = await runFinanceAssistant(prisma, orgId, { message, mode });
      sse.status("writing", "Writing reply…");
      for (const word of fallback.reply.split(/(\s+)/)) {
        if (word) sse.token(word);
      }
      const sessionId = await logAssistantSession(prisma, {
        orgId,
        userId,
        assistantKind: "finance",
        mode,
        message,
        reply: fallback.reply,
        proposedActions: fallback.proposedActions,
        aiGenerated: false
      });
      sse.done({
        mode,
        reply: fallback.reply,
        aiGenerated: false,
        proposedActions: fallback.proposedActions ?? [],
        sessionId
      });
      sse.end();
      return;
    }

    sse.status("ledger", "Reading live expenses, payments, invoices & projects…");
    sse.status("knowledge", "Scanning finance-scoped knowledge pool…");
    const contextBlock = await buildFinanceAssistantContextBlock(prisma, orgId, message);

    // Execute mode needs structured JSON — buffer then emit reply tokens for UX.
    if (mode === "execute") {
      sse.status("thinking", "Parsing into expense/payment actions…");
      const result = await runFinanceAssistant(prisma, orgId, { message, mode });
      if (result.proposedActions?.length) {
        result.proposedActions = await enrichFinanceActionPreviews(
          prisma,
          orgId,
          result.proposedActions
        );
      }
      sse.status("writing", "Writing confirmation…");
      for (const word of result.reply.split(/(\s+)/)) {
        if (word) {
          sse.token(word);
          await delay(12);
        }
      }
      const sessionId = await logAssistantSession(prisma, {
        orgId,
        userId,
        assistantKind: "finance",
        mode,
        message,
        reply: result.reply,
        proposedActions: result.proposedActions,
        aiGenerated: result.aiGenerated
      });
      sse.done({
        mode,
        reply: result.reply,
        aiGenerated: result.aiGenerated,
        proposedActions: result.proposedActions ?? [],
        sessionId
      });
      sse.end();
      return;
    }

    // Intelligence — true token stream from Groq (markdown, not JSON wrapper).
    sse.status("thinking", "Composing answer from ledger + knowledge pool…");
    sse.status("writing", "Writing reply…");

    const system = `You are CresOS Finance Intelligence for Cres Dynamics.
Answer using ONLY the org finance context and knowledge pool excerpts provided.
Be concrete with amounts, dates, invoice numbers, and statuses when present.
Use short markdown paragraphs and bullets. Do not invent numbers.
If data is missing, say what is missing. Do not wrap the answer in JSON.`;

    const user = `Finance question:\n${message}\n\n--- ORG FINANCE + KNOWLEDGE CONTEXT ---\n${contextBlock}`;

    let reply = "";
    for await (const chunk of groqChatStreamWithFallback({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 1400,
      temperature: 0.3
    })) {
      if (chunk.type === "token") {
        reply += chunk.text;
        sse.token(chunk.text);
      }
    }

    const sessionId = await logAssistantSession(prisma, {
      orgId,
      userId,
      assistantKind: "finance",
      mode: "intelligence",
      message,
      reply,
      aiGenerated: true
    });

    sse.status("done", "Complete");
    sse.done({
      mode: "intelligence",
      reply,
      aiGenerated: true,
      proposedActions: [],
      sessionId
    });
    sse.end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Finance stream failed";
    // eslint-disable-next-line no-console
    console.error("[finance-stream]", e);
    sse.error(msg);
    sse.end();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
