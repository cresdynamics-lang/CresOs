import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";

const prisma = new PrismaClient();
const app = createApp(prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Public & auth boundary", () => {
  it("GET /health returns ok", async () => {
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

describe.skipIf(!hasDb)("Integration (DATABASE_URL set)", () => {
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
});
