import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";
import { ROLE_KEYS } from "../src/modules/auth-middleware";
import {
  enrichCheckInsWithConversationIds,
  formatCheckInCommunityContent,
  formatCheckInReplyCommunityContent
} from "../src/lib/pm-checkin-community";
import type { RoleCheckInPayload } from "../src/lib/role-project-checkin";

const prisma = new PrismaClient();
const app = createApp(prisma);
const hasDb = Boolean(process.env.DATABASE_URL);

const SEED_PASSWORD = "Cres@Team2026#";
const SEED_PM_EMAIL = "pm@cresdynamics.com";
const SEED_DEV_EMAIL = "wilson.developer@cresdynamics.com";
const SEED_PROJECT_NAME = "Acme Retail Platform";

const SAMPLE_PAYLOAD: RoleCheckInPayload = {
  intro: "Wilson, quick pulse on delivery today.",
  questions: [
    { id: "q1", text: "What shipped on this project since yesterday?", placeholder: "Progress…" },
    { id: "q2", text: "Any blockers we should unblock?", placeholder: "Blockers…" }
  ],
  aiGenerated: false
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function grantRole(userId: string, orgId: string, roleKey: string) {
  let role = await prisma.role.findFirst({ where: { orgId, key: roleKey } });
  if (!role) {
    role = await prisma.role.create({
      data: { orgId, key: roleKey, name: roleKey.replace(/_/g, " ") }
    });
  }
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId: role.id } });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }
}

async function login(email: string, password: string) {
  return request(app).post("/auth/login").send({ email, password });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("pm-checkin-community formatters", () => {
  it("formatCheckInCommunityContent prefixes PM role and project", () => {
    const body = formatCheckInCommunityContent("Acme Retail Platform", "project_manager", SAMPLE_PAYLOAD);
    expect(body).toContain("📋 Project Manager check-in · Acme Retail Platform");
    expect(body).toContain(SAMPLE_PAYLOAD.intro);
    expect(body).toContain("What shipped on this project");
  });

  it("formatCheckInReplyCommunityContent structures Q/A blocks", () => {
    const body = formatCheckInReplyCommunityContent("Acme Retail Platform", SAMPLE_PAYLOAD.questions, {
      q1: "Merged auth PR",
      q2: "Waiting on API keys"
    });
    expect(body).toContain("✅ Check-in reply · Acme Retail Platform");
    expect(body).toContain("Merged auth PR");
    expect(body).toContain("Waiting on API keys");
  });

  it("enrichCheckInsWithConversationIds maps messageId → conversationId", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "msg-1", conversationId: "conv-1" },
      { id: "msg-2", conversationId: "conv-2" }
    ]);
    const mockPrisma = { message: { findMany } } as unknown as PrismaClient;

    const rows = await enrichCheckInsWithConversationIds(mockPrisma, [
      { id: "ci-1", messageId: "msg-1" },
      { id: "ci-2", messageId: "msg-2" },
      { id: "ci-3", messageId: null }
    ]);

    expect(rows[0].conversationId).toBe("conv-1");
    expect(rows[1].conversationId).toBe("conv-2");
    expect(rows[2].conversationId).toBeNull();
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ["msg-1", "msg-2"] } },
      select: { id: true, conversationId: true }
    });
  });
});

