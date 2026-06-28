import { Prisma, type PrismaClient } from "@prisma/client";

/** Ensure invoice client matches the linked project's client. */
export async function validateInvoiceClientProject(
  tx: Prisma.TransactionClient,
  orgId: string,
  clientId: string,
  projectId: string | null | undefined
): Promise<void> {
  if (!projectId) return;
  const project = await tx.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null },
    select: { id: true, clientId: true }
  });
  if (!project) {
    throw Object.assign(new Error("Project not found"), { code: "PROJECT_NOT_FOUND" });
  }
  if (project.clientId && project.clientId !== clientId) {
    throw Object.assign(new Error("Client must match project"), { code: "CLIENT_PROJECT_MISMATCH" });
  }
}

/** Sum confirmed payments on all non-deleted invoices for a project. */
export async function recalcProjectAmountReceived(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<number> {
  const invoices = await tx.invoice.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true }
  });
  const invoiceIds = invoices.map((i) => i.id);
  let total = 0;
  if (invoiceIds.length > 0) {
    const paid = await tx.payment.aggregate({
      where: {
        invoiceId: { in: invoiceIds },
        status: "confirmed",
        deletedAt: null
      },
      _sum: { amount: true }
    });
    total = Math.round(Number(paid._sum.amount ?? 0) * 100) / 100;
  }
  await tx.project.update({
    where: { id: projectId },
    data: { amountReceived: new Prisma.Decimal(total.toFixed(2)) }
  });
  return total;
}

export async function recalcOrgProjectReceipts(
  prisma: PrismaClient,
  orgId: string,
  projectId?: string
): Promise<{ updated: number }> {
  const where = projectId
    ? { id: projectId, orgId, deletedAt: null }
    : { orgId, deletedAt: null, approvalStatus: "approved" as const };
  const projects = await prisma.project.findMany({ where, select: { id: true } });
  let updated = 0;
  for (const p of projects) {
    await prisma.$transaction(async (tx) => {
      await recalcProjectAmountReceived(tx, p.id);
    });
    updated += 1;
  }
  return { updated };
}
