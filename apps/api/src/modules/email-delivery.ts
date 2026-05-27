import type { PrismaClient } from "@prisma/client";
import { channelFromNotificationType, renderSalesBulkEmail } from "../lib/email-templates";
import { sendInvoiceEmailToClient } from "../lib/invoice-email";
import { sendOutboundEmail } from "../lib/resend";

function toText(subject: string, body: string): string {
  const s = (subject ?? "").trim();
  const b = (body ?? "").trim();
  return [s ? `${s}\n` : "", b].join("\n").trim();
}

function plainHtml(subject: string, body: string): string {
  const esc = (x: string) =>
    x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const s = esc((subject ?? "").trim());
  const b = esc((body ?? "").trim()).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111;max-width:720px">
${s ? `<h3 style="margin:0 0 12px 0">${s}</h3>` : ""}
<div style="white-space:normal">${b}</div>
</body></html>`;
}

/**
 * Deliver queued Notification emails (Resend when configured, else SMTP).
 */
export async function processQueuedEmails(prisma: PrismaClient, orgId: string, limit: number = 25): Promise<void> {
  const take = Math.min(80, Math.max(1, limit));
  const rows = await prisma.notification.findMany({
    where: { orgId, channel: "email", status: "queued" },
    orderBy: { createdAt: "asc" },
    take
  });
  if (rows.length === 0) return;

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { name: true } });
  const orgName = org?.name ?? "Cres Dynamics";

  for (const n of rows) {
    const to = (n.to ?? "").trim();
    if (!to) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "failed", error: "Missing recipient", sentAt: new Date() }
      });
      continue;
    }
    const subject = (n.subject ?? "[CresOS] Notification").trim() || "[CresOS] Notification";
    const body = (n.body ?? "").trim();
    const emailChannel = channelFromNotificationType(n.type);

    let result;
    const invoiceIdMatch = body.match(/^invoiceId:([a-z0-9]+)\n/i);

    if (invoiceIdMatch && (n.type === "invoice.sent" || n.type === "invoice.sent.sales")) {
      result = await sendInvoiceEmailToClient(prisma, {
        orgId,
        invoiceId: invoiceIdMatch[1],
        to,
        channel: n.type === "invoice.sent.sales" ? "sales" : "finance",
        detailLine: body.replace(/^invoiceId:[^\n]+\n?/i, "").trim() || undefined
      });
    } else if (n.type === "crm.bulk_message") {
      const { html, text } = renderSalesBulkEmail({
        orgName,
        subject,
        bodyText: body,
        recipientName: ""
      });
      result = await sendOutboundEmail({
        to,
        subject,
        text,
        html,
        emailChannel: "sales"
      });
    } else {
      result = await sendOutboundEmail({
        to,
        subject,
        text: toText(subject, body),
        html: plainHtml(subject, body),
        emailChannel
      });
    }

    if (result.ok) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "sent", error: null, sentAt: new Date() }
      });
    } else {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "failed", error: result.error.slice(0, 900), sentAt: new Date() }
      });
    }
  }
}