describe.skipIf(!hasDb)("PM check-in → Community DM alignment", () => {
  type Fixture = {
    orgId: string;
    pmId: string;
    pmToken: string;
    devId: string;
    devToken: string;
    projectId: string;
    projectName: string;
    cleanup: () => Promise<void>;
  };

  let ephemeral: Fixture | null = null;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const password = "E2E-checkin-Test-1!";
    const hash = await bcrypt.hash(password, 10);

    const org = await prisma.org.create({
      data: { name: `Check-in E2E ${suffix}`, slug: `checkin-e2e-${suffix}` }
    });

    const pm = await prisma.user.create({
      data: {
        orgId: org.id,
        email: `pm-e2e-${suffix}@cresos.test`,
        name: "E2E Pat PM",
        passwordHash: hash
      }
    });
    const dev = await prisma.user.create({
      data: {
        orgId: org.id,
        email: `dev-e2e-${suffix}@cresos.test`,
        name: "E2E Wilson Dev",
        passwordHash: hash
      }
    });

    await grantRole(pm.id, org.id, ROLE_KEYS.project_manager);
    await grantRole(dev.id, org.id, ROLE_KEYS.developer);

    const project = await prisma.project.create({
      data: {
        orgId: org.id,
        name: `Platform Alpha ${suffix}`,
        status: "active",
        type: "project",
        approvalStatus: "approved",
        approvedAt: new Date(),
        assignedDeveloperId: dev.id,
        createdByUserId: pm.id
      }
    });

    await prisma.projectDeveloperAssignment.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        userId: dev.id,
        status: "accepted",
        invitedById: pm.id,
        respondedAt: new Date()
      }
    });

    const pmLogin = await login(pm.email!, password);
    const devLogin = await login(dev.email!, password);
    expect(pmLogin.status).toBe(200);
    expect(devLogin.status).toBe(200);

    ephemeral = {
      orgId: org.id,
      pmId: pm.id,
      pmToken: pmLogin.body.accessToken as string,
      devId: dev.id,
      devToken: devLogin.body.accessToken as string,
      projectId: project.id,
      projectName: project.name,
      cleanup: async () => {
        try {
          await prisma.pmDeveloperCheckIn.deleteMany({ where: { orgId: org.id } });
          await prisma.message.deleteMany({
            where: { conversation: { orgId: org.id } }
          });
          await prisma.conversation.deleteMany({ where: { orgId: org.id } });
          await prisma.chatUser.deleteMany({ where: { orgId: org.id } });
          await prisma.inbox.deleteMany({ where: { orgId: org.id } });
          await prisma.projectDeveloperAssignment.deleteMany({ where: { orgId: org.id } });
          await prisma.project.deleteMany({ where: { orgId: org.id } });
          await prisma.eventLog.deleteMany({ where: { orgId: org.id } });
          await prisma.userRole.deleteMany({
            where: { user: { orgId: org.id } }
          });
          await prisma.session.deleteMany({ where: { user: { orgId: org.id } } });
          await prisma.user.deleteMany({ where: { orgId: org.id } });
          await prisma.role.deleteMany({ where: { orgId: org.id } });
          await prisma.org.delete({ where: { id: org.id } });
        } catch {
          // Best-effort teardown for ephemeral org
        }
      }
    };
  });

  afterAll(async () => {
    if (ephemeral) await ephemeral.cleanup();
  });

  async function clearTodaysCheckIn(projectId: string, developerId: string) {
    await prisma.pmDeveloperCheckIn.deleteMany({
      where: {
        projectId,
        developerId,
        dayKey: todayKey(),
        senderRole: "project_manager"
      }
    });
  }

  async function sendCheckIn(
    pmToken: string,
    projectId: string,
    developerId: string,
    message: string
  ) {
    return request(app)
      .post("/pm/check-ins")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({
        projectId,
        developerId,
        useAi: false,
        message
      });
  }

  async function assertCommunityAlignment(input: {
    pmId: string;
    devToken: string;
    checkInId: string;
    conversationId: string;
    messageId: string;
    projectId: string;
    projectName: string;
  }) {
    const { pmId, devToken, checkInId, conversationId, messageId, projectId, projectName } = input;

    const row = await prisma.pmDeveloperCheckIn.findUnique({ where: { id: checkInId } });
    expect(row?.messageId).toBe(messageId);
    expect(row?.status).toBe("pending");
    expect(row?.projectId).toBe(projectId);
    expect(row?.senderRole).toBe("project_manager");

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    expect(msg?.conversationId).toBe(conversationId);
    expect(msg?.senderId).toBe(pmId);
    expect(msg?.content).toContain(`Project Manager check-in · ${projectName}`);
    const meta = msg?.metadata as Record<string, unknown>;
    expect(meta?.roleCheckIn).toBe(true);
    expect(meta?.pmCheckIn).toBe(true);
    expect(meta?.senderRole).toBe("project_manager");
    expect(meta?.senderLabel).toBe("Project Manager");
    expect(meta?.projectId).toBe(projectId);
    expect(meta?.projectName).toBe(projectName);
    expect(meta?.checkInId).toBe(checkInId);
    expect(meta?.requiresResponse).toBe(true);
    expect(Array.isArray(meta?.questions)).toBe(true);

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(conv?.type).toBe("direct");
    expect(conv?.participants).toEqual(expect.arrayContaining([pmId]));
    const last = conv?.lastMessage as { id?: string; senderId?: string } | null;
    expect(last?.id).toBe(messageId);
    expect(last?.senderId).toBe(pmId);

    const convList = await request(app)
      .get("/chat-community/conversations")
      .set("Authorization", `Bearer ${devToken}`);
    expect(convList.status).toBe(200);
    const conversations = convList.body.data?.conversations as { id: string; type: string }[];
    expect(conversations.some((c) => c.id === conversationId && c.type === "direct")).toBe(true);

    const thread = await request(app)
      .get(`/chat-community/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${devToken}`);
    expect(thread.status).toBe(200);
    const messages = thread.body.data?.messages as {
      id: string;
      senderId: string;
      metadata?: Record<string, unknown>;
    }[];
    const checkInMsg = messages.find((m) => m.id === messageId);
    expect(checkInMsg).toBeTruthy();
    expect(checkInMsg?.senderId).toBe(pmId);
    expect(checkInMsg?.metadata?.roleCheckIn).toBe(true);

    const enriched = await request(app)
      .get("/pm/check-ins/inbox")
      .set("Authorization", `Bearer ${devToken}`);
    expect(enriched.status).toBe(200);
    const inbox = enriched.body as { id: string; conversationId: string | null }[];
    const inboxRow = inbox.find((r) => r.id === checkInId);
    expect(inboxRow?.conversationId).toBe(conversationId);
  }

  it("posts PM check-in as direct Community DM on an approved project (ephemeral fixture)", async () => {
    expect(ephemeral).toBeTruthy();
    const fx = ephemeral!;

    await clearTodaysCheckIn(fx.projectId, fx.devId);

    const sent = await sendCheckIn(
      fx.pmToken,
      fx.projectId,
      fx.devId,
      "E2E check-in intro for Platform Alpha."
    );
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    expect(sent.body.conversationId).toBeTruthy();
    expect(sent.body.messageId).toBeTruthy();
    expect(sent.body.project?.id).toBe(fx.projectId);
    expect(sent.body.developer?.id).toBe(fx.devId);

    await assertCommunityAlignment({
      pmId: fx.pmId,
      devToken: fx.devToken,
      checkInId: sent.body.id as string,
      conversationId: sent.body.conversationId as string,
      messageId: sent.body.messageId as string,
      projectId: fx.projectId,
      projectName: fx.projectName
    });
  });

  it("developer reply threads in Community and clears requiresResponse", async () => {
    expect(ephemeral).toBeTruthy();
    const fx = ephemeral!;

    await clearTodaysCheckIn(fx.projectId, fx.devId);

    const sent = await sendCheckIn(fx.pmToken, fx.projectId, fx.devId, "Reply flow intro.");
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);

    const checkInId = sent.body.id as string;
    const res = await request(app)
      .post(`/pm/check-ins/${checkInId}/respond`)
      .set("Authorization", `Bearer ${fx.devToken}`)
      .send({
        answers: {
          q1: "Finished API wiring",
          q2: "None today"
        }
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("answered");
    expect(res.body.replyMessageId).toBeTruthy();

    const parent = await prisma.message.findUnique({ where: { id: sent.body.messageId as string } });
    const parentMeta = parent?.metadata as Record<string, unknown>;
    expect(parentMeta?.requiresResponse).toBe(false);
    expect(parentMeta?.answeredAt).toBeTruthy();

    const reply = await prisma.message.findUnique({ where: { id: res.body.replyMessageId as string } });
    expect(reply?.replyTo).toBe(sent.body.messageId);
    expect(reply?.senderId).toBe(fx.devId);
    expect(reply?.conversationId).toBe(sent.body.conversationId);
    expect(reply?.content).toContain("✅ Check-in reply");
  });

  it("daily batch delivers Community DMs for each active project developer", async () => {
    expect(ephemeral).toBeTruthy();
    const fx = ephemeral!;

    await clearTodaysCheckIn(fx.projectId, fx.devId);

    const batch = await request(app)
      .post("/pm/check-ins/daily-batch")
      .set("Authorization", `Bearer ${fx.pmToken}`);
    expect(batch.status).toBe(200);
    expect(batch.body.sent).toBeGreaterThanOrEqual(1);

    const created = (batch.body.checkIns as { id: string; projectId: string; messageId: string; conversationId: string }[]).find(
      (c) => c.projectId === fx.projectId
    );
    expect(created).toBeTruthy();
    expect(created?.messageId).toBeTruthy();
    expect(created?.conversationId).toBeTruthy();

    const msg = await prisma.message.findUnique({ where: { id: created!.messageId } });
    expect(msg?.content).toContain(`check-in · ${fx.projectName}`);
  });
});

