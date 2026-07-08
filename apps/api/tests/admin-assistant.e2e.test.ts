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

async function loginAsAdmin(): Promise<string> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "admin@cresdynamics.com", password: "Cres@Team2026#" });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

describe.skipIf(!hasDb)("Admin AI Command Phase 1", () => {
  it("rejects unauthenticated assistant chat", async () => {
    const res = await request(app)
      .post("/admin/assistant/chat")
      .send({ message: "hello", mode: "intelligence" });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin roles on assistant chat", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "wilson.developer@cresdynamics.com", password: "Cres@Team2026#" });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/admin/assistant/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "summarize projects", mode: "intelligence" });
    expect(res.status).toBe(403);
  });

  it("POST /admin/assistant/chat intelligence returns reply", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Summarize active projects briefly", mode: "intelligence" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("intelligence");
    expect(typeof res.body.reply).toBe("string");
    expect(res.body.reply.length).toBeGreaterThan(10);
  });

  it("POST /admin/assistant/parse returns proposed action preview", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({
        message: "Next Monday at 10am meet the director. Assign Wilson 3 hours to review the ERP proposal."
      });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("execute");
    expect(typeof res.body.reply).toBe("string");
    expect(Array.isArray(res.body.proposedActions)).toBe(true);
  });

  it("POST /admin/assistant/ask is intelligence alias", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ q: "How many projects are at risk?" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("intelligence");
    expect(res.body.reply).toBeTruthy();
  });

  it("POST /admin/assistant/chat rejects empty message", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "", mode: "execute" });
    expect(res.status).toBe(400);
  });

  it("POST /admin/assistant/from-voice rejects missing audio", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/from-voice")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "intelligence" });
    expect(res.status).toBe(400);
  });
});

describe.skipIf(!hasDb)("Admin AI Command Phase 2 — execute", () => {
  it("POST /admin/assistant/execute creates schedule meeting and project task", async () => {
    const token = await loginAsAdmin();
    const wilson = await prisma.user.findFirst({
      where: { email: "wilson.developer@cresdynamics.com", deletedAt: null }
    });
    const project = await prisma.project.findFirst({
      where: { name: "Acme Retail Platform", deletedAt: null }
    });
    expect(wilson).toBeTruthy();
    expect(project).toBeTruthy();

    const suffix = `${Date.now()}`;
    const scheduledAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const meetingTitle = `E2E director check-in ${suffix}`;
    const taskTitle = `E2E ERP scope review ${suffix}`;
    const actions = [
      {
        id: `test-meeting-${suffix}`,
        kind: "schedule_meeting" as const,
        title: meetingTitle,
        scheduledAt,
        assigneeHint: "Admin"
      },
      {
        id: `test-task-${suffix}`,
        kind: "create_project_task" as const,
        title: taskTitle,
        projectHint: "Acme Retail Platform",
        assigneeHint: "Wilson",
        dueDate,
        estimatedHours: 3
      }
    ];

    const res = await request(app)
      .post("/admin/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions });

    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(2);
    expect(res.body.failed).toBe(0);
    expect(res.body.results[0].scheduleItemId).toBeTruthy();
    expect(res.body.results[1].taskId).toBeTruthy();

    const schedule = await prisma.scheduleItem.findUnique({
      where: { id: res.body.results[0].scheduleItemId }
    });
    expect(schedule?.title).toBe(meetingTitle);

    const task = await prisma.task.findUnique({
      where: { id: res.body.results[1].taskId }
    });
    expect(task?.title).toBe(taskTitle);
    expect(task?.projectId).toBe(project!.id);
    expect(task?.assigneeId).toBe(wilson!.id);
  });

  it("POST /admin/assistant/execute rejects empty actions", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post("/admin/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions: [] });
    expect(res.status).toBe(400);
  });
});
