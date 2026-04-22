/**
 * Email sending (SMTP preferred; Resend fallback).
 *
 * SMTP Env (recommended):
 *   MAIL_MAILER=smtp
 *   MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD
 *   MAIL_FROM_ADDRESS, MAIL_FROM_NAME
 *
 * Resend fallback Env:
 *   RESEND_API_KEY / RESEND_FROM_EMAIL
 */

import { Resend } from "resend";
import { smtpSendMail } from "./smtp-mailer";

const DEFAULT_FROM_EMAIL = "CresOS <onboarding@resend.dev>";

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

function pickFromEmail(): string {
  const candidates = [
    process.env.RESEND_FROM_EMAIL,
    process.env.RESEND_FROM_EMAIL_SECONDARY,
    process.env.RESEND_FROM_EMAIL_TERTIARY
  ];
  const found = candidates.find((s) => typeof s === "string" && s.trim().length > 0);
  return (found ? found.trim() : DEFAULT_FROM_EMAIL) || DEFAULT_FROM_EMAIL;
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

/**
 * Send a welcome email when the user updates their profile/notification email.
 * Safe to call even when Resend is not configured (no-op).
 */
export async function sendWelcomeEmail(to: string, name?: string | null): Promise<SendResult> {
  // Prefer SMTP when configured.
  const smtp = await smtpSendMail({
    to,
    subject: "You're all set — we'll send updates to this email",
    text: `Hi ${(name?.trim() || "there")},\n\nThanks for updating your profile. We'll send reminders and important updates to this email.\n\nIf you didn't make this change, please contact support.\n\n— CresOS`,
    html: null
  });
  if (smtp.ok) return { ok: true, id: smtp.id };

  const resend = getClient();
  if (!resend) return { ok: false, error: "Resend not configured" };

  const displayName = name?.trim() || "there";
  const subject = "You're all set — we'll send updates to this email";
  const fromEmail = pickFromEmail();
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

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text
    });
    if (error) return { ok: false, error: String(error.message ?? error) };
    return { ok: true, id: data?.id ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
