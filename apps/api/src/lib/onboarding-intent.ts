import type { PrismaClient } from "@prisma/client";
import { groqChatWithFallback } from "./groq-chat-fallback";
import { listGroqApiKeys } from "./groq-model";
import { buildOnboardingContextBlock } from "./onboarding-context";
import { getOnboardingPlaybook } from "./onboarding-playbooks";
import {
  audienceLabel,
  type OnboardingAudience
} from "./onboarding-role-scope";

export type OnboardingChatResponse = {
  audience: OnboardingAudience;
  reply: string;
  aiGenerated: boolean;
  suggestedQuestions: string[];
  contactRules: { when: string; goTo: string }[];
  sessionId?: string;
};

function hasGroqKeys(): boolean {
  return listGroqApiKeys().length > 0;
}

function parseJsonFromModel(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() || trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1));
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function fallbackReply(audience: OnboardingAudience, message: string): OnboardingChatResponse {
  const playbook = getOnboardingPlaybook(audience);
  const expectations = playbook.expectations.map((e, i) => `${i + 1}. ${e}`).join("\n");
  const contacts = playbook.contactRules.map((r) => `• When ${r.when} → ${r.goTo}`).join("\n");
  return {
    audience,
    reply:
      `**${audienceLabel(audience)} playbook**\n\n` +
      `Expected:\n${expectations}\n\n` +
      `When → who:\n${contacts}`,
    aiGenerated: false,
    suggestedQuestions: playbook.suggestedQuestions,
    contactRules: playbook.contactRules.map((r) => ({ when: r.when, goTo: r.goTo }))
  };
}

export async function runOnboardingChat(
  prisma: PrismaClient,
  orgId: string,
  audience: OnboardingAudience,
  message: string
): Promise<OnboardingChatResponse> {
  const trimmed = message.trim();
  const playbook = getOnboardingPlaybook(audience);
  if (!trimmed) {
    return {
      audience,
      reply: playbook.summary,
      aiGenerated: false,
      suggestedQuestions: playbook.suggestedQuestions,
      contactRules: playbook.contactRules.map((r) => ({ when: r.when, goTo: r.goTo }))
    };
  }

  if (!hasGroqKeys()) return fallbackReply(audience, trimmed);

  const { contextBlock, poolEmpty } = await buildOnboardingContextBlock(
    prisma,
    orgId,
    audience,
    trimmed
  );

  const system = `You are the Cres Dynamics Playbook assistant in CresOS.
You answer ROLE questions for: ${audienceLabel(audience)} (${audience}).
${audience === "admin" ? "Admin may use org-wide knowledge." : "Stay within this role's playbook + role-scoped knowledge."}
Never invent other roles' private finance/HR details unless audience is admin.

Return JSON only:
{
  "reply": "markdown answer",
  "followUpQuestions": ["optional 1-3 short next questions"]
}

Answer style — CRITICAL:
- Answer directly in 2–6 short sentences (or a tight bullet list). No preamble, no "as an AI", no long explanations.
- Lead with the answer. Skip background unless asked.
- Map "when X → go to Y" only when the question is about who to contact.
- Prefer facts from the knowledge pool; if thin, say so in one line and use the playbook.
- Name CresOS screens only when useful (Schedule, Reports, CRM, Finance, PM, HR).
- Do not invent employee names not in context.
${poolEmpty ? "- Knowledge pool is thin for this role; lean on the playbook." : ""}`;

  try {
    const { raw } = await groqChatWithFallback({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Question:\n${trimmed}\n\n--- CONTEXT ---\n${contextBlock}`
        }
      ],
      max_tokens: 700,
      temperature: 0.25,
      response_format: { type: "json_object" }
    });

    if (!raw) return fallbackReply(audience, trimmed);
    const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
    const reply = asString(parsed.reply) || fallbackReply(audience, trimmed).reply;
    const followUps = Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.map(asString).filter(Boolean).slice(0, 6)
      : [];

    return {
      audience,
      reply,
      aiGenerated: true,
      suggestedQuestions: followUps.length ? followUps : playbook.suggestedQuestions,
      contactRules: playbook.contactRules.map((r) => ({ when: r.when, goTo: r.goTo }))
    };
  } catch (e) {
    console.error("[onboarding] chat failed:", e);
    const fb = fallbackReply(audience, trimmed);
    return { ...fb, reply: `AI temporarily unavailable.\n\n${fb.reply}` };
  }
}
