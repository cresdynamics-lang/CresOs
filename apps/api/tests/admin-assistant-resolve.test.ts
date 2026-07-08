import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveProjectHint, resolveUserHint } from "../src/lib/admin-assistant-resolve";

const prisma = new PrismaClient();
const hasDb = Boolean(process.env.DATABASE_URL);

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedOrgId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@cresdynamics.com", deletedAt: null },
    select: { orgId: true }
  });
  if (!admin) throw new Error("seed admin not found");
  return admin.orgId;
}

describe.skipIf(!hasDb)("admin-assistant-resolve", () => {
  it("resolveUserHint matches Wilson by first name", async () => {
    const orgId = await seedOrgId();
    const result = await resolveUserHint(prisma, orgId, "Wilson");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label.toLowerCase()).toContain("wilson");
    }
  });

  it("resolveUserHint fails for unknown user", async () => {
    const orgId = await seedOrgId();
    const result = await resolveUserHint(prisma, orgId, "xyz-nonexistent-user-abc");
    expect(result.ok).toBe(false);
  });

  it("resolveProjectHint matches Acme Retail Platform", async () => {
    const orgId = await seedOrgId();
    const result = await resolveProjectHint(prisma, orgId, "Acme");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toContain("Acme");
    }
  });
});
