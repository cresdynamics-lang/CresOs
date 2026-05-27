import type { PrismaClient } from "@prisma/client";
import { renderInvoiceClientEmail } from "./email-templates";
import { generateInvoicePdfBuffer } from "./invoice-pdf";
import { sendOutboundEmail, type SendResult } from "./resend";

export type SendInvoiceEmailParams = {
  orgId: string;
  invoiceId: string;
  to: string;
  clientName?: string | null;
  /** Optional extra line in the email body (e.g. management fee label). */
  detailLine?: string;
  /** finance = finance-noreply + finance template; sales = sales-noreply + sales template */
  channel: "finance" | "sales";
};

export async function sendInvoiceEmailToClient(
  prisma: PrismaClient,
  params: SendInvoiceEmailParams
): Promise<SendResult & { invoiceNumber?: string }> {
  const to = params.to.trim();
  if (!to) return { ok: false, error: "Missing recipient email" };

  let pdf: Awaited<ReturnType<typeof generateInvoicePdfBuffer>>;
  try {
    pdf = await generateInvoicePdfBuffer(prisma, params.orgId, params.invoiceId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const invoiceRow = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, orgId: params.orgId },
    select: { dueDate: true }
  });
  const dueDate = invoiceRow?.dueDate
    ? invoiceRow.dueDate.toISOString().split("T")[0]
    : null;

  const { subject, html, text } = renderInvoiceClientEmail({
    channel: params.channel,
    clientName: params.clientName,
    invoiceNumber: pdf.number,
    currency: pdf.currency,
    totalAmount: pdf.totalAmount,
    detailLine: params.detailLine,
    dueDate
  });

  const result = await sendOutboundEmail({
    to,
    subject,
    text,
    html,
    emailChannel: params.channel,
    attachments: [
      {
        filename: pdf.filename,
        content: pdf.buffer,
        contentType: "application/pdf"
      }
    ]
  });

  return result.ok ? { ...result, invoiceNumber: pdf.number } : result;
}

/** Finance invoice: PDF + branded template from finance-noreply@cresdynamics.com */
export async function deliverFinanceInvoiceEmail(
  prisma: PrismaClient,
  params: Omit<SendInvoiceEmailParams, "channel">
): Promise<SendResult & { invoiceNumber?: string }> {
  const result = await sendInvoiceEmailToClient(prisma, { ...params, channel: "finance" });
  const subject = result.invoiceNumber
    ? `Invoice ${result.invoiceNumber} — Cres Dynamics Finance`
    : "Invoice — Cres Dynamics Finance";
  const body =
    params.detailLine?.trim() ??
    `Finance invoice email ${result.ok ? "sent" : "failed"} to ${params.to.trim()}.`;

  await prisma.notification.create({
    data: {
      orgId: params.orgId,
      channel: "email",
      to: params.to.trim(),
      subject,
      body,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error.slice(0, 900),
      sentAt: new Date(),
      type: "invoice.sent",
      tier: "financial"
    }
  });

  return result;
}

/** Sales invoice: PDF + branded template from sales-noreply@cresdynamics.com */
export async function deliverSalesInvoiceEmail(
  prisma: PrismaClient,
  params: Omit<SendInvoiceEmailParams, "channel">
): Promise<SendResult & { invoiceNumber?: string }> {
  const result = await sendInvoiceEmailToClient(prisma, { ...params, channel: "sales" });
  const subject = result.invoiceNumber
    ? `Your invoice ${result.invoiceNumber} — Cres Dynamics`
    : "Your invoice — Cres Dynamics";
  const body =
    params.detailLine?.trim() ??
    `Sales invoice email ${result.ok ? "sent" : "failed"} to ${params.to.trim()}.`;

  await prisma.notification.create({
    data: {
      orgId: params.orgId,
      channel: "email",
      to: params.to.trim(),
      subject,
      body,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error.slice(0, 900),
      sentAt: new Date(),
      type: "invoice.sent.sales",
      tier: "financial"
    }
  });

  return result;
}
