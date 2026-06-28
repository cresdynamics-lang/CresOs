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
    /** null hides the mid attachment note; undefined keeps invoice default */
    attachmentNote?: string | null;
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

  const attachmentDefault =
    "Your invoice is attached as a <strong>PDF</strong>. Please review payment details inside the document.";
  const attachmentText =
    opts.attachmentNote === null
      ? ""
      : opts.attachmentNote === undefined
        ? attachmentDefault
        : opts.attachmentNote;
  const attachmentBlock = attachmentText
    ? `<tr>
            <td style="padding:22px 28px 8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#475569;line-height:1.6;">
              ${attachmentText}
            </td>
          </tr>`
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
          ${attachmentBlock}
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
    opts.attachmentNote === null
      ? ""
      : opts.attachmentNote ?? "Your invoice PDF is attached to this email.",
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
  if (type.startsWith("expense.") || type.startsWith("payment.")) return "finance";
  if (type === "crm.bulk_message") return "sales";
  return "default";
}

export type ExpenseAdminEmailInput = {
  category: string;
  amount: string;
  currency: string;
  description?: string | null;
  spentAt: string;
  recordedBy?: string | null;
  source?: string | null;
  transactionCode?: string | null;
  account?: string | null;
  paymentMethod?: string | null;
  approvalUrl?: string;
};

