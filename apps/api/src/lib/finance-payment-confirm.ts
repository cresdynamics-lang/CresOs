import { Prisma, type PrismaClient, type Prisma as PrismaTypes } from "@prisma/client";
import { recalcProjectAmountReceived } from "./project-payment-sync";

export async function sumConfirmedPaymentsOnInvoice(
  client: PrismaClient | PrismaTypes.TransactionClient,
  invoiceId: string
): Promise<number> {
  const paidOnInvoice = await client.payment.aggregate({
    where: { invoiceId, status: "confirmed", deletedAt: null },
    _sum: { amount: true }
  });
  return Number(paidOnInvoice._sum.amount ?? 0);
}

export async function adjustProjectAmountReceived(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  delta: number
): Promise<void> {
  if (!projectId || !delta) return;
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { amountReceived: true }
  });
  if (!project) return;
  const current = project.amountReceived != null ? Number(project.amountReceived) : 0;
  const next = Math.max(0, Math.round((current + delta) * 100) / 100);
  await tx.project.update({
    where: { id: projectId },
    data: { amountReceived: new Prisma.Decimal(next.toFixed(2)) }
  });
}

/** Confirm a pending payment and roll invoice/project side effects (run inside `prisma.$transaction`). */
export async function confirmPaymentCore(
  tx: PrismaTypes.TransactionClient,
  payment: {
    id: string;
    invoiceId: string | null;
    howToProceed: string | null;
    amount: Prisma.Decimal;
  },
  fields: { source: string; account: string; reference: string; howToProceed?: string | null }
): Promise<{ invoiceStatus?: string; invoiceNumber?: string; paidTotal?: number; invoiceTotal?: number }> {
  const sourceVal = fields.source.trim() || "Finance AI";
  const accountVal = fields.account.trim() || "Operations";
  const referenceVal = fields.reference.trim();
  const howToProceedVal =
    fields.howToProceed !== undefined ? fields.howToProceed : payment.howToProceed;

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      source: sourceVal,
      account: accountVal,
      reference: referenceVal,
      howToProceed: howToProceedVal ?? null,
      status: "confirmed"
    }
  });

  if (!payment.invoiceId) return {};

  const inv = await tx.invoice.findUnique({
    where: { id: payment.invoiceId },
    select: { projectId: true, totalAmount: true, number: true, orgId: true }
  });
  if (!inv) return {};

  if (inv.projectId) {
    await recalcProjectAmountReceived(tx, inv.projectId);
  }

  const paidOnInvoice = await tx.payment.aggregate({
    where: {
      invoiceId: payment.invoiceId,
      status: "confirmed",
      deletedAt: null
    },
    _sum: { amount: true }
  });
  const invoiceTotal = Number(inv.totalAmount);
  const paidTotal = Number(paidOnInvoice._sum.amount ?? 0);
  let nextStatus = "sent";
  if (invoiceTotal > 0 && paidTotal >= invoiceTotal - 0.01) nextStatus = "paid";
  else if (paidTotal > 0) nextStatus = "partial";

  await tx.invoice.update({
    where: { id: payment.invoiceId },
    data: { status: nextStatus }
  });

  if (nextStatus === "paid") {
    await tx.projectManagementMonth.updateMany({
      where: { orgId: inv.orgId, invoiceId: payment.invoiceId, paid: false },
      data: { paid: true, paidAt: new Date() }
    });
  }

  return {
    invoiceStatus: nextStatus,
    invoiceNumber: inv.number,
    paidTotal,
    invoiceTotal
  };
}

export async function confirmAssistantPayment(
  prisma: PrismaClient,
  paymentId: string,
  opts: {
    source?: string | null;
    account?: string | null;
    reference: string;
    howToProceed?: string | null;
    projectId?: string | null;
  }
): Promise<{ invoiceStatus?: string; invoiceNumber?: string; projectReceivedDelta?: number }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: { id: true, invoiceId: true, howToProceed: true, amount: true, orgId: true }
  });
  if (!payment) throw new Error("Payment not found");

  const fields = {
    source: opts.source?.trim() || "Finance AI",
    account: opts.account?.trim() || "Operations",
    reference: opts.reference.trim(),
    howToProceed: opts.howToProceed ?? payment.howToProceed
  };

  let invoiceApply: Awaited<ReturnType<typeof confirmPaymentCore>> = {};
  await prisma.$transaction(async (tx) => {
    invoiceApply = await confirmPaymentCore(tx, payment, fields);
    if (!payment.invoiceId && opts.projectId) {
      await adjustProjectAmountReceived(tx, opts.projectId, Number(payment.amount));
    }
  });

  return {
    ...invoiceApply,
    projectReceivedDelta: !payment.invoiceId && opts.projectId ? Number(payment.amount) : undefined
  };
}
