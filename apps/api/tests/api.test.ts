import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";
import { ROLE_KEYS } from "../src/modules/auth-middleware";

const prisma = new PrismaClient();
const app = createApp(prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Public & auth boundary", () => {
  it("GET /health returns ok (liveness, no DB)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("cresos-api");
    expect(res.body.timestamp).toBeTruthy();
  });

  it("GET /account/me without token returns 401", async () => {
    const res = await request(app).get("/account/me");
    expect(res.status).toBe(401);
  });

  it("GET /analytics/summary without token returns 401", async () => {
    const res = await request(app).get("/analytics/summary");
    expect(res.status).toBe(401);
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);

async function grantRole(userId: string, orgId: string, roleKey: string) {
  const role = await prisma.role.findFirst({
    where: { orgId, key: roleKey }
  });
  if (!role) throw new Error(`missing role ${roleKey}`);
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id }
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }
}

describe.skipIf(!hasDb)("Integration (DATABASE_URL set)", () => {
  it("GET /health/ready returns database ok", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.database).toBe("ok");
    expect(res.body.status).toBe("ok");
  });

  it("register → login → GET /account/me includes org", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";
    const orgName = `E2E Org ${suffix}`;

    const reg = await request(app).post("/auth/register").send({
      orgName,
      name: "E2E User",
      email,
      password
    });
    expect(reg.status).toBe(200);
    expect(reg.body.accessToken).toBeTruthy();
    expect(reg.body.user?.email).toBe(email);
    expect(reg.body.org?.name).toBe(orgName);

    const login = await request(app).post("/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;
    expect(token).toBeTruthy();
    expect(login.body.org?.name).toBe(orgName);

    const me = await request(app)
      .get("/account/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
    expect(me.body.org?.name).toBe(orgName);
  });

  it("GET /analytics/summary with director token returns metrics", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-sum-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";
    const reg = await request(app).post("/auth/register").send({
      orgName: `E2E Sum ${suffix}`,
      name: "Director User",
      email,
      password
    });
    expect(reg.status).toBe(200);
    const token = reg.body.accessToken as string;

    const sum = await request(app)
      .get("/analytics/summary")
      .set("Authorization", `Bearer ${token}`);
    expect(sum.status).toBe(200);
    expect(typeof sum.body.activeProjects).toBe("number");
    expect(typeof sum.body.teamMembers).toBe("number");
  });

  it("POST /finance/invoices queues email to client.email when set", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-fin-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";
    const reg = await request(app).post("/auth/register").send({
      orgName: `E2E Finance ${suffix}`,
      name: "Finance Tester",
      email,
      password
    });
    expect(reg.status).toBe(200);
    const orgId = reg.body.org.id as string;
    const userId = reg.body.user.id as string;

    await grantRole(userId, orgId, ROLE_KEYS.finance);

    const login = await request(app).post("/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;
    expect(login.body.roleKeys).toContain(ROLE_KEYS.finance);

    const clientEmailAddr = `client-${suffix}@cresos.test`;
    const client = await prisma.client.create({
      data: {
        orgId,
        name: "Test Client Ltd",
        email: clientEmailAddr
      }
    });

    const invNo = `INV-${suffix}`;
    const res = await request(app)
      .post("/finance/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        clientId: client.id,
        number: invNo,
        issueDate: new Date().toISOString().slice(0, 10),
        currency: "KES",
        items: [{ description: "Service", quantity: 1, unitPrice: "150.00" }]
      });
    expect(res.status).toBe(201);

    const queued = await prisma.notification.findFirst({
      where: {
        orgId,
        channel: "email",
        to: clientEmailAddr,
        type: "invoice.sent"
      }
    });
    expect(queued).toBeTruthy();
    expect(queued?.subject).toContain(invNo);
  });

  it("PATCH /account/me persists notification preferences", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-pref-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";
    const reg = await request(app).post("/auth/register").send({
      orgName: `E2E Prefs ${suffix}`,
      name: "Prefs User",
      email,
      password
    });
    expect(reg.status).toBe(200);
    const token = reg.body.accessToken as string;

    const patch = await request(app)
      .patch("/account/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        notificationPreferences: {
          muteAllInApp: false,
          mutedTiers: ["execution", "governance"]
        }
      });
    expect(patch.status).toBe(200);
    expect(patch.body.notificationPreferences?.muteAllInApp).toBe(false);
    expect(patch.body.notificationPreferences?.mutedTiers).toEqual(
      expect.arrayContaining(["execution", "governance"])
    );

    const me = await request(app)
      .get("/account/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.notificationPreferences?.mutedTiers?.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /notifications/me returns empty when muteAllInApp is true", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-mute-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";
    const reg = await request(app).post("/auth/register").send({
      orgName: `E2E Mute ${suffix}`,
      name: "Mute User",
      email,
      password
    });
    expect(reg.status).toBe(200);
    const orgId = reg.body.org.id as string;
    const userId = reg.body.user.id as string;
    const token = reg.body.accessToken as string;

    await prisma.notification.create({
      data: {
        orgId,
        channel: "in_app",
        to: userId,
        subject: "Test ping",
        body: "Visible unless muted",
        status: "sent",
        type: "test.visibility",
        tier: "execution"
      }
    });

    const before = await request(app)
      .get("/notifications/me")
      .set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(Array.isArray(before.body)).toBe(true);
    expect(before.body.length).toBeGreaterThan(0);

    await request(app)
      .patch("/account/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ notificationPreferences: { muteAllInApp: true, mutedTiers: [] } });

    const after = await request(app)
      .get("/notifications/me")
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body).toEqual([]);
  });

  it("POST /projects as sales creates in-app activity for director", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-sales-${suffix}@cresos.test`;
    const password = "E2E-test-Password-1!";
    const reg = await request(app).post("/auth/register").send({
      orgName: `E2E SalesProj ${suffix}`,
      name: "Sales User",
      email,
      password
    });
    expect(reg.status).toBe(200);
    const orgId = reg.body.org.id as string;
    const userId = reg.body.user.id as string;
    await grantRole(userId, orgId, ROLE_KEYS.sales);

    const login = await request(app).post("/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;

    const proj = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Website build ${suffix}`,
        type: "demo",
        status: "planned"
      });
    expect(proj.status).toBe(201);

    const n = await prisma.notification.findFirst({
      where: {
        orgId,
        channel: "in_app",
        to: userId,
        type: "director.activity"
      }
    });
    expect(n).toBeTruthy();
    expect(n?.subject).toMatch(/New project created/i);
  });
});
