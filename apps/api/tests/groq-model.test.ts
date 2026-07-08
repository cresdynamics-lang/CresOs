import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_GROQ_MODEL_FALLBACK_CHAIN,
  listGroqApiKeys,
  resolveGroqModel,
  resolveGroqModelChain
} from "../src/lib/groq-model";
import { isGroqRateLimitError } from "../src/lib/groq-chat-fallback";

describe("groq-model", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("resolveGroqModel rejects API keys masquerading as model names", () => {
    expect(resolveGroqModel("gsk_fake_key", "llama-3.1-8b-instant")).toBe("llama-3.1-8b-instant");
  });

  it("resolveGroqModelChain dedupes and includes fallback models", () => {
    process.env.GROQ_DIRECTOR_MODEL = "llama-3.3-70b-versatile";
    process.env.GROQ_ASSISTANT_MODEL_FALLBACK = "llama-3.1-8b-instant,llama-3.1-8b-instant";
    const chain = resolveGroqModelChain(process.env.GROQ_DIRECTOR_MODEL);
    expect(chain[0]).toBe("llama-3.3-70b-versatile");
    expect(chain).toContain("llama-3.1-8b-instant");
    expect(chain.filter((m) => m === "llama-3.1-8b-instant")).toHaveLength(1);
    expect(chain.length).toBeGreaterThanOrEqual(DEFAULT_GROQ_MODEL_FALLBACK_CHAIN.length);
  });

  it("listGroqApiKeys returns configured keys in order", () => {
    process.env.GROQ_API_KEY = "key-a";
    process.env.GROQ_API_KEY_SECONDARY = "key-b";
    delete process.env.GROQ_API_KEY_TERTIARY;
    expect(listGroqApiKeys()).toEqual(["key-a", "key-b"]);
  });
});

describe("groq-chat-fallback", () => {
  it("isGroqRateLimitError detects 429 and TPD messages", () => {
    expect(isGroqRateLimitError({ status: 429 })).toBe(true);
    expect(isGroqRateLimitError(new Error("Rate limit reached for model on tokens per day (TPD)"))).toBe(
      true
    );
    expect(isGroqRateLimitError(new Error("invalid JSON"))).toBe(false);
  });
});
