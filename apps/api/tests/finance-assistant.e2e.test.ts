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

async function loginAsFinance(): Promise<string> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "finance@cresdynamics.com", password: "Cres@Team2026#" });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(`finance login failed: ${res.status}`);
  }
  return res.body.accessToken as string;
}

describe.skipIf(!hasDb)("Finance AI Assistant Phase 2", () => {
  it("rejects unauthenticated finance assistant", async () => {
    const res = await request(app)
      .post("/finance/assistant/chat")
      .send({ message: "hello", mode: "execute" });
    expect(res.status).toBe(401);
  });

  it("POST /finance/assistant/execute records expense", async () => {
    const token = await loginAsFinance();
    const wilson = await prisma.user.findFirst({
      where: { email: "wilson.developer@cresdynamics.com", deletedAt: null }
    });
    expect(wilson).toBeTruthy();

    const suffix = `${Date.now()}`;
    const actions = [
      {
        id: `fin-exp-${suffix}`,
        kind: "create_expense" as const,
        title: `E2E transport reimbursement ${suffix}`,
        amount: 2500,
        currency: "KES",
        category: "transport",
        beneficiaryHint: "Wilson",
        spentAt: new Date().toISOString().slice(0, 10)
      }
    ];

    const res = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions });

    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.results[0].expenseId).toBeTruthy();

    const expense = await prisma.expense.findUnique({
      where: { id: res.body.results[0].expenseId }
    });
    expect(expense?.category).toBe("transport");
    expect(Number(expense?.amount)).toBe(2500);
    expect(expense?.beneficiaryUserId).toBe(wilson!.id);
  });

  it("POST /finance/assistant/execute records payment", async () => {
    const token = await loginAsFinance();
    const suffix = `${Date.now()}`;
    const actions = [
      {
        id: `fin-pay-${suffix}`,
        kind: "create_payment" as const,
        title: `E2E client M-Pesa payment ${suffix}`,
        amount: 10000,
        currency: "KES",
        method: "mpesa",
        transactionCode: `E2E-MPESA-${suffix}`,
        receivedAt: new Date().toISOString().slice(0, 10),
        source: `E2E Client ${suffix}`
      }
    ];

    const res = await request(app)
      .post("/finance/assistant/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({ actions });

    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.results[0].paymentId).toBeTruthy();

    const payment = await prisma.payment.findUnique({
      where: { id: res.body.results[0].paymentId }
    });
    expect(Number(payment?.amount)).toBe(10000);
    expect(payment?.method).toBe("mpesa");
    expect(payment?.status).toBe("confirmed");
  });
});
