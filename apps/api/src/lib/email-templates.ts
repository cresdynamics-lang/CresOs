import type { EmailChannel } from "./email-senders";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Brand = {
  accent: string;
  accentDark: string;
  label: string;
  badge: string;
};

const BRAND: Record<"finance" | "sales", Brand> = {
  finance: {
    accent: "#0f766e",
    accentDark: "#115e59",
    label: "Finance",
    badge: "Invoice"
  },
  sales: {
    accent: "#1d4ed8",
    accentDark: "#1e3a8a",
    label: "Sales",
    badge: "Invoice"
  }
};

function layout(
  channel: "finance" | "sales",
  opts: {
    preheader: string;
    headline: string;
    greeting: string;
    introHtml: string;
    highlight?: { label: string; value: string };
    detailHtml?: string;
    ctaLabel?: string;
    footerHtml?: string;
  }
): { html: string; text: string } {
  const b = BRAND[channel];
  const preheader = escapeHtml(opts.preheader);
  const highlightBlock = opts.highlight
    ? `<tr>
        <td style="padding:20px 28px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <tr>
              <td style="padding:16px 18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${escapeHtml(opts.highlight.label)}</div>
                <div style="font-size:22px;color:#0f172a;font-weight:700;margin-top:6px;">${escapeHtml(opts.highlight.value)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  : "";

  const detailBlock = opts.detailHtml
    ? `<tr><td style="padding:8px 28px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#334155;line-height:1.6;">${opts.detailHtml}</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${b.accent} 0%,${b.accentDark} 100%);padding:28px 28px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
              <div style="font-size:11px;color:rgba(255,255,255,0.85);letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">Cres Dynamics · ${escapeHtml(b.label)}</div>
              <div style="font-size:26px;color:#ffffff;font-weight:700;margin-top:10px;line-height:1.25;">${escapeHtml(opts.headline)}</div>
              <div style="display:inline-block;margin-top:14px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);color:#ffffff;font-size:12px;font-weight:600;">${escapeHtml(b.badge)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#0f172a;line-height:1.5;">
              ${escapeHtml(opts.greeting)}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#334155;line-height:1.65;">
              ${opts.introHtml}
            </td>
          </tr>
          ${highlightBlock}
          ${detailBlock}
          <tr>
            <td style="padding:22px 28px 8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#475569;line-height:1.6;">
              Your invoice is attached as a <strong>PDF</strong>. Please review payment details inside the document.
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.55;">
              ${opts.footerHtml ?? `Questions? Reply to this email or contact <a href="mailto:info@cresdynamics.com" style="color:${b.accent};">info@cresdynamics.com</a>.`}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.5;">
              Cres Dynamics Ltd · Nairobi, Kenya · This message was sent by our ${escapeHtml(b.label.toLowerCase())} team. Please do not share bank details outside official channels.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    opts.greeting,
    "",
    opts.preheader.replace(/<[^>]+>/g, ""),
    opts.highlight ? `${opts.highlight.label}: ${opts.highlight.value}` : "",
    "",
    "Your invoice PDF is attached to this email.",
    "",
    "Cres Dynamics"
  ].filter(Boolean);

  return { html, text: textLines.join("\n") };
}

export type InvoiceEmailTemplateInput = {
  channel: "finance" | "sales";
  clientName?: string | null;
  invoiceNumber: string;
  currency: string;
  totalAmount: number;
  detailLine?: string;
  dueDate?: string | null;
};

export function renderInvoiceClientEmail(input: InvoiceEmailTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.clientName?.trim() ? `Hello ${input.clientName.trim()},` : "Hello,";
  const amount = `${input.currency} ${input.totalAmount.toFixed(2)}`;
  const isFinance = input.channel === "finance";

  const subject = isFinance
    ? `Invoice ${input.invoiceNumber} — Cres Dynamics Finance`
    : `Your invoice ${input.invoiceNumber} — Cres Dynamics`;

  const introFinance =
    `We have issued invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> for your account. ` +
    `Thank you for partnering with <strong>Cres Dynamics</strong>.`;
  const introSales =
    `Thank you for working with us. Please find invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> ` +
    `for the services discussed with our sales team.`;

  const detailParts: string[] = [];
  if (input.detailLine?.trim()) {
    detailParts.push(`<p style="margin:0 0 8px;"><strong>Note:</strong> ${escapeHtml(input.detailLine.trim())}</p>`);
  }
  if (input.dueDate?.trim()) {
    detailParts.push(`<p style="margin:0;"><strong>Due date:</strong> ${escapeHtml(input.dueDate.trim())}</p>`);
  }

  const { html, text } = layout(input.channel, {
    preheader: `${isFinance ? "Finance invoice" : "Sales invoice"} ${input.invoiceNumber} — ${amount}`,
    headline: isFinance ? `Invoice ${input.invoiceNumber}` : `Invoice ready: ${input.invoiceNumber}`,
    greeting,
    introHtml: isFinance ? introFinance : introSales,
    highlight: { label: "Amount due", value: amount },
    detailHtml: detailParts.length ? detailParts.join("") : undefined,
    footerHtml: isFinance
      ? `For billing questions, reply to this email or write to <a href="mailto:info@cresdynamics.com" style="color:#0f766e;">info@cresdynamics.com</a>.`
      : `Your sales contact can help with any questions — reply to this email or reach us at <a href="mailto:info@cresdynamics.com" style="color:#1d4ed8;">info@cresdynamics.com</a>.`
  });

  return { subject, html, text };
}

/** CRM / general sales outreach (plain branded wrapper). */
export function renderSalesBulkEmail(opts: {
  orgName: string;
  subject: string;
  bodyText: string;
  recipientName: string;
}): { html: string; text: string } {
  const bodyHtml = escapeHtml(opts.bodyText).replace(/\n/g, "<br/>");
  const { html, text } = layout("sales", {
    preheader: opts.subject,
    headline: opts.subject,
    greeting: opts.recipientName ? `Hi ${opts.recipientName},` : "Hi there,",
    introHtml: bodyHtml,
    highlight: undefined,
    footerHtml: `— ${escapeHtml(opts.orgName)} · <a href="mailto:info@cresdynamics.com" style="color:#1d4ed8;">info@cresdynamics.com</a>`
  });
  return { html, text: `${opts.recipientName ? `Hi ${opts.recipientName},` : "Hi there,"}\n\n${opts.bodyText}\n\n— ${opts.orgName}` };
}

export function channelFromNotificationType(type: string): EmailChannel {
  if (type.startsWith("invoice.") && type.includes("sales")) return "sales";
  if (type === "invoice.sent" || type === "invoice.management_fee") return "finance";
  if (type === "crm.bulk_message") return "sales";
  return "default";
}
