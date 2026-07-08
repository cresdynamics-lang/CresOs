import type { PrismaClient } from "@prisma/client";
import { formatTeamUsersBlock, findOrgUsersForKnowledgeSearch } from "./knowledge-team-index";

export async function buildFinanceAssistantContextBlock(
  prisma: PrismaClient,
  orgId: string,
  userMessage?: string
): Promise<string> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [recentExpenses, recentPayments, projects, invoices, poolStats] = await Promise.all([
    prisma.expense.findMany({
      where: { orgId, deletedAt: null, spentAt: { gte: thirtyDaysAgo } },
      select: {
        category: true,
        amount: true,
        currency: true,
        spentAt: true,
        description: true,
        beneficiary: { select: { name: true, email: true } }
      },
      orderBy: { spentAt: "desc" },
      take: 15
    }),
    prisma.payment.findMany({
      where: { orgId, deletedAt: null, receivedAt: { gte: thirtyDaysAgo } },
      select: {
        amount: true,
        currency: true,
        method: true,
        receivedAt: true,
        reference: true,
        source: true,
        invoice: { select: { number: true } }
      },
      orderBy: { receivedAt: "desc" },
      take: 15
    }),
    prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      select: { id: true, name: true, status: true, amountReceived: true },
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.invoice.findMany({
      where: { orgId, deletedAt: null, status: { in: ["APPROVED", "PENDING", "PARTIALLY_PAID"] } },
      select: { id: true, number: true, totalAmount: true, status: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15
    }),
    prisma.knowledgeChunk.count({ where: { orgId } })
  ]);

  const expenseLines = recentExpenses.map((e) => {
    const who = e.beneficiary?.name || e.beneficiary?.email || "?";
    return `- ${e.spentAt.toISOString().slice(0, 10)} ${e.category} ${Number(e.amount)} ${e.currency} for ${who}: ${e.description ?? ""}`;
  });

  const paymentLines = recentPayments.map((p) => {
    const inv = p.invoice?.number ? ` invoice ${p.invoice.number}` : "";
    return `- ${p.receivedAt.toISOString().slice(0, 10)} ${p.method} ${Number(p.amount)} ${p.currency}${inv} ref ${p.reference ?? "—"}`;
  });

  const projectLines = projects.map(
    (p) => `• ${p.name} [${p.status}] received ${Number(p.amountReceived ?? 0)} KES id=${p.id}`
  );
  const invoiceLines = invoices.map(
    (i) => `• INV-${i.number} ${Number(i.totalAmount)} KES [${i.status}] client ${i.client?.name ?? "?"}`
  );

  let teamBlock = "";
  if (userMessage?.trim()) {
    const matched = await findOrgUsersForKnowledgeSearch(prisma, orgId, userMessage.trim());
    if (matched.length) teamBlock = formatTeamUsersBlock(matched);
  }

  return [
    `RECENT EXPENSES (30d):`,
    expenseLines.join("\n") || "(none)",
    "",
    `RECENT PAYMENTS (30d):`,
    paymentLines.join("\n") || "(none)",
    "",
    `PROJECTS:`,
    projectLines.join("\n") || "(none)",
    "",
    `OPEN INVOICES:`,
    invoiceLines.join("\n") || "(none)",
    "",
    `Knowledge pool items: ${poolStats}`,
    teamBlock ? `\nMATCHED TEAM:\n${teamBlock}` : ""
  ].join("\n");
}
