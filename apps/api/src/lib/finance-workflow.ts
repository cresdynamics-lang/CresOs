import type { PrismaClient } from "@prisma/client";
import {
  renderExpenseAdminEmail,
  renderExpenseBeneficiaryReceiptEmail,
  renderPaymentConfirmationEmail
} from "./email-templates";
import { sendOutboundEmail, type SendResult } from "./resend";
import { getAdminUsers, notifyAdminsInApp } from "../modules/director-notifications";
import { logEmailSent } from "../modules/admin-activity";
import { generateExpenseReceiptPdf } from "../services/finance/expense-receipt-pdf";
import { CRES_DYNAMICS_PDF_COMPANY } from "./company-pdf";

export type ProjectProgressSnapshot = {
  projectId: string;
  projectName: string;
  status: string;
  progressPercent: number;
  taskCount: number;
  doneTasks: number;
  milestones: { name: string; status: string; dueDate: string | null }[];
  nextSteps: { title: string; status: string; dueDate: string | null }[];
};

function formatDateLabel(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().split("T")[0] ?? null;
}

function milestoneStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Upcoming",
    in_progress: "In progress",
    completed: "Completed",
    rejected: "Rejected"
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function taskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    todo: "To do",
    in_progress: "In progress",
    blocked: "Blocked",
    done: "Done"
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function loadProjectProgressSnapshot(
  prisma: PrismaClient,
  orgId: string,
  projectId: string
): Promise<ProjectProgressSnapshot | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null },
    select: { id: true, name: true, status: true }
  });
  if (!project) return null;

  const [taskCount, doneTasks, milestones, openTasks] = await Promise.all([
    prisma.task.count({ where: { projectId, orgId, deletedAt: null } }),
    prisma.task.count({ where: { projectId, orgId, deletedAt: null, status: "done" } }),
    prisma.milestone.findMany({
      where: { projectId, orgId, deletedAt: null },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: { name: true, status: true, dueDate: true },
      take: 12
    }),
    prisma.task.findMany({
      where: {
        projectId,
        orgId,
        deletedAt: null,
        status: { not: "done" }
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      select: { title: true, status: true, dueDate: true },
      take: 8
    })
  ]);

  const progressPercent =
    taskCount > 0 ? Math.round((doneTasks / taskCount) * 100) : project.status === "completed" ? 100 : 0;

  const pendingMilestones = milestones
    .filter((m) => m.status !== "completed")
    .slice(0, 4)
    .map((m) => ({
      title: m.name,
      status: milestoneStatusLabel(m.status),
      dueDate: formatDateLabel(m.dueDate)
    }));

  const nextSteps = [
    ...openTasks.map((t) => ({
      title: t.title,
      status: taskStatusLabel(t.status),
      dueDate: formatDateLabel(t.dueDate)
    })),
    ...pendingMilestones
      .filter((m) => !openTasks.some((t) => t.title === m.title))
      .map((m) => ({ title: m.title, status: m.status, dueDate: m.dueDate }))
  ].slice(0, 8);

  return {
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    progressPercent,
    taskCount,
    doneTasks,
    milestones: milestones.map((m) => ({
      name: m.name,
      status: milestoneStatusLabel(m.status),
      dueDate: formatDateLabel(m.dueDate)
    })),
    nextSteps
  };
}

