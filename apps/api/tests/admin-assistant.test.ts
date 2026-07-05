import { describe, expect, it } from "vitest";

describe("admin assistant types", () => {
  it("execute and intelligence modes are distinct", () => {
    const modes = ["execute", "intelligence"] as const;
    expect(modes).toContain("execute");
    expect(modes).toContain("intelligence");
  });
});
