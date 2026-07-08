import Groq from "groq-sdk";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import { listGroqApiKeys, resolveGroqModelChain } from "./groq-model";

export type GroqChatFallbackResult = {
  raw: string;
  model: string;
  apiKeyLabel: string;
};

const KEY_LABELS = ["primary", "secondary", "tertiary"] as const;

export function isGroqRateLimitError(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "status" in e) {
    if ((e as { status: number }).status === 429) return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /429|rate_limit|rate limit|tokens per day|TPD/i.test(msg);
}

type GroqChatParams = Omit<ChatCompletionCreateParamsNonStreaming, "model"> & {
  models?: string[];
};

/**
 * Try Groq chat across API keys and model chain.
 * On 429 / TPD exhaustion for one model, falls through to the next model (then next key).
 */
export async function groqChatWithFallback(params: GroqChatParams): Promise<GroqChatFallbackResult> {
  const keys = listGroqApiKeys();
  if (!keys.length) throw new Error("No Groq API keys configured");

  const models =
    params.models ??
    resolveGroqModelChain(
      process.env.GROQ_DIRECTOR_MODEL,
      process.env.GROQ_REMINDER_MODEL,
      process.env.GROQ_EMAIL_MODEL
    );

  const { models: _models, ...rest } = params;
  let lastRateLimit: unknown;

  for (let i = 0; i < keys.length; i++) {
    const client = new Groq({ apiKey: keys[i], maxRetries: 0 });
    const keyLabel = KEY_LABELS[i] ?? `key${i + 1}`;

    for (const model of models) {
      try {
        const completion = await client.chat.completions.create({
          ...rest,
          model
        });
        const raw = completion.choices[0]?.message?.content?.trim();
        if (!raw) continue;

        if (model !== models[0] || i > 0) {
          // eslint-disable-next-line no-console
          console.warn(`[groq-fallback] recovered via model=${model} key=${keyLabel}`);
        }
        return { raw, model, apiKeyLabel: keyLabel };
      } catch (e) {
        if (isGroqRateLimitError(e)) {
          lastRateLimit = e;
          // eslint-disable-next-line no-console
          console.warn(`[groq-fallback] rate limited model=${model} key=${keyLabel}, trying next`);
          continue;
        }
        throw e;
      }
    }
  }

  if (lastRateLimit) throw lastRateLimit;
  throw new Error("Groq returned empty content for all models");
}
