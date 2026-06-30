import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { parseRoleFromQuery } from "../src/lib/knowledge-team-index";
import { ROLE_KEYS } from "../src/modules/auth-middleware";

describe("knowledge pool helpers", () => {
  it("content hash is stable for dedupe metadata", () => {
    const hash = createHash("sha256").update("hello world".trim()).digest("hex").slice(0, 32);
    expect(hash).toHaveLength(32);
    expect(hash).toBe(createHash("sha256").update("hello world").digest("hex").slice(0, 32));
  });

  it("maps developer search aliases to developer role", () => {
    expect(parseRoleFromQuery("developers")).toBe(ROLE_KEYS.developer);
    expect(parseRoleFromQuery("Devs")).toBe(ROLE_KEYS.developer);
    expect(parseRoleFromQuery("sales")).toBe(ROLE_KEYS.sales);
    expect(parseRoleFromQuery("Wilson")).toBeUndefined();
  });
});
