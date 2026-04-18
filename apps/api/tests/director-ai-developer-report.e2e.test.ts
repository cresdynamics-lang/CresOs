import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";
import { ROLE_KEYS } from "../src/modules/auth-middleware";

const prisma = new PrismaClient();
const app = createApp(prisma);

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasGroq = Boolean(
  process.env.GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEY_SECONDARY?.trim() ||
    process.env.GROQ_API_KEY_TERTIARY?.trim()
);

let dbReachable = false;

afterAll(async () => {
  await prisma.$disconnect();
});

async function addDeveloperToOrg(orgId: string, email: string, password: string) {
  const devRole = await prisma.role.findFirst({
    where: { orgId, key: ROLE_KEYS.developer }
  });
  if (!devRole) throw new Error("Developer role missing for org");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: "E2E Developer",
      passwordHash,
      orgId
    }
  });

  await prisma.orgMember.create({
    data: { orgId, userId: user.id, roleId: devRole.id }
  });
  await prisma.userRole.create({
    data: { userId: user.id, roleId: devRole.id }
  });

  return user;
}

describe("Director AI — developer report E2E (DB + Groq)", () => {
  beforeAll(async () => {
    process.env.DIRECTOR_AI_E2E_DELAY_MS = "0";
    if (!hasDb) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      dbReachable = true;
    } catch {
      dbReachable = false;
    }
  });

  it("POST developer report → remarks get director-style Groq reply with Marked reviewed", async ({ skip }) => {
    skip(!dbReachable || !hasGroq, "Requires reachable DATABASE_URL and GROQ_API_KEY (see apps/api/.env)");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const orgName = `E2E DirectorAI ${suffix}`;
    const directorEmail = `e2e-dir-ai-${suffix}@cresos.test`;
    const devEmail = `e2e-dev-ai-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";

    const reg = await request(app).post("/auth/register").send({
      orgName,
      name: "Director Owner",
      email: directorEmail,
      password
    });
    expect(reg.status).toBe(200);
    const orgId = reg.body.org.id as string;

    await addDeveloperToOrg(orgId, devEmail, password);

    const loginDev = await request(app).post("/auth/login").send({
      email: devEmail,
      password
    });
    expect(loginDev.status).toBe(200);
    const devToken = loginDev.body.accessToken as string;
    expect(loginDev.body.roleKeys).toContain(ROLE_KEYS.developer);

    const reportDate = new Date(Date.UTC(2022, 3, 12));
    reportDate.setUTCHours(0, 0, 0, 0);

    const bodyText =
      "Shipped the auth middleware tests and fixed edge cases on session expiry. " +
      "Next wiring notification read receipts. Blocker: none. Needs attention: staging deploy slot.";

    const createRes = await request(app)
      .post("/developer-reports")
      .set("Authorization", `Bearer ${devToken}`)
      .send({
        reportDate: reportDate.toISOString(),
        whatWorked: "Focused on API reliability and regression coverage.",
        implemented: bodyText,
        pending: "Mobile QA on report list once build is green.",
        nextPlan: "Pair on handoff doc and unblock QA environment.",
        blockers: "None.",
        needsAttention: "None."
      });

    expect(createRes.status).toBe(201);
    const reportId = createRes.body.id as string;
    expect(reportId).toBeTruthy();

    let remarks: string | null = null;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const row = await prisma.developerReport.findUnique({
        where: { id: reportId },
        select: { remarks: true, reviewStatus: true, reviewedById: true }
      });
      remarks = row?.remarks ?? null;
      if (remarks?.includes("Marked reviewed. ✓")) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    expect(remarks, "Expected Groq to populate remarks within timeout").toBeTruthy();
    expect(remarks!).toContain("Marked reviewed. ✓");

    const full = await prisma.developerReport.findUnique({
      where: { id: reportId },
      select: { reviewStatus: true, reviewedById: true, remarks: true }
    });
    expect(full?.reviewStatus).toBe("viewed");
    expect(full?.reviewedById).toBeTruthy();

    const director = await prisma.user.findUnique({
      where: { email: directorEmail },
      select: { id: true }
    });
    expect(full?.reviewedById).toBe(director?.id);
  }, 60_000);
});
