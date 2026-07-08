import type { PrismaClient } from "@prisma/client";

/** Max single record amount via Finance AI (KES). Override with FINANCE_ASSISTANT_MAX_AMOUNT. */
export function financeAssistantMaxAmount(): number {
  const raw = process.env.FINANCE_ASSISTANT_MAX_AMOUNT?.trim();
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 50_000_000;
}

export function exceedsFinanceAmountCap(amount: number): boolean {
  return amount > financeAssistantMaxAmount();
}

export async function findDuplicatePayment(
  prisma: PrismaClient,
  orgId: string,
  opts: {
    amount: number;
    receivedAt: Date;
    reference?: string | null;
    source?: string | null;
  }
): Promise<boolean> {
  const dayStart = new Date(opts.receivedAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const ref = opts.reference?.trim();
  if (ref) {
    const byRef = await prisma.payment.findFirst({
      where: {
        orgId,
        deletedAt: null,
        reference: { equals: ref, mode: "insensitive" },
        status: { in: ["pending", "confirmed"] }
      },
      select: { id: true }
    });
    if (byRef) return true;
  }

  const amountStr = Number(opts.amount).toFixed(2);
  const sameDay = await prisma.payment.findFirst({
    where: {
      orgId,
      deletedAt: null,
      receivedAt: { gte: dayStart, lt: dayEnd },
      amount: amountStr,
      status: { in: ["pending", "confirmed"] },
      ...(opts.source?.trim()
        ? { source: { equals: opts.source.trim(), mode: "insensitive" as const } }
        : {})
    },
    select: { id: true }
  });
  return Boolean(sameDay);
}

export async function findDuplicateExpense(
  prisma: PrismaClient,
  orgId: string,
  opts: {
    amount: number;
    spentAt: Date;
    beneficiaryUserId: string;
    description: string;
  }
): Promise<boolean> {
  const dayStart = new Date(opts.spentAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const existing = await prisma.expense.findFirst({
    where: {
      orgId,
      deletedAt: null,
      beneficiaryUserId: opts.beneficiaryUserId,
      amount: Number(opts.amount).toFixed(2),
      spentAt: { gte: dayStart, lt: dayEnd },
      description: { equals: opts.description.trim(), mode: "insensitive" }
    },
    select: { id: true }
  });
  return Boolean(existing);
}
