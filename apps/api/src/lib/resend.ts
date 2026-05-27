/**
 * Outbound email: Resend when RESEND_API_KEY is set, otherwise SMTP.
 *
 * Resend:
 *   RESEND_API_KEY — API key from your Resend account (login email can be personal; not shown to recipients)
 *   RESEND_FROM_EMAIL — verified domain sender, e.g. `Cres Dynamics <info@cresdynamics.com>`
 *   RESEND_REPLY_TO — optional; where replies go (defaults to info@cresdynamics.com)
 *
 * SMTP fallback:
 *   MAIL_MAILER=smtp, MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD,
 *   MAIL_FROM_ADDRESS, MAIL_FROM_NAME
 */

import { Resend } from "resend";
import { getEmailSender } from "./email-senders";
import { smtpSendMail, type EmailAttachment, type SmtpSendInput } from "./smtp-mailer";

export type { EmailChannel } from "./email-senders";
export { getEmailSender } from "./email-senders";
export type { EmailAttachment } from "./smtp-mailer";

let client: Resend | null = null;
let clientKey: string | null = null;

function pickApiKey(): string | null {
  const candidates = [
    process.env.RESEND_API_KEY,
    process.env.RESEND_API_KEY_SECONDARY,
    process.env.RESEND_API_KEY_TERTIARY
  ];
  const found = candidates.find((k) => typeof k === "string" && k.trim().length > 0);
  return found ? found.trim() : null;
}

function getClient(): Resend | null {
  const key = pickApiKey();
  if (!key) return null;
  if (!client || clientKey !== key) {
    client = new Resend(key);
    clientKey = key;
  }
  return client;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

/** Resend when configured; falls back to SMTP (e.g. local dev without Resend). */
export async function sendOutboundEmail(input: SmtpSendInput): Promise<SendResult> {
  const resend = getClient();
  if (resend) {
    try {
      const sender = getEmailSender(input.emailChannel ?? "default");
      const from = input.from?.trim() || sender.from;
      const replyTo = input.replyTo?.trim() || sender.replyTo;
      const { data, error } = await resend.emails.send({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType
              }))
            }
          : {})
      });
      if (error) return { ok: false, error: String(error.message ?? error) };
      return { ok: true, id: data?.id ?? undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return smtpSendMail(input);
}

/**
 * Send a welcome email when the user updates their profile/notification email.
 */
export async function sendWelcomeEmail(to: string, name?: string | null): Promise<SendResult> {
  const displayName = name?.trim() || "there";
  const subject = "You're all set — we'll send updates to this email";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px;">
  <p>Hi ${escapeHtml(displayName)},</p>
  <p>Thanks for updating your profile. We'll send reminders and important updates to this email.</p>
  <p>If you didn't make this change, please contact support.</p>
  <p style="color: #666; font-size: 0.9em;">— CresOS</p>
</body>
</html>`.trim();
  const text = `Hi ${displayName},\n\nThanks for updating your profile. We'll send reminders and important updates to this email.\n\nIf you didn't make this change, please contact support.\n\n— CresOS`;
  return sendOutboundEmail({ to, subject, text, html });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
