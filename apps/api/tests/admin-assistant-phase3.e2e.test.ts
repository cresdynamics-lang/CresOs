import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";
import { detectIntelligenceFocus } from "../src/lib/admin-assistant-focus";

const prisma = new PrismaClient();
const app = createApp(prisma);
const hasDb = Boolean(process.env.DATABASE_URL);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("admin-assistant-focus", () => {
  it("detects person focus from query", () => {
    expect(detectIntelligenceFocus("How is Wilson doing in the last 30 days?")).toBe("person");
  });
  it("detects hours focus", () => {
    expect(detectIntelligenceFocus("Convert report days to hours for Wilson")).toBe("hours");
  });
  it("detects projects focus", () => {
    expect(detectIntelligenceFocus("Summarize all active projects at risk")).toBe("projects");
  });
  it("respects explicit focus override", () => {
    expect(detectIntelligenceFocus("anything", "services")).toBe("services");
  });
});

async function loginAsAdmin(): Promise<string> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "admin@cresdynamics.com", password: "Cres@Team2026#" });
  if (res.status !== 200 || !res.body.accessToken) throw new Error("login failed");
  return res.body.accessToken as string;
}

describe.skipIf(!hasDb)("Admin AI Command Phase 3", () => {
  it("GET /admin/assistant/sessions returns recent sessions", async () => {
    const token = await loginAsAdmin();
    await request(app)
      .post("/admin/assistant/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ q: "Summarize active projects briefly", focus: "projects" });

    const res = await request(app)
      .get("/admin/assistant/sessions?limit=5")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThan(0);
  });

  it("intelligence with focus returns focus field", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "How is Wilson doing?", mode: "intelligence", focus: "person" });
    expect(res.status).toBe(200);
    expect(res.body.focus).toBe("person");
    expect(res.body.sessionId).toBeTruthy();
  });

  it("execute skips duplicate schedule items", async () => {
    const token = await loginAsAdmin();
    const suffix = Date.now();
    const scheduledAt = new Date(Date.now() + 4 * 86_400_000).toISOString();
    const action = {
      id: `dup-test-${suffix}`,
      kind: "schedule_meeting" as const,
      title: `E2E duplicate guard meeting ${suffix}`,
      scheduledAt,
      assigneeHint: "Admin"
    };
    const first = await request(app)
      .post("/admin/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions: [action] });
    expect(first.status).toBe(200);
    expect(first.body.succeeded).toBe(1);

    const second = await request(app)
      .post("/admin/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions: [{ ...action, id: `dup-test-2-${suffix}` }] });
    expect(second.status).toBe(200);
    expect(second.body.succeeded).toBe(0);
    expect(second.body.results[0].error).toContain("duplicate");
  });
});
