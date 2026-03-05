/**
 * Email sending via Resend.
 *
 * Env:
 *   RESEND_API_KEY   - Required for sending; if unset, send is no-op.
 *   RESEND_FROM_EMAIL - Sender address, e.g. "CresOS <notifications@yourdomain.com>"
 */

import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "CresOS <onboarding@resend.dev>";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!API_KEY?.trim()) return null;
  if (!client) client = new Resend(API_KEY);
  return client;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Send a welcome email when the user updates their profile/notification email.
 * Safe to call even when Resend is not configured (no-op).
 */
export async function sendWelcomeEmail(to: string, name?: string | null): Promise<SendResult> {
  const resend = getClient();
  if (!resend) return { ok: false, error: "Resend not configured" };

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

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
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
