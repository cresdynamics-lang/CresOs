import type { PrismaClient } from "@prisma/client";
import type { FinanceActionImpactPreview, FinanceProposedAction } from "./finance-assistant-types";
import { resolveProjectHint } from "./admin-assistant-resolve";

async function resolveInvoiceForPreview(
  prisma: PrismaClient,
  orgId: string,
  hint: string | null | undefined
): Promise<{ id: string; number: string; total: number; projectId: string | null } | null> {
  const trimmed = hint?.trim();
  if (!trimmed) return null;
  const num = trimmed.replace(/^INV-?/i, "");
  const invoice = await prisma.invoice.findFirst({
    where: {
      orgId,
      deletedAt: null,
      OR: [{ number: { contains: num, mode: "insensitive" } }, { id: trimmed }]
    },
    select: { id: true, number: true, totalAmount: true, projectId: true }
  });
  if (!invoice) return null;
  return {
    id: invoice.id,
    number: invoice.number,
    total: Number(invoice.totalAmount),
    projectId: invoice.projectId
  };
}

async function sumConfirmedOnInvoice(prisma: PrismaClient, invoiceId: string): Promise<number> {
  const agg = await prisma.payment.aggregate({
    where: { invoiceId, status: "confirmed", deletedAt: null },
    _sum: { amount: true }
  });
  return Number(agg._sum.amount ?? 0);
}

export async function buildFinanceActionImpactPreview(
  prisma: PrismaClient,
  orgId: string,
  action: FinanceProposedAction
): Promise<FinanceActionImpactPreview | undefined> {
  if (action.kind !== "create_payment" || action.amount == null || action.amount <= 0) {
    return undefined;
  }

  const amount = Number(action.amount);
  const preview: FinanceActionImpactPreview = {};

  const invoice = await resolveInvoiceForPreview(prisma, orgId, action.invoiceHint);
  if (invoice) {
    const paidBefore = await sumConfirmedOnInvoice(prisma, invoice.id);
    preview.invoiceNumber = invoice.number;
    preview.invoiceTotal = invoice.total;
    preview.invoicePaidBefore = paidBefore;
    preview.invoicePaidAfter = Math.min(invoice.total, paidBefore + amount);
    preview.invoiceRemainingBefore = Math.max(0, invoice.total - paidBefore);
    preview.invoiceRemainingAfter = Math.max(0, invoice.total - preview.invoicePaidAfter);
  }

  let projectId: string | null = invoice?.projectId ?? null;
  if (!projectId && action.projectHint?.trim()) {
    const proj = await resolveProjectHint(prisma, orgId, action.projectHint);
    if (proj.ok) projectId = proj.id;
  }

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, deletedAt: null },
      select: { name: true, amountReceived: true }
    });
    if (project) {
      const before = Number(project.amountReceived ?? 0);
      preview.projectName = project.name;
      preview.projectReceivedBefore = before;
      preview.projectReceivedAfter = before + amount;
    }
  }

  return Object.keys(preview).length ? preview : undefined;
}

export async function enrichFinanceActionPreviews(
  prisma: PrismaClient,
  orgId: string,
  actions: FinanceProposedAction[]
): Promise<FinanceProposedAction[]> {
  const out: FinanceProposedAction[] = [];
  for (const action of actions) {
    const impactPreview = await buildFinanceActionImpactPreview(prisma, orgId, action);
    out.push(impactPreview ? { ...action, impactPreview } : action);
  }
  return out;
}
