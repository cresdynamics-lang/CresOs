import { describe, expect, it } from "vitest";
import { getOnboardingPlaybook } from "../src/lib/onboarding-playbooks";
import {
  allowedSourceTypesForAudience,
  resolveOnboardingAudience
} from "../src/lib/onboarding-role-scope";

describe("onboarding role scope", () => {
  it("maps admin to full access audience", () => {
    expect(resolveOnboardingAudience(["admin", "sales"])).toBe("admin");
    expect(allowedSourceTypesForAudience("admin")).toBeNull();
  });

  it("keeps sales scoped away from admin", () => {
    expect(resolveOnboardingAudience(["sales"])).toBe("sales");
    const allow = allowedSourceTypesForAudience("sales");
    expect(allow).toContain("lead_activity");
    expect(allow).not.toContain("expense");
  });

  it("provides contact rules for every playbook", () => {
    for (const audience of [
      "developer",
      "sales",
      "director",
      "project_manager",
      "hr",
      "finance",
      "admin"
    ] as const) {
      const pb = getOnboardingPlaybook(audience);
      expect(pb.expectations.length).toBeGreaterThan(2);
      expect(pb.contactRules.length).toBeGreaterThan(2);
      expect(pb.suggestedQuestions.length).toBeGreaterThan(2);
    }
  });
});