describe.skipIf(!hasDb)("PM check-in → Community (seed Acme Retail Platform)", () => {
  it("Pat PM → Wilson Developer on predefined Acme Retail Platform", async () => {
    const pmLogin = await login(SEED_PM_EMAIL, SEED_PASSWORD);
    const devLogin = await login(SEED_DEV_EMAIL, SEED_PASSWORD);
    if (pmLogin.status !== 200 || devLogin.status !== 200) {
      console.warn("Seed users not available — run prisma db seed");
      return;
    }

    const pmToken = pmLogin.body.accessToken as string;
    const devToken = devLogin.body.accessToken as string;
    const pmId = pmLogin.body.user.id as string;
    const devId = devLogin.body.user.id as string;
    const orgId = pmLogin.body.org.id as string;

    const project = await prisma.project.findFirst({
      where: { orgId, name: SEED_PROJECT_NAME, deletedAt: null, approvalStatus: "approved" }
    });
    if (!project) {
      console.warn(`Seed project "${SEED_PROJECT_NAME}" not found — run prisma db seed`);
      return;
    }

    const assignment = await prisma.projectDeveloperAssignment.findFirst({
      where: { projectId: project.id, userId: devId, status: "accepted" }
    });
    expect(assignment).toBeTruthy();

    await prisma.pmDeveloperCheckIn.deleteMany({
      where: {
        projectId: project.id,
        developerId: devId,
        dayKey: todayKey(),
        senderRole: "project_manager"
      }
    });

    const sent = await request(app)
      .post("/pm/check-ins")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({
        projectId: project.id,
        developerId: devId,
        useAi: false,
        message: `Pat checking in on ${SEED_PROJECT_NAME} — how is delivery feeling today?`
      });
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);

    const conversationId = sent.body.conversationId as string;
    const messageId = sent.body.messageId as string;
    const checkInId = sent.body.id as string;

    expect(conversationId).toBeTruthy();
    expect(messageId).toBeTruthy();

    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    expect(msg?.senderId).toBe(pmId);
    expect(msg?.content).toContain(SEED_PROJECT_NAME);
    expect((msg?.metadata as { projectId?: string })?.projectId).toBe(project.id);

    const devConvs = await request(app)
      .get("/chat-community/conversations")
      .set("Authorization", `Bearer ${devToken}`);
    expect(devConvs.status).toBe(200);
    const dm = (devConvs.body.data?.conversations as { id: string }[]).find((c) => c.id === conversationId);
    expect(dm).toBeTruthy();

    const pmList = await request(app)
      .get("/pm/check-ins")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(pmList.status).toBe(200);
    const listed = (pmList.body as { id: string; conversationId: string | null }[]).find(
      (r) => r.id === checkInId
    );
    expect(listed?.conversationId).toBe(conversationId);
  });
});
