import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";

const prisma = new PrismaClient();
const app = createApp(prisma);
const hasDb = Boolean(process.env.DATABASE_URL);

afterAll(async () => {
  await prisma.$disconnect();
});

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post("/auth/login").send({ email, password });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(`login failed for ${email}: ${res.status}`);
  }
  return res.body.accessToken as string;
}

/**
 * Cross-phase alignment matrix — one place to verify Phases 1–5 stay wired together.
 */
describe.skipIf(!hasDb)("AI Assistants — all phases aligned", () => {
  it("Phase 1: admin parse returns execute structure", async () => {
    const token = await login("admin@cresdynamics.com", "Cres@Team2026#");
    const parse = await request(app)
      .post("/admin/assistant/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Meet Wilson tomorrow 10am" });
    expect(parse.status).toBe(200);
    expect(parse.body.mode).toBe("execute");
    expect(Array.isArray(parse.body.proposedActions)).toBe(true);
    expect(parse.body.sessionId).toBeTruthy();

    const unauth = await request(app)
      .post("/admin/assistant/chat")
      .send({ message: "x", mode: "intelligence" });
    expect(unauth.status).toBe(401);
  }, 60_000);

  it("Phase 2: admin execute + finance execute write to DB", async () => {
    const adminToken = await login("admin@cresdynamics.com", "Cres@Team2026#");
    const financeToken = await login("finance@cresdynamics.com", "Cres@Team2026#");
    const suffix = Date.now();

    const adminExec = await request(app)
      .post("/admin/assistant/execute")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        actions: [
          {
            id: `align-meet-${suffix}`,
            kind: "schedule_meeting",
            title: `Alignment check ${suffix}`,
            scheduledAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
            assigneeHint: "Admin"
          }
        ]
      });
    expect(adminExec.status).toBe(200);
    expect(adminExec.body.succeeded).toBe(1);
    expect(adminExec.body.sessionId).toBeTruthy();

    const finExec = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${financeToken}`)
      .send({
        actions: [
          {
            id: `align-exp-${suffix}`,
            kind: "create_expense",
            title: `Alignment expense ${suffix}`,
            amount: 1200 + (suffix % 500),
            category: "transport",
            beneficiaryHint: "Wilson",
            spentAt: new Date().toISOString().slice(0, 10)
          }
        ]
      });
    expect(finExec.status).toBe(200);
    expect(finExec.body.succeeded).toBe(1);
    expect(finExec.body.sessionId).toBeTruthy();
  });

  it("Phase 3: director intelligence yes, execute no; admin sessions", async () => {
    const directorToken = await login("director@cresdynamics.com", "Henry@Cres");
    const adminToken = await login("admin@cresdynamics.com", "Cres@Team2026#");

    const intel = await request(app)
      .post("/admin/assistant/ask")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ q: "How is Wilson doing?", focus: "person" });
    expect(intel.status).toBe(200);
    expect(intel.body.focus).toBe("person");

    const exec = await request(app)
      .post("/admin/assistant/execute")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ actions: [] });
    expect(exec.status).toBe(403);

    const parse403 = await request(app)
      .post("/admin/assistant/parse")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ message: "Schedule meeting" });
    expect(parse403.status).toBe(403);

    const sessions = await request(app)
      .get("/admin/assistant/sessions?limit=3")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(sessions.status).toBe(200);
    expect(Array.isArray(sessions.body.sessions)).toBe(true);
  }, 60_000);

  it("Phase 4: finance chat returns impact-ready structure + sessions", async () => {
    const token = await login("finance@cresdynamics.com", "Cres@Team2026#");
    const res = await request(app)
      .post("/finance/assistant/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Record 5000 transport for Wilson" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("execute");
    expect(Array.isArray(res.body.proposedActions)).toBe(true);
    expect(res.body.sessionId).toBeTruthy();

    const sessions = await request(app)
      .get("/finance/assistant/sessions?limit=3")
      .set("Authorization", `Bearer ${token}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.sessions.length).toBeGreaterThan(0);
  }, 60_000);

  it("Phase 5: role guards + finance amount cap", async () => {
    const devToken = await login("wilson.developer@cresdynamics.com", "Cres@Team2026#");
    const financeToken = await login("finance@cresdynamics.com", "Cres@Team2026#");

    const adminChat403 = await request(app)
      .post("/admin/assistant/chat")
      .set("Authorization", `Bearer ${devToken}`)
      .send({ message: "projects?", mode: "intelligence" });
    expect(adminChat403.status).toBe(403);

    const financeChat403 = await request(app)
      .post("/finance/assistant/chat")
      .set("Authorization", `Bearer ${devToken}`)
      .send({ message: "hello", mode: "execute" });
    expect(financeChat403.status).toBe(403);

    const cap = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${financeToken}`)
      .send({
        actions: [
          {
            id: "cap-align",
            kind: "create_payment",
            title: "Cap test",
            amount: 99_000_000,
            method: "mpesa",
            receivedAt: new Date().toISOString().slice(0, 10)
          }
        ]
      });
    expect(cap.status).toBe(200);
    expect(cap.body.succeeded).toBe(0);
    expect(cap.body.results[0].error).toMatch(/cap/i);
  });
});
