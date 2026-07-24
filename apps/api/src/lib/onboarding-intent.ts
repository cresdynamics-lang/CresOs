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
      `Here's your Cres Dynamics ${audienceLabel(audience)} onboarding baseline.\n\n` +
      `**What's expected of you**\n${expectations}\n\n` +
      `**When this happens → go to this person**\n${contacts}\n\n` +
      `(AI is offline — configure GROQ_API_KEY for richer answers from the live knowledge pool. Your question: "${message.slice(0, 160)}")`,
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
      reply:
        `Welcome to Onboarding for **${audienceLabel(audience)}**.\n\n` +
        `${playbook.summary}\n\nAsk anything about expectations, who to contact, or how Cres Dynamics runs for your role.`,
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

  const system = `You are CresOS Onboarding Coach for Cres Dynamics.
You onboard people into their ROLE — never invent other roles' private finances or HR details unless audience is admin.
Audience: ${audienceLabel(audience)} (${audience}).
${audience === "admin" ? "Admin may see org-wide knowledge." : "Stay strictly within this role's playbook + role-scoped knowledge."}

Return JSON only:
{
  "reply": "markdown answer",
  "followUpQuestions": ["optional 2-4 suggested next questions"]
}

Answer style:
- Lead with what is expected of them for this role.
- Explicitly map "when X happens → go to Y" using the contact rules.
- Use knowledge pool facts when present; say when pool is thin.
- Be concrete about CresOS screens (Schedule, Reports, CRM, Finance, PM, HR) when relevant.
- Do not invent employee names not in context.
${poolEmpty ? "- Knowledge pool is thin for this role filter; lean on the playbook." : ""}`;

  try {
    const { raw } = await groqChatWithFallback({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `New joiner / role question:\n${trimmed}\n\n--- CONTEXT ---\n${contextBlock}`
        }
      ],
      max_tokens: 1600,
      temperature: 0.35,
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