function milestonesTableHtml(
  milestones: ProjectProgressSnapshot["milestones"]
): string {
  if (milestones.length === 0) {
    return `<p style="margin:0;font-size:14px;color:#64748b;">Milestones will be shared as the project plan is finalized.</p>`;
  }
  const rows = milestones
    .map(
      (m) =>
        `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(m.name)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${escapeHtml(m.status)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${escapeHtml(m.dueDate ?? "—")}</td>
        </tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
    <tr style="background:#f8fafc;">
      <th align="left" style="padding:8px 10px;color:#64748b;font-weight:600;">Milestone</th>
      <th align="left" style="padding:8px 10px;color:#64748b;font-weight:600;">Status</th>
      <th align="left" style="padding:8px 10px;color:#64748b;font-weight:600;">Due</th>
    </tr>
    ${rows}
  </table>`;
}

function nextStepsListHtml(steps: ProjectProgressSnapshot["nextSteps"]): string {
  if (steps.length === 0) {
    return `<p style="margin:0;font-size:14px;color:#64748b;">Your team is aligning the next delivery steps — we will update you as work progresses.</p>`;
  }
  const items = steps
    .map((s) => {
      const due = s.dueDate ? ` · due ${s.dueDate}` : "";
      return `<li style="margin:0 0 6px;color:#334155;"><strong>${escapeHtml(s.title)}</strong> <span style="color:#64748b;">(${escapeHtml(s.status)}${due})</span></li>`;
    })
    .join("");
  return `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;">${items}</ul>`;
}

/** Email admins to approve a newly recorded expense. */
export async function sendExpenseAdminApprovalRequest(
  prisma: PrismaClient,
  params: {
    orgId: string;
    expenseId: string;
    category: string;
    amount: number;
    currency: string;
    description?: string | null;
    spentAt: Date;
    recordedByUserId?: string | null;
    source?: string | null;
    transactionCode?: string | null;
    account?: string | null;
    paymentMethod?: string | null;
  }
): Promise<{ sent: boolean; adminCount?: number; skipped?: boolean; reason?: string; error?: string }> {
  const dedupe = await prisma.notification.findFirst({
    where: {
      orgId: params.orgId,
      type: "expense.recorded.admin",
      body: { startsWith: `expenseId:${params.expenseId}` },
      status: "sent"
    },
    select: { id: true }
  });
  if (dedupe) return { sent: false, skipped: true, reason: "already_sent" };

  const amountStr = params.amount.toFixed(2);
  const spentLabel = params.spentAt.toISOString().split("T")[0] ?? params.spentAt.toLocaleDateString();

  let recordedBy: string | null = null;
  if (params.recordedByUserId) {
    const user = await prisma.user.findUnique({
      where: { id: params.recordedByUserId },
      select: { name: true, email: true }
    });
    recordedBy = user?.name?.trim() || user?.email || null;
  }

  const subject = `Expense pending approval — ${params.currency} ${amountStr}`;
  const body =
    `Category: ${params.category}\n` +
    `Amount: ${params.currency} ${amountStr}\n` +
    `Date: ${spentLabel}\n` +
    (params.description?.trim() ? `Description: ${params.description.trim()}\n` : "") +
    (params.source?.trim() ? `Vendor: ${params.source.trim()}\n` : "") +
    (params.transactionCode?.trim() ? `Receipt/ref: ${params.transactionCode.trim()}\n` : "") +
    (recordedBy ? `Recorded by: ${recordedBy}\n` : "") +
    `\nReview under Finance → Expenses / Approvals in CresOS.`;

  await notifyAdminsInApp(prisma, params.orgId, subject, body, {
    type: "expense.recorded",
    tier: "financial"
  });

  const admins = await getAdminUsers(prisma, params.orgId);
  if (admins.length === 0) return { sent: false, skipped: true, reason: "no_admins" };

  const appUrl = (process.env.APP_URL ?? process.env.WEB_URL ?? "https://cresos.cresdynamics.com").replace(
    /\/$/,
    ""
  );
  const { subject: emailSubject, html, text } = renderExpenseAdminEmail({
    category: params.category,
    amount: amountStr,
    currency: params.currency,
    description: params.description,
    spentAt: spentLabel,
    recordedBy,
    source: params.source,
    transactionCode: params.transactionCode,
    account: params.account,
    paymentMethod: params.paymentMethod,
    approvalUrl: `${appUrl}/approvals`
  });

  let sentCount = 0;
  let lastError: string | undefined;

  for (const admin of admins) {
    const result = await sendOutboundEmail({
      to: admin.email,
      subject: emailSubject,
      text,
      html,
      emailChannel: "finance"
    });

    await prisma.notification.create({
      data: {
        orgId: params.orgId,
        channel: "email",
        to: admin.email,
        subject: emailSubject,
        body: `expenseId:${params.expenseId}\n${body}`,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error.slice(0, 900),
        sentAt: new Date(),
        type: "expense.recorded.admin",
        tier: "financial"
      }
    });

    if (result.ok) {
      sentCount += 1;
      await logEmailSent(prisma, {
        orgId: params.orgId,
        to: admin.email,
        subject: emailSubject,
        body: `Expense ${params.expenseId} approval request sent to admin.`,
        type: "expense.recorded.admin"
      });
    } else {
      lastError = result.error;
      console.error("[finance-workflow] expense admin email failed:", result.error);
    }
  }

  return sentCount > 0
    ? { sent: true, adminCount: sentCount }
    : { sent: false, error: lastError ?? "Failed to email admins" };
}

/** @deprecated alias */
export const notifyAdminsExpenseCreated = sendExpenseAdminApprovalRequest;

/** Email expense receipt PDF to beneficiary when expense is recorded. */
export async function sendExpenseReceiptToBeneficiary(
  prisma: PrismaClient,
  params: { orgId: string; expenseId: string }
): Promise<{ sent: boolean; to?: string; skipped?: boolean; reason?: string; error?: string }> {
  const dedupe = await prisma.notification.findFirst({
    where: {
      orgId: params.orgId,
      type: "expense.receipt.beneficiary",
      body: { startsWith: `expenseId:${params.expenseId}` },
      status: "sent"
    },
    select: { id: true }
  });
  if (dedupe) return { sent: false, skipped: true, reason: "already_sent" };

  const expense = await prisma.expense.findFirst({
    where: { id: params.expenseId, orgId: params.orgId, deletedAt: null },
    include: {
      beneficiary: { select: { id: true, name: true, email: true } }
    }
  });
  if (!expense) return { sent: false, error: "Expense not found" };

  const to = expense.beneficiary?.email?.trim() ?? "";
  if (!to) return { sent: false, skipped: true, reason: "no_beneficiary_email" };

  const amountStr = Number(expense.amount).toFixed(2);
  const currency = expense.currency ?? "KES";
  const spentAt = expense.spentAt.toISOString().split("T")[0] ?? expense.spentAt.toLocaleDateString();
  const createdAt = expense.createdAt.toISOString().split("T")[0] ?? expense.createdAt.toLocaleDateString();
  const receiptNumber = `EXP-${String(expense.id).slice(0, 8).toUpperCase()}`;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateExpenseReceiptPdf({
      receiptNumber,
      company: { ...CRES_DYNAMICS_PDF_COMPANY },
      currency,
      amount: Number(expense.amount),
      category: expense.category,
      description: expense.description,
      notes: expense.notes,
      source: expense.source,
      transactionCode: expense.transactionCode,
      account: expense.account,
      paymentMethod: expense.paymentMethod,
      spentAt,
      status: expense.status,
      createdAt
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[finance-workflow] expense receipt PDF:", msg);
    return { sent: false, error: msg };
  }

  const recipientName = expense.beneficiary?.name?.trim() || null;
  const { subject, html, text } = renderExpenseBeneficiaryReceiptEmail({
    recipientName,
    amount: amountStr,
    currency,
    category: expense.category,
    description: expense.description,
    spentAt,
    source: expense.source,
    transactionCode: expense.transactionCode,
    account: expense.account,
    paymentMethod: expense.paymentMethod,
    receiptNumber,
    status: expense.status
  });

  const result = await sendOutboundEmail({
    to,
    subject,
    text,
    html,
    emailChannel: "finance",
    attachments: [
      {
        filename: `${receiptNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  });

  await prisma.notification.create({
    data: {
      orgId: params.orgId,
      channel: "email",
      to,
      subject,
      body: `expenseId:${params.expenseId}\nExpense receipt for ${amountStr} ${currency}.`,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error.slice(0, 900),
      sentAt: new Date(),
      type: "expense.receipt.beneficiary",
      tier: "financial"
    }
  });

  if (result.ok) {
    await logEmailSent(prisma, {
      orgId: params.orgId,
      to,
      subject,
      body: `Expense receipt ${params.expenseId} emailed to beneficiary with PDF.`,
      type: "expense.receipt.beneficiary"
    });
    return { sent: true, to };
  }

  console.error("[finance-workflow] expense beneficiary receipt failed:", result.error);
  return { sent: false, error: result.error };
}

/** Email payment receipt to client automatically when a payment is confirmed. */
export async function deliverPaymentReceiptToClient(
  prisma: PrismaClient,
  params: { orgId: string; paymentId: string }
): Promise<SendResult & { skipped?: boolean; reason?: string; to?: string }> {
  const dedupe = await prisma.notification.findFirst({
    where: {
      orgId: params.orgId,
      type: { in: ["payment.receipt.client", "payment.confirmed.client"] },
      body: { startsWith: `paymentId:${params.paymentId}` },
      status: "sent"
    },
    select: { id: true }
  });
  if (dedupe) return { ok: true, skipped: true, reason: "already_sent" };

  const payment = await prisma.payment.findFirst({
    where: { id: params.paymentId, orgId: params.orgId, deletedAt: null, status: "confirmed" },
    include: {
      invoice: {
        include: {
          client: { select: { id: true, name: true, email: true } },
          project: {
            select: {
              id: true,
              name: true,
              email: true,
              client: { select: { id: true, name: true, email: true } }
            }
          }
        }
      }
    }
  });
  if (!payment) return { ok: false, error: "Payment not found or not confirmed" };

  const clientEmail =
    payment.invoice?.client?.email?.trim() ||
    payment.invoice?.project?.client?.email?.trim() ||
    payment.invoice?.project?.email?.trim() ||
    "";
  if (!clientEmail) return { ok: true, skipped: true, reason: "no_client_email" };

  const amount = Number(payment.amount).toFixed(2);
  const currency = payment.currency ?? "KES";
  const projectId = payment.invoice?.projectId ?? payment.invoice?.project?.id ?? null;
  const receivedLabel = payment.receivedAt.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi"
  });

  let progress: ProjectProgressSnapshot | null = null;
  if (projectId) {
    progress = await loadProjectProgressSnapshot(prisma, params.orgId, projectId);
  }

  const clientName =
    payment.invoice?.client?.name?.trim() ||
    payment.invoice?.project?.client?.name?.trim() ||
    payment.source?.trim() ||
    null;

  const { subject, html, text } = renderPaymentConfirmationEmail({
    clientName,
    amount,
    currency,
    invoiceNumber: payment.invoice?.number ?? null,
    paymentReference: payment.reference ?? payment.mpesaRef ?? null,
    receivedAt: receivedLabel,
    paidBy: payment.source,
    account: payment.account,
    projectName: progress?.projectName ?? payment.invoice?.project?.name ?? null,
    progressPercent: progress?.progressPercent,
    taskSummary: progress ? `${progress.doneTasks}/${progress.taskCount} tasks done` : null,
    milestonesHtml: progress ? milestonesTableHtml(progress.milestones) : undefined,
    nextStepsHtml: progress ? nextStepsListHtml(progress.nextSteps) : undefined
  });

  const result = await sendOutboundEmail({
    to: clientEmail,
    subject,
    text,
    html,
    emailChannel: "finance"
  });

  await prisma.notification.create({
    data: {
      orgId: params.orgId,
      channel: "email",
      to: clientEmail,
      subject,
      body: `paymentId:${params.paymentId}\nPayment receipt for ${amount} ${currency}.`,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error.slice(0, 900),
      sentAt: new Date(),
      type: "payment.receipt.client",
      tier: "financial"
    }
  });

  if (result.ok) {
    await logEmailSent(prisma, {
      orgId: params.orgId,
      to: clientEmail,
      subject,
      body: `Payment receipt ${params.paymentId} emailed to client with project progress.`,
      type: "payment.receipt.client"
    });
  } else {
    console.error("[finance-workflow] payment receipt email failed:", result.error);
  }

  return result.ok ? { ...result, to: clientEmail } : result;
}

/** @deprecated alias */
export const deliverPaymentConfirmationEmail = deliverPaymentReceiptToClient;

/** Send client receipt after payment confirmation — awaited for reliable delivery. */
export async function sendPaymentReceiptToClient(
  prisma: PrismaClient,
  orgId: string,
  paymentId: string
): Promise<{ sent: boolean; to?: string; skipped?: boolean; reason?: string; error?: string }> {
  try {
    const result = await deliverPaymentReceiptToClient(prisma, { orgId, paymentId });
    if (result.skipped) {
      return { sent: false, skipped: true, reason: result.reason, to: result.to };
    }
    if (result.ok) {
      return { sent: true, to: result.to };
    }
    return { sent: false, error: result.error };
  } catch (err) {
    console.error("[finance-workflow] sendPaymentReceiptToClient:", err);
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fire-and-forget wrapper (prefer sendPaymentReceiptToClient when recording payments). */
export function runPaymentConfirmedNotifications(
  prisma: PrismaClient,
  orgId: string,
  paymentId: string
): void {
  void sendPaymentReceiptToClient(prisma, orgId, paymentId);
}
