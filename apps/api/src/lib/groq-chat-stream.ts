import Groq from "groq-sdk";
import { listGroqApiKeys, resolveGroqModelChain } from "./groq-model";
import { isGroqRateLimitError } from "./groq-chat-fallback";

export type GroqStreamChunk = { type: "token"; text: string } | { type: "done"; model: string; apiKeyLabel: string };

const KEY_LABELS = ["primary", "secondary", "tertiary"] as const;

type StreamParams = {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens?: number;
  temperature?: number;
  models?: string[];
  /** When true, request JSON object mode (collect before parse — still streams tokens). */
  json?: boolean;
};

/**
 * Stream Groq chat completions across keys/models. Yields token deltas as they arrive.
 */
export async function* groqChatStreamWithFallback(
  params: StreamParams
): AsyncGenerator<GroqStreamChunk, void, unknown> {
  const keys = listGroqApiKeys();
  if (!keys.length) throw new Error("No Groq API keys configured");

  const models =
    params.models ??
    resolveGroqModelChain(
      process.env.GROQ_DIRECTOR_MODEL,
      process.env.GROQ_REMINDER_MODEL,
      process.env.GROQ_EMAIL_MODEL
    );

  let lastRateLimit: unknown;

  for (let i = 0; i < keys.length; i++) {
    const client = new Groq({ apiKey: keys[i], maxRetries: 0 });
    const keyLabel = KEY_LABELS[i] ?? `key${i + 1}`;

    for (const model of models) {
      try {
        const stream = await client.chat.completions.create({
          model,
          messages: params.messages,
          max_tokens: params.max_tokens ?? 1600,
          temperature: params.temperature ?? 0.3,
          stream: true,
          ...(params.json ? { response_format: { type: "json_object" as const } } : {})
        });

        let emitted = false;
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            emitted = true;
            yield { type: "token", text };
          }
        }
        if (!emitted) continue;

        if (model !== models[0] || i > 0) {
          // eslint-disable-next-line no-console
          console.warn(`[groq-stream] recovered via model=${model} key=${keyLabel}`);
        }
        yield { type: "done", model, apiKeyLabel: keyLabel };
        return;
      } catch (e) {
        if (isGroqRateLimitError(e)) {
          lastRateLimit = e;
          // eslint-disable-next-line no-console
          console.warn(`[groq-stream] rate limited model=${model} key=${keyLabel}, trying next`);
          continue;
        }
        throw e;
      }
    }
  }

  if (lastRateLimit) throw lastRateLimit;
  throw new Error("Groq stream returned empty content for all models");
}
