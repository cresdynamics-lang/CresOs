import { Prisma, type PrismaClient } from "@prisma/client";
import { allocateInvoiceNumberForCreate } from "../services/invoice/invoice-number";
import { validateInvoiceClientProject } from "./project-payment-sync";

export type AutoInvoiceResult =
  | { ok: true; id: string; label: string; created: boolean }
  | { ok: false; error: string };

/**
 * Resolve an invoice for a Finance AI payment. When no invoice exists for the project,
 * auto-create one so the payment can be recorded and linked.
 */
export async function ensureInvoiceForAssistantPayment(
  prisma: PrismaClient,
  orgId: string,
  input: {
    invoiceHint?: string | null;
    projectId?: string | null;
    amount: number;
    currency: string;
    title: string;
    receivedAt: Date;
  }
): Promise<AutoInvoiceResult> {
  const hint = input.invoiceHint?.trim();
  if (hint) {
    const num = hint.replace(/^INV-?/i, "");
    const existing = await prisma.invoice.findFirst({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ number: { contains: num, mode: "insensitive" } }, { id: hint }]
      },
      select: { id: true, number: true }
    });
    if (existing) {
      return { ok: true, id: existing.id, label: `INV-${existing.number}`, created: false };
    }
  }

  if (!input.projectId) {
    return {
      ok: false,
      error: hint
        ? `No invoice matched "${hint}" — specify a project so Finance AI can create one`
        : "Link a project (or invoice number) to record this payment"
    };
  }

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, orgId, deletedAt: null },
    select: { id: true, name: true, clientId: true }
  });
  if (!project) return { ok: false, error: "Project not found" };
  if (!project.clientId) {
    return {
      ok: false,
      error: `Project "${project.name}" has no client — assign a client before recording payment`
    };
  }

  const openInvoice = await prisma.invoice.findFirst({
    where: {
      orgId,
      projectId: project.id,
      deletedAt: null,
      status: { in: ["sent", "partial", "draft"] }
    },
    orderBy: { issueDate: "desc" },
    select: { id: true, number: true, totalAmount: true }
  });
  if (openInvoice && !hint) {
    return {
      ok: true,
      id: openInvoice.id,
      label: `INV-${openInvoice.number}`,
      created: false
    };
  }

  const issue = input.receivedAt;
  const amountStr = Number(input.amount).toFixed(2);

  const created = await prisma.$transaction(async (tx) => {
    await validateInvoiceClientProject(tx, orgId, project.clientId!, project.id);

    const number = await allocateInvoiceNumberForCreate(tx, orgId, project.id, issue);
    const invoice = await tx.invoice.create({
      data: {
        orgId,
        clientId: project.clientId!,
        projectId: project.id,
        number,
        status: "sent",
        issueDate: issue,
        dueDate: issue,
        currency: input.currency?.trim() || "KES",
        totalAmount: new Prisma.Decimal(amountStr),
        notes: `Auto-created from Finance AI: ${input.title.trim()}`
      }
    });

    await tx.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: input.title.trim() || `Payment — ${project.name}`,
        quantity: 1,
        unitPrice: new Prisma.Decimal(amountStr)
      }
    });

    await tx.eventLog.create({
      data: {
        orgId,
        type: "invoice.created",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { number: invoice.number, source: "finance_assistant_auto" }
      }
    });

    return invoice;
  });

  return {
    ok: true,
    id: created.id,
    label: `INV-${created.number}`,
    created: true
  };
}
