import type { Prisma } from "@prisma/client";

/**
 * Org-wide invoice numbers: monotonic by creation order.
 * Sequence = 1 + count of all Invoice rows for the org (including soft-deleted),
 * so numbers are never reused after delete.
 */
export function formatOrgInvoiceNumber(sequence: number, referenceDate: Date): string {
  const yy = String(referenceDate.getFullYear() % 100).padStart(2, "0");
  return `CD-INV-${String(sequence).padStart(6, "0")}/${yy}`;
}

export async function allocateNextInvoiceNumber(
  tx: Prisma.TransactionClient,
  orgId: string,
  referenceDate: Date
): Promise<string> {
  const totalCreated = await tx.invoice.count({ where: { orgId } });
  return formatOrgInvoiceNumber(totalCreated + 1, referenceDate);
}
