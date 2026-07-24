import type { PrismaClient } from "@prisma/client";
import { formatTeamUsersBlock, findOrgUsersForKnowledgeSearch } from "./knowledge-team-index";
import { fetchKnowledgeChunks } from "./knowledge-context";

/** Finance-relevant knowledge sources (admin still gets these + live ledger). */
const FINANCE_KNOWLEDGE_SOURCES = new Set([
  "invoice",
  "payment",
  "expense",
  "project_snapshot",
  "event_log",
  "admin_activity",
  "team_member",
  "message",
  "email_thread",
  "sales_report",
  "planning_note"
]);

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function buildFinanceAssistantContextBlock(
  prisma: PrismaClient,
  orgId: string,
  userMessage?: string
): Promise<string> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const q = userMessage?.trim();

  const [recentExpenses, recentPayments, projects, invoices, poolStats, knowledgeChunks] =
    await Promise.all([
      prisma.expense.findMany({
        where: { orgId, deletedAt: null, spentAt: { gte: thirtyDaysAgo } },
        select: {
          category: true,
          amount: true,
          currency: true,
          spentAt: true,
          description: true,
          status: true,
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
          status: true,
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
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["draft", "sent", "partial", "overdue"] }
        },
        select: {
          id: true,
          number: true,
          totalAmount: true,
          status: true,
          client: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 15
      }),
      prisma.knowledgeChunk.count({ where: { orgId } }),
      fetchKnowledgeChunks(prisma, orgId, {
        q: q || undefined,
        sinceDays: q ? 90 : 45,
        limit: 30
      })
    ]);

  const expenseLines = recentExpenses.map((e) => {
    const who = e.beneficiary?.name || e.beneficiary?.email || "?";
    return `- ${e.spentAt.toISOString().slice(0, 10)} [${e.status}] ${e.category} ${Number(e.amount)} ${e.currency} for ${who}: ${e.description ?? ""}`;
  });

  const paymentLines = recentPayments.map((p) => {
    const inv = p.invoice?.number ? ` invoice ${p.invoice.number}` : "";
    return `- ${p.receivedAt.toISOString().slice(0, 10)} [${p.status}] ${p.method} ${Number(p.amount)} ${p.currency}${inv} ref ${p.reference ?? "—"}`;
  });

  const projectLines = projects.map(
    (p) => `• ${p.name} [${p.status}] received ${Number(p.amountReceived ?? 0)} KES id=${p.id}`
  );
  const invoiceLines = invoices.map(
    (i) => `• INV-${i.number} ${Number(i.totalAmount)} KES [${i.status}] client ${i.client?.name ?? "?"}`
  );

  const financeChunks = knowledgeChunks.filter(
    (c) => FINANCE_KNOWLEDGE_SOURCES.has(c.sourceType) || FINANCE_KNOWLEDGE_SOURCES.has(c.kind)
  );
  const knowledgeLines =
    financeChunks.length === 0
      ? ["(No finance-scoped knowledge chunks matched — rely on ledger tables above.)"]
      : financeChunks.map(
          (c, i) =>
            `[${i + 1}] ${c.sourceType}/${c.kind} · ${c.occurredAt.toISOString().slice(0, 10)}\n` +
            `${c.title ? `Title: ${c.title}\n` : ""}${truncate(c.content, 500)}`
        );

  let teamBlock = "";
  if (q) {
    const matched = await findOrgUsersForKnowledgeSearch(prisma, orgId, q);
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
    `Knowledge pool items (org total): ${poolStats}`,
    `=== FINANCE-SCOPED KNOWLEDGE POOL (${financeChunks.length} excerpts) ===`,
    ...knowledgeLines,
    teamBlock ? `\nMATCHED TEAM:\n${teamBlock}` : ""
  ].join("\n");
}
