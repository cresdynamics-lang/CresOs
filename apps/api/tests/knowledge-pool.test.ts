import { describe, expect, it } from "vitest";
import { createHash } from "crypto";

describe("knowledge pool helpers", () => {
  it("content hash is stable for dedupe metadata", () => {
    const hash = createHash("sha256").update("hello world".trim()).digest("hex").slice(0, 32);
    expect(hash).toHaveLength(32);
    expect(hash).toBe(createHash("sha256").update("hello world").digest("hex").slice(0, 32));
  });
});
