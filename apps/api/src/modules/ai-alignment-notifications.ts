/**
 * AI-generated alignment notifications: what's going on and how to bridge/align
 * work and tasks to hit expected targets. Sent to sales, developers, director, admin.
 * Uses Groq (env GROQ_API_KEY); throttled to once per 6 hours per org.
 */

import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";
import Groq from "groq-sdk";

const GROQ_MODEL = process.env.GROQ_REMINDER_MODEL ?? "llama-3.1-8b-instant";
const THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours
const NOTIFICATION_TYPE = "ai_alignment";

let groqClient: Groq | null = null;

function getClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key?.trim()) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: key });
  return groqClient;
}

type RoleMessage = { subject: string; body: string };

type AlignmentOutput = {
  sales?: RoleMessage;
  developer?: RoleMessage;
  director?: RoleMessage;
  admin?: RoleMessage;
};

async function getUserIdByRoleKeys(prisma: PrismaClient, orgId: string, roleKeys: string[]): Promise<string[]> {
  const memberIds = (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
  const roles = await prisma.role.findMany({
    where: { orgId, key: { in: roleKeys } },
    select: { id: true }
  });
  if (roles.length === 0) return [];
  const roleIds = roles.map((r) => r.id);
  const userIds = (await prisma.userRole.findMany({ where: { roleId: { in: roleIds } }, select: { userId: true } })).map((r) => r.userId);
  return [...new Set(memberIds.filter((id) => userIds.includes(id)))];
}

async function generateAlignment(prisma: PrismaClient, orgId: string): Promise<AlignmentOutput | null> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    tasks,
    developerReports,
    projects,
    scheduleItems,
    salesReports,
    meetingRequests,
    overdueTasks,
    payments,
    expenses,
    invoices
  ] = await Promise.all([
    prisma.task.findMany({
      where: { orgId, deletedAt: null },
      select: { title: true, status: true, dueDate: true, assigneeId: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    prisma.developerReport.findMany({
      where: { orgId },
      orderBy: { reportDate: "desc" },
      take: 15,
      select: { reportDate: true, whatWorked: true, blockers: true, needsAttention: true, implemented: true, pending: true, nextPlan: true }
    }),
    prisma.project.findMany({
      where: { orgId, deletedAt: null },
      select: { name: true, status: true, approvalStatus: true, assignedDeveloperId: true },
      take: 30
    }),
    prisma.scheduleItem.findMany({
      where: { orgId, scheduledAt: { gte: now }, completedAt: null },
      orderBy: { scheduledAt: "asc" },
      take: 20,
      select: { title: true, type: true, scheduledAt: true }
    }),
    prisma.salesReport.findMany({
      where: { orgId, status: "submitted", submittedAt: { gte: sevenDaysAgo } },
      select: { submittedAt: true },
      take: 20
    }),
    prisma.meetingRequest.findMany({
      where: { orgId, status: "pending" },
      select: { reason: true, createdAt: true }
    }),
    prisma.task.findMany({
      where: { orgId, deletedAt: null, status: { not: "done" }, dueDate: { lt: now } },
      select: { title: true, dueDate: true }
    }),
    prisma.payment.findMany({
      where: { orgId, deletedAt: null },
      select: { amount: true, status: true, receivedAt: true }
    }),
    prisma.expense.findMany({
      where: { orgId, deletedAt: null },
      select: { amount: true, spentAt: true }
    }),
    prisma.invoice.findMany({
      where: { orgId, deletedAt: null },
      select: { totalAmount: true, status: true, issueDate: true }
    })
  ]);

  const taskSummary = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: overdueTasks.length,
    byStatus: tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>)
  };
  const recentBlockers = developerReports
    .filter((r) => r.blockers?.trim())
    .map((r) => r.blockers!.slice(0, 120))
    .slice(0, 5);
  const recentNeedsAttention = developerReports
    .filter((r) => r.needsAttention?.trim())
    .map((r) => r.needsAttention!.slice(0, 120))
    .slice(0, 5);
  const projectSummary = {
    total: projects.length,
    byStatus: projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>),
    approved: projects.filter((p) => p.approvalStatus === "approved").length
  };

  const totalPayments = payments.reduce((sum, p) => {
    const raw = (p.amount as any)?.toNumber?.();
    const val = raw != null ? raw : Number(p.amount) || 0;
    return sum + val;
  }, 0);
  const totalExpenses = expenses.reduce((sum, e) => {
    const raw = (e.amount as any)?.toNumber?.();
    const val = raw != null ? raw : Number(e.amount) || 0;
    return sum + val;
  }, 0);
  const openInvoices = invoices.filter((i) => ["sent", "partial", "overdue"].includes((i.status as any) ?? ""));

  const context = {
    tasks: taskSummary,
    overdueTaskTitles: overdueTasks.slice(0, 10).map((t) => ({ title: t.title, due: t.dueDate })),
    developerReportsCount: developerReports.length,
    recentBlockers,
    recentNeedsAttention,
    projects: projectSummary,
    upcomingScheduleCount: scheduleItems.length,
    nextScheduleItems: scheduleItems.slice(0, 5).map((s) => ({ title: s.title, type: s.type, at: s.scheduledAt })),
    salesReportsLast7Days: salesReports.length,
    pendingMeetingRequests: meetingRequests.length,
    finance: {
      totalPayments,
      totalExpenses,
      netCash: totalPayments - totalExpenses,
      openInvoiceCount: openInvoices.length,
      financeDiscipline: {
        businessBankAccount: {
          rule: "Use a dedicated business bank account for all client payments and business expenses. No personal mixing.",
          benefit: "Creates a clean audit trail so investors, directors, and accountants can see exactly what happened.",
          keep: "Open or confirm a business account this week. Route 100% of business money in/out through it and attach a receipt or invoice to every transaction."
        },
        monthlyBankReconciliation: {
          rule: "Do a monthly bank reconciliation: match the bank statement to CresOS records (payments, expenses, payouts).",
          benefit: "Catches errors, leaks, or fraud quickly instead of at year-end.",
          keep: "Block 30 minutes at month-end to reconcile: date, description, amount in, amount out, and differences."
        },
        incomeStatement: {
          rule: "Maintain a monthly income statement: revenue minus expenses equals profit.",
          benefit: "Shows whether the business is really profitable or just moving cash.",
          keep: "At month-end, summarize money in vs money out from CresOS and lock a simple statement for the Director and Finance."
        },
        balanceSheet: {
          rule: "Keep a simple balance sheet: what the org owns (cash, receivables, equipment) minus what it owes (loans, vendor debt).",
          benefit: "Investors and banks use this to judge financial health and risk.",
          keep: "List assets and liabilities at month-end and review net worth trend with Director/Admin."
        },
        taxRecords: {
          rule: "Keep every invoice you send and every receipt for business expenses (digital is fine).",
          benefit: "When tax time or audit comes, you can prove every shilling.",
          keep: "Store invoices and receipts in CresOS-linked folders and avoid missing documents for any transaction."
        }
      }
    }
  };

  const client = getClient();
  if (!client) return null;

  const systemPrompt = `You are an alignment and operations coach for a team (sales, developers, director, admin). Given a JSON snapshot of the org's current state (tasks, reports, projects, schedule, meeting requests, finance metrics, and finance discipline rules), produce a short, actionable alignment message for each role.

Output a JSON object only, with up to four keys: "sales", "developer", "director", "admin". Each value must be an object: { "subject": "Short subject under 60 chars", "body": "2-4 sentences: what's going on and 1-3 concrete steps to bridge gaps and align work to hit expected targets." }

Rules:
- Be specific to the data (mention blockers, overdue tasks, pending meetings, report gaps if relevant).
- For director and admin, explicitly reinforce finance governance where useful: separate business bank account, monthly bank reconciliation, monthly income statement, simple balance sheet, and complete tax records (invoices and receipts).
- Suggest clear next actions (e.g. "Resolve the 3 overdue tasks on X project", "Submit your report to unblock visibility", "Align with developer on Y blocker", "Schedule this month’s bank reconciliation in CresOS and attach missing receipts").
- Tone: professional, direct, supportive. No fluff.
- Plain text only, no markdown.`;

  const userMessage = `Current org snapshot (JSON):\n${JSON.stringify(context, null, 0)}`;

  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1024,
      temperature: 0.4
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as AlignmentOutput;
    return parsed;
  } catch {
    return null;
  }
}

