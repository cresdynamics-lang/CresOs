import type { PrismaClient } from "@prisma/client";
import { logAssistantSession } from "./assistant-session";
import type { AssistantSseWriter } from "./assistant-sse";
import { buildOnboardingContextBlock } from "./onboarding-context";
import { getOnboardingPlaybook } from "./onboarding-playbooks";
import { groqChatStreamWithFallback } from "./groq-chat-stream";
import { listGroqApiKeys } from "./groq-model";
import { runOnboardingChat } from "./onboarding-intent";
import {
  audienceLabel,
  type OnboardingAudience
} from "./onboarding-role-scope";

/** Onboarding stream microservice — analyzing → knowledge → writing tokens. */
export async function streamOnboardingChat(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  audience: OnboardingAudience,
  message: string,
  sse: AssistantSseWriter
): Promise<void> {
  const trimmed = message.trim();
  const playbook = getOnboardingPlaybook(audience);

  if (!trimmed) {
    sse.error("message is required");
    sse.end();
    return;
  }

  try {
    sse.status("queued", "Onboarding request received…");
    sse.status("analyzing", `Loading ${audienceLabel(audience)} playbook…`);

    if (!listGroqApiKeys().length) {
      const fallback = await runOnboardingChat(prisma, orgId, audience, trimmed);
      sse.status("writing", "Writing onboarding reply…");
      for (const word of fallback.reply.split(/(\s+)/)) {
        if (word) {
          sse.token(word);
          await delay(10);
        }
      }
      const sessionId = await logAssistantSession(prisma, {
        orgId,
        userId,
        assistantKind: "onboarding",
        mode: "intelligence",
        focus: audience,
        message: trimmed,
        reply: fallback.reply,
        aiGenerated: false
      });
      sse.done({
        audience,
        reply: fallback.reply,
        aiGenerated: false,
        suggestedQuestions: fallback.suggestedQuestions,
        contactRules: fallback.contactRules,
        sessionId
      });
      sse.end();
      return;
    }

    sse.status("knowledge", "Reading role-scoped knowledge pool…");
    const { contextBlock, poolEmpty } = await buildOnboardingContextBlock(
      prisma,
      orgId,
      audience,
      trimmed
    );

    sse.status("thinking", "Drafting role guidance…");
    sse.status("writing", "Writing reply…");

    const system = `You are CresOS Onboarding Coach for Cres Dynamics.
Audience: ${audienceLabel(audience)} (${audience}).
${audience === "admin" ? "Admin may see org-wide knowledge." : "Stay within this role's playbook + role-scoped knowledge."}
Lead with expectations, then "when X → go to Y".
Use markdown. Do not wrap in JSON.
${poolEmpty ? "Knowledge pool is thin — lean on the playbook." : ""}`;

    let reply = "";
    for await (const chunk of groqChatStreamWithFallback({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Question:\n${trimmed}\n\n--- CONTEXT ---\n${contextBlock}`
        }
      ],
      max_tokens: 1600,
      temperature: 0.35
    })) {
      if (chunk.type === "token") {
        reply += chunk.text;
        sse.token(chunk.text);
      }
    }

    const sessionId = await logAssistantSession(prisma, {
      orgId,
      userId,
      assistantKind: "onboarding",
      mode: "intelligence",
      focus: audience,
      message: trimmed,
      reply,
      aiGenerated: true
    });

    sse.status("done", "Complete");
    sse.done({
      audience,
      reply,
      aiGenerated: true,
      suggestedQuestions: playbook.suggestedQuestions,
      contactRules: playbook.contactRules.map((r) => ({ when: r.when, goTo: r.goTo })),
      sessionId
    });
    sse.end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onboarding stream failed";
    // eslint-disable-next-line no-console
    console.error("[onboarding-stream]", e);
    sse.error(msg);
    sse.end();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
