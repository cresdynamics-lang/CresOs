import type { PrismaClient } from "@prisma/client";
import { smtpSendMail } from "../lib/smtp-mailer";

function toText(subject: string, body: string): string {
  const s = (subject ?? "").trim();
  const b = (body ?? "").trim();
  return [s ? `${s}\n` : "", b].join("\n").trim();
}

function toHtml(subject: string, body: string): string {
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
 * Deliver queued Notification emails via SMTP.
 * This is intentionally idempotent-ish: we only pick `status="queued"` rows.
 */
export async function processQueuedEmails(prisma: PrismaClient, orgId: string, limit: number = 25): Promise<void> {
  const take = Math.min(80, Math.max(1, limit));
  const rows = await prisma.notification.findMany({
    where: { orgId, channel: "email", status: "queued" },
    orderBy: { createdAt: "asc" },
    take
  });
  if (rows.length === 0) return;

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
    const result = await smtpSendMail({
      to,
      subject,
      text: toText(subject, body),
      html: toHtml(subject, body)
    });
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