export function renderExpenseAdminEmail(input: ExpenseAdminEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const amount = `${input.currency} ${input.amount}`;
  const subject = `[CresOS Finance] Expense pending approval — ${amount}`;
  const detailParts = [
    `<p style="margin:0 0 8px;"><strong>Category:</strong> ${escapeHtml(input.category)}</p>`,
    `<p style="margin:0 0 8px;"><strong>Date:</strong> ${escapeHtml(input.spentAt)}</p>`
  ];
  if (input.description?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Description:</strong> ${escapeHtml(input.description.trim())}</p>`
    );
  }
  if (input.recordedBy?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Recorded by:</strong> ${escapeHtml(input.recordedBy.trim())}</p>`
    );
  }
  if (input.source?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Vendor:</strong> ${escapeHtml(input.source.trim())}</p>`
    );
  }
  if (input.transactionCode?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Receipt / ref:</strong> ${escapeHtml(input.transactionCode.trim())}</p>`
    );
  }
  if (input.account?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Account:</strong> ${escapeHtml(input.account.trim())}</p>`
    );
  }
  if (input.paymentMethod?.trim()) {
    detailParts.push(
      `<p style="margin:0;"><strong>Paid via:</strong> ${escapeHtml(input.paymentMethod.trim())}</p>`
    );
  }

  const { html, text } = layout("finance", {
    preheader: `New expense ${amount} awaiting your approval`,
    headline: "Expense pending approval",
    greeting: "Hello Admin,",
    introHtml:
      "A new expense was recorded in Finance and is <strong>awaiting your approval</strong>. Please review it in CresOS.",
    highlight: { label: "Amount", value: amount },
    detailHtml: detailParts.join(""),
    attachmentNote: null,
    footerHtml: input.approvalUrl
      ? `Review in CresOS: <a href="${escapeHtml(input.approvalUrl)}" style="color:#0f766e;">Open approvals</a> · <a href="mailto:info@cresdynamics.com" style="color:#0f766e;">info@cresdynamics.com</a>`
      : `Review pending expenses under Finance → Expenses in CresOS. Questions? <a href="mailto:info@cresdynamics.com" style="color:#0f766e;">info@cresdynamics.com</a>.`
  });

  return { subject, html, text };
}

export type PaymentConfirmationEmailInput = {
  clientName?: string | null;
  amount: string;
  currency: string;
  invoiceNumber?: string | null;
  paymentReference?: string | null;
  receivedAt?: string | null;
  paidBy?: string | null;
  account?: string | null;
  projectName?: string | null;
  progressPercent?: number;
  taskSummary?: string | null;
  milestonesHtml?: string;
  nextStepsHtml?: string;
};

export function renderPaymentConfirmationEmail(input: PaymentConfirmationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.clientName?.trim() ? `Hello ${input.clientName.trim()},` : "Hello,";
  const amount = `${input.currency} ${input.amount}`;
  const subject = input.invoiceNumber
    ? `Payment receipt — Invoice ${input.invoiceNumber} — ${amount}`
    : `Payment receipt — ${amount}`;

  const intro =
    `This is your official <strong>payment receipt</strong>. We have recorded your payment of ` +
    `<strong>${escapeHtml(amount)}</strong>` +
    (input.invoiceNumber
      ? ` against invoice <strong>${escapeHtml(input.invoiceNumber)}</strong>.`
      : ".");

  const detailParts: string[] = [];
  if (input.receivedAt?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Date & time:</strong> ${escapeHtml(input.receivedAt.trim())}</p>`
    );
  }
  if (input.paymentReference?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Transaction reference:</strong> ${escapeHtml(input.paymentReference.trim())}</p>`
    );
  }
  if (input.paidBy?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Received from:</strong> ${escapeHtml(input.paidBy.trim())}</p>`
    );
  }
  if (input.account?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Settled on account:</strong> ${escapeHtml(input.account.trim())}</p>`
    );
  }
  if (input.projectName?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Project:</strong> ${escapeHtml(input.projectName.trim())}</p>`
    );
  }
  if (input.progressPercent != null) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Overall progress:</strong> ${input.progressPercent}%` +
        (input.taskSummary ? ` (${escapeHtml(input.taskSummary)})` : "") +
        `</p>`
    );
  }
  if (input.milestonesHtml) {
    detailParts.push(
      `<p style="margin:12px 0 6px;font-weight:600;color:#0f172a;">Timeline & milestones</p>${input.milestonesHtml}`
    );
  }
  if (input.nextStepsHtml) {
    detailParts.push(
      `<p style="margin:12px 0 6px;font-weight:600;color:#0f172a;">Next remaining steps</p>${input.nextStepsHtml}`
    );
  }

  const { html, text } = layout("finance", {
    preheader: `Receipt for ${amount}` + (input.projectName ? ` — ${input.projectName}` : ""),
    headline: "Payment receipt",
    greeting,
    introHtml: intro,
    highlight: { label: "Amount paid", value: amount },
    detailHtml: detailParts.length ? detailParts.join("") : undefined,
    attachmentNote: null,
    footerHtml: `Please keep this email as your receipt. Track live project progress in your client portal. Questions? Reply to this email or contact <a href="mailto:info@cresdynamics.com" style="color:#0f766e;">info@cresdynamics.com</a>.`
  });

  const textLines = [
    greeting,
    "",
    "PAYMENT RECEIPT",
    `Amount paid: ${amount}`,
    input.receivedAt ? `Date: ${input.receivedAt}` : "",
    input.invoiceNumber ? `Invoice: ${input.invoiceNumber}` : "",
    input.paymentReference ? `Reference: ${input.paymentReference}` : "",
    input.paidBy ? `Received from: ${input.paidBy}` : "",
    input.account ? `Account: ${input.account}` : "",
    input.projectName ? `Project: ${input.projectName}` : "",
    input.progressPercent != null ? `Progress: ${input.progressPercent}%` : "",
    "",
    "Thank you for your payment.",
    "Cres Dynamics"
  ].filter(Boolean);

  return { subject, html, text: textLines.join("\n") };
}

export type ExpenseBeneficiaryReceiptEmailInput = {
  recipientName?: string | null;
  amount: string;
  currency: string;
  category: string;
  description?: string | null;
  spentAt: string;
  source?: string | null;
  transactionCode?: string | null;
  account?: string | null;
  paymentMethod?: string | null;
  receiptNumber: string;
  status: string;
};

export function renderExpenseBeneficiaryReceiptEmail(input: ExpenseBeneficiaryReceiptEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.recipientName?.trim() ? `Hello ${input.recipientName.trim()},` : "Hello,";
  const amount = `${input.currency} ${input.amount}`;
  const subject = `Expense receipt — ${amount}`;
  const categoryLabel = input.category.replace(/_/g, " ");

  const detailParts: string[] = [
    `<p style="margin:0 0 8px;"><strong>Receipt #:</strong> ${escapeHtml(input.receiptNumber)}</p>`,
    `<p style="margin:0 0 8px;"><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>`,
    `<p style="margin:0 0 8px;"><strong>Date:</strong> ${escapeHtml(input.spentAt)}</p>`
  ];
  if (input.description?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Description:</strong> ${escapeHtml(input.description.trim())}</p>`
    );
  }
  if (input.source?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Vendor:</strong> ${escapeHtml(input.source.trim())}</p>`
    );
  }
  if (input.transactionCode?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Transaction ref:</strong> ${escapeHtml(input.transactionCode.trim())}</p>`
    );
  }
  if (input.account?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Account:</strong> ${escapeHtml(input.account.trim())}</p>`
    );
  }
  if (input.paymentMethod?.trim()) {
    detailParts.push(
      `<p style="margin:0 0 8px;"><strong>Paid via:</strong> ${escapeHtml(input.paymentMethod.trim())}</p>`
    );
  }
  detailParts.push(
    `<p style="margin:0;"><strong>Status:</strong> ${escapeHtml(input.status.replace(/_/g, " "))} — pending admin approval</p>`
  );

  const { html, text } = layout("finance", {
    preheader: `Expense receipt ${amount}`,
    headline: "Expense receipt",
    greeting,
    introHtml:
      `This is your official <strong>expense receipt</strong> for <strong>${escapeHtml(amount)}</strong>. ` +
      `A PDF copy is attached. This expense is recorded and pending admin approval.`,
    highlight: { label: "Amount", value: amount },
    detailHtml: detailParts.join(""),
    attachmentNote: "Your expense receipt PDF is attached to this email.",
    footerHtml: `Keep this receipt for your records. Questions? Contact <a href="mailto:info@cresdynamics.com" style="color:#0f766e;">info@cresdynamics.com</a>.`
  });

  const textLines = [
    greeting,
    "",
    "EXPENSE RECEIPT",
    `Receipt #: ${input.receiptNumber}`,
    `Amount: ${amount}`,
    `Category: ${categoryLabel}`,
    `Date: ${input.spentAt}`,
    input.description ? `Description: ${input.description}` : "",
    input.source ? `Vendor: ${input.source}` : "",
    input.transactionCode ? `Reference: ${input.transactionCode}` : "",
    input.account ? `Account: ${input.account}` : "",
    input.paymentMethod ? `Paid via: ${input.paymentMethod}` : "",
    `Status: ${input.status} — pending admin approval`,
    "",
    "PDF receipt attached.",
    "Cres Dynamics"
  ].filter(Boolean);

  return { subject, html, text: textLines.join("\n") };
}