export async function processAiAlignmentNotifications(prisma: PrismaClient, orgId: string): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: { orgId, type: NOTIFICATION_TYPE, channel: "in_app" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  if (recent && Date.now() - recent.createdAt.getTime() < THROTTLE_MS) return;

  const alignment = await generateAlignment(prisma, orgId);
  if (!alignment) return;

  const roleMap: (keyof AlignmentOutput)[] = ["sales", "developer", "director", "admin"];
  const roleKeyMap: Record<string, string[]> = {
    sales: [ROLE_KEYS.sales],
    developer: [ROLE_KEYS.developer],
    director: [ROLE_KEYS.director],
    admin: [ROLE_KEYS.admin]
  };

  for (const role of roleMap) {
    const msg = alignment[role];
    if (!msg?.subject || !msg?.body) continue;
    const keys = roleKeyMap[role];
    if (!keys?.length) continue;
    const userIds = await getUserIdByRoleKeys(prisma, orgId, keys);
    for (const userId of userIds) {
      await prisma.notification.create({
        data: {
          orgId,
          channel: "in_app",
          to: userId,
          subject: msg.subject.slice(0, 200),
          body: msg.body.slice(0, 2000),
          status: "sent",
          type: NOTIFICATION_TYPE,
          tier: role === "admin" ? "structural" : role === "director" ? "governance" : "execution"
        }
      });
    }
  }
  await logAdminActivity(prisma, {
    orgId,
    type: "ai_alignment_sent",
    summary: "AI alignment notifications sent to sales, developers, director, and admin.",
    body: "Role-specific suggestions on what's going on and how to align work to hit targets."
  });
}
