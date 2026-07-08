import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/create-app";
import { financeAssistantMaxAmount } from "../src/lib/finance-assistant-guardrails";
import { enrichFinanceActionPreviews } from "../src/lib/finance-assistant-preview";

const prisma = new PrismaClient();
const app = createApp(prisma);
const hasDb = Boolean(process.env.DATABASE_URL);

afterAll(async () => {
  await prisma.$disconnect();
});

async function loginAsFinance(): Promise<string> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "finance@cresdynamics.com", password: "Cres@Team2026#" });
  if (res.status !== 200 || !res.body.accessToken) throw new Error("finance login failed");
  return res.body.accessToken as string;
}

describe.skipIf(!hasDb)("Finance AI Phase 4 — sessions & previews", () => {
  it("GET /finance/assistant/sessions returns recent sessions", async () => {
    const token = await loginAsFinance();
    await request(app)
      .post("/finance/assistant/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Summarize expenses briefly", mode: "intelligence" });

    const res = await request(app)
      .get("/finance/assistant/sessions?limit=5")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThan(0);
  });

  it("enrichFinanceActionPreviews adds project impact for payment actions", async () => {
    const orgId = (await prisma.user.findFirst({
      where: { email: "finance@cresdynamics.com", deletedAt: null },
      select: { orgId: true }
    }))!.orgId;
    const project = await prisma.project.findFirst({
      where: { orgId, deletedAt: null, name: { contains: "Acme", mode: "insensitive" } },
      select: { name: true, amountReceived: true }
    });
    expect(project).toBeTruthy();

    const enriched = await enrichFinanceActionPreviews(prisma, orgId, [
      {
        id: "preview-1",
        kind: "create_payment",
        title: "Test payment preview",
        amount: 5000,
        currency: "KES",
        projectHint: project!.name
      }
    ]);
    expect(enriched[0].impactPreview?.projectName).toContain("Acme");
    expect(enriched[0].impactPreview?.projectReceivedAfter).toBe(
      Number(project!.amountReceived ?? 0) + 5000
    );
  });
});

describe.skipIf(!hasDb)("Finance AI Phase 5 — guardrails", () => {
  it("rejects developer role on finance assistant", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "wilson.developer@cresdynamics.com", password: "Cres@Team2026#" });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/finance/assistant/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "hello", mode: "execute" });
    expect(res.status).toBe(403);
  });

  it("execute rejects amount above cap", async () => {
    const token = await loginAsFinance();
    const overCap = financeAssistantMaxAmount() + 1;
    const res = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({
        actions: [
          {
            id: "cap-test",
            kind: "create_payment",
            title: "Over cap payment",
            amount: overCap,
            method: "mpesa",
            receivedAt: new Date().toISOString().slice(0, 10)
          }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(0);
    expect(res.body.results[0].error).toContain("cap");
  });

  it("execute skips duplicate payments with same reference", async () => {
    const token = await loginAsFinance();
    const suffix = Date.now();
    const ref = `E2E-DUP-${suffix}`;
    const amount = 777_000 + (suffix % 1000);
    const action = {
      id: `dup-pay-${suffix}`,
      kind: "create_payment" as const,
      title: `E2E duplicate payment ${suffix}`,
      amount,
      currency: "KES",
      method: "mpesa",
      transactionCode: ref,
      receivedAt: new Date().toISOString().slice(0, 10)
    };

    const first = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions: [action] });
    expect(first.status).toBe(200);
    expect(first.body.succeeded).toBe(1);

    const second = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions: [{ ...action, id: `dup-pay-2-${suffix}` }] });
    expect(second.status).toBe(200);
    expect(second.body.succeeded).toBe(0);
    expect(second.body.results[0].error).toContain("duplicate");
  });
});
