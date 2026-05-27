export type ComposeChannel = "finance" | "director" | "sales";

const CONTACT_EMAIL = (process.env.COMPOSE_REPLY_EMAIL ?? "info@cresdynamics.com").trim();
const CONTACT_PHONE_DISPLAY = (process.env.COMPOSE_CONTACT_PHONE ?? "0708805496").trim();
const CONTACT_PHONE_WA = (process.env.COMPOSE_CONTACT_PHONE_E164 ?? "254708805496").replace(/\D/g, "");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND: Record<ComposeChannel, { accent: string; accentDark: string; label: string }> = {
  finance: { accent: "#0f766e", accentDark: "#115e59", label: "Finance" },
  director: { accent: "#6d28d9", accentDark: "#4c1d95", label: "Director" },
  sales: { accent: "#1d4ed8", accentDark: "#1e3a8a", label: "Sales" }
};

function noReplyFooterHtml(accent: string): string {
  const email = escapeHtml(CONTACT_EMAIL);
  const phone = escapeHtml(CONTACT_PHONE_DISPLAY);
  const wa = CONTACT_PHONE_WA ? `https://wa.me/${CONTACT_PHONE_WA}` : "#";
  return `
    <div style="margin-top:8px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-family:system-ui,sans-serif;font-size:13px;color:#475569;line-height:1.55;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">Please do not reply to this email</p>
      <p style="margin:0;">This message was sent from a <strong>no-reply</strong> address. Replies to this email are not monitored.</p>
      <p style="margin:12px 0 0;">To reach us, use any of the following:</p>
      <ul style="margin:8px 0 0;padding-left:20px;">
        <li style="margin:4px 0;"><strong>WhatsApp:</strong> <a href="${wa}" style="color:${accent};">${phone}</a></li>
        <li style="margin:4px 0;"><strong>Phone / calls:</strong> ${phone}</li>
        <li style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color:${accent};">${email}</a></li>
      </ul>
    </div>`;
}

function noReplyFooterText(): string {
  return [
    "",
    "—",
    "Please do not reply to this email (no-reply address; replies are not monitored).",
    `To reach Cres Dynamics: WhatsApp or call ${CONTACT_PHONE_DISPLAY}, or email ${CONTACT_EMAIL}.`
  ].join("\n");
}

export function renderComposeEmail(opts: {
  channel: ComposeChannel;
  subject: string;
  bodyText: string;
}): { html: string; text: string } {
  const b = BRAND[opts.channel];
  const bodyHtml = escapeHtml(opts.bodyText).replace(/\n/g, "<br/>");
  const footer = noReplyFooterHtml(b.accent);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${b.accent} 0%,${b.accentDark} 100%);padding:24px 28px;font-family:system-ui,sans-serif;">
            <div style="font-size:11px;color:rgba(255,255,255,0.85);letter-spacing:0.1em;text-transform:uppercase;">Cres Dynamics · ${escapeHtml(b.label)}</div>
            <div style="font-size:22px;color:#fff;font-weight:700;margin-top:8px;">${escapeHtml(opts.subject)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 16px;font-family:system-ui,sans-serif;font-size:15px;color:#334155;line-height:1.65;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px;font-family:system-ui,sans-serif;">
            ${footer}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;font-family:system-ui,sans-serif;font-size:12px;color:#94a3b8;">
            Cres Dynamics Ltd · Nairobi, Kenya
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `${opts.subject}\n\n${opts.bodyText}${noReplyFooterText()}\n\n— Cres Dynamics (${b.label})`;
  return { html, text };
}

export function composeNotificationType(channel: ComposeChannel): string {
  if (channel === "finance") return "outbound.compose.finance";
  if (channel === "sales") return "outbound.compose.sales";
  return "outbound.compose.director";
}

export function composeNotificationTier(channel: ComposeChannel): string {
  if (channel === "finance") return "financial";
  if (channel === "director") return "governance";
  return "execution";
}
