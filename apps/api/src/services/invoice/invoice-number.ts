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

/** Per-project finance reference: PPP/II/YY (e.g. 001/01/26). */
export function formatProjectInvoiceNumber(
  projectSeq: number,
  invoiceOrdinal: number,
  refYear: number
): string {
  const yy = String(refYear % 100).padStart(2, "0");
  return `${String(projectSeq).padStart(3, "0")}/${String(invoiceOrdinal).padStart(2, "0")}/${yy}`;
}

/**
 * Next invoice number for a project-linked invoice; increments persisted per-project counter.
 * Falls back to org-wide CD-INV when finance fields are missing (pre-migration rows).
 */
export async function allocateNextProjectInvoiceNumber(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string,
  referenceDate: Date
): Promise<string> {
  const project = await tx.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null },
    select: {
      id: true,
      financeProjectSeq: true,
      financeRefYear: true,
      nextInvoiceOrdinal: true
    }
  });
  if (!project) {
    throw Object.assign(new Error("Project not found"), { code: "PROJECT_NOT_FOUND" });
  }
  if (project.financeProjectSeq == null || project.financeRefYear == null) {
    return allocateNextInvoiceNumber(tx, orgId, referenceDate);
  }
  const ord = project.nextInvoiceOrdinal;
  const number = formatProjectInvoiceNumber(project.financeProjectSeq, ord, project.financeRefYear);
  await tx.project.update({
    where: { id: projectId },
    data: { nextInvoiceOrdinal: ord + 1 }
  });
  return number;
}

export async function allocateInvoiceNumberForCreate(
  tx: Prisma.TransactionClient,
  orgId: string,
  projectId: string | null | undefined,
  referenceDate: Date
): Promise<string> {
  if (projectId) {
    return allocateNextProjectInvoiceNumber(tx, orgId, projectId, referenceDate);
  }
  return allocateNextInvoiceNumber(tx, orgId, referenceDate);
}