export type FinancialReportAdminEmailInput = {
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  senderLabel: string;
  note?: string | null;
  revenueInPeriod: string;
  expensesInPeriod: string;
  salariesInPeriod: string;
  developerPaymentsInPeriod: string;
  netInPeriod: string;
  currency: string;
};

export function renderFinancialReportAdminEmail(input: FinancialReportAdminEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Finance report — ${input.periodLabel}`;
  const noteBlock = input.note?.trim()
    ? `<p style="margin:0 0 12px;padding:12px;background:#f8fafc;border-radius:8px;color:#334155;"><strong>Note from ${escapeHtml(input.senderLabel)}:</strong> ${escapeHtml(input.note.trim())}</p>`
    : "";

  const rows = [
    ["Period", input.periodLabel],
    ["From", input.periodFrom],
    ["To", input.periodTo],
    ["Client payments (in)", `${input.currency} ${input.revenueInPeriod}`],
    ["Expenses (out)", `${input.currency} ${input.expensesInPeriod}`],
    ["Salaries / HR", `${input.currency} ${input.salariesInPeriod}`],
    ["Developer payments", `${input.currency} ${input.developerPaymentsInPeriod}`],
    ["Net cash (period)", `${input.currency} ${input.netInPeriod}`]
  ];

  const tableHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const { html, text } = layout("finance", {
    preheader: `Financial report for ${input.periodLabel}`,
    headline: "Financial report",
    greeting: "Hello,",
    introHtml:
      `<strong>${escapeHtml(input.senderLabel)}</strong> shared a CresOS finance report for ` +
      `<strong>${escapeHtml(input.periodLabel)}</strong>. A PDF summary is attached.`,
    detailHtml:
      noteBlock +
      `<table style="margin-top:8px;border-collapse:collapse;">${tableHtml}</table>`,
    attachmentNote: "Full financial report PDF attached.",
    footerHtml: `Open CresOS → Finance → Reports for live data. Questions? Contact finance.`
  });

  const textLines = [
    "Hello,",
    "",
    `Financial report — ${input.periodLabel}`,
    `Shared by: ${input.senderLabel}`,
    input.note?.trim() ? `Note: ${input.note.trim()}` : "",
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    "",
    "PDF report attached.",
    "Cres Dynamics / CresOS Finance"
  ].filter(Boolean);

  return { subject, html, text: textLines.join("\n") };
}
