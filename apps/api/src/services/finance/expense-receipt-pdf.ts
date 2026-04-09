import PDFDocument from "pdfkit";
import type { PdfCompanyBlock } from "../../lib/company-pdf";
import { CRES_DYNAMICS_PDF_COMPANY } from "../../lib/company-pdf";

export type ExpenseReceiptInput = {
  receiptNumber: string;
  currency: string;
  amount: number;
  category: string;
  description?: string | null;
  notes?: string | null;
  source?: string | null;
  transactionCode?: string | null;
  account?: string | null;
  paymentMethod?: string | null;
  spentAt: string;
  status: string;
  createdAt: string;
  company?: PdfCompanyBlock;
};

function safe(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim();
}

function money(amount: number, currency: string): string {
  const cur = currency === "KES" ? "KES" : currency || "KES";
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: cur }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
}

const SIDE = 40;
const FOOTER_BAND = 92;
const LEFT_COL_W = 248;
const RIGHT_DETAIL_X = 308;
const RIGHT_DETAIL_W = 247;

/**
 * Expense receipt PDF — one page; body stays above a reserved footer band (no overlap).
 */
export async function generateExpenseReceiptPdf(input: ExpenseReceiptInput): Promise<Buffer> {
  const company = { ...CRES_DYNAMICS_PDF_COMPANY, ...input.company };
  const pageMargin = { top: 40, right: 40, bottom: 40, left: 40 };
  const doc = new PDFDocument({ size: "A4", margins: pageMargin });
  const buffers: Buffer[] = [];
  doc.on("data", (c) => buffers.push(c));

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentBottom = () => pageH - pageMargin.bottom - FOOTER_BAND;
  const textW = pageW - 2 * SIDE;

  const fitNotesBlock = (title: string, body: string, yStart: number): number => {
    let y = yStart;
    const limit = contentBottom() - 4;
    if (y >= limit - 20) return y;

    doc.font("Helvetica-Bold").fontSize(11).text(title, SIDE, y);
    y = doc.y + 6;
    doc.font("Helvetica").fontSize(10).fillColor("#0F172A");

    let text = body;
    while (text.length > 0) {
      const h = doc.heightOfString(text, { width: textW, lineGap: 2 });
      if (y + h <= limit) {
        doc.text(text, SIDE, y, { width: textW, lineGap: 2 });
        doc.fillColor("#000000");
        return doc.y + 4;
      }
      if (text.length <= 1) break;
      text = text.slice(0, -1);
    }
    if (text.length > 0) {
      const ellipsis = "…";
      let t = text + ellipsis;
      while (t.length > ellipsis.length && doc.heightOfString(t, { width: textW, lineGap: 2 }) > limit - y) {
        t = t.slice(0, -ellipsis.length - 1) + ellipsis;
      }
      doc.text(t, SIDE, y, { width: textW, lineGap: 2 });
      y = doc.y + 4;
    }
    doc.fillColor("#000000");
    return y;
  };

  // ---- Header: company left (wrapped), title + details right ----
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#000000").text(company.name, SIDE, 30, { width: LEFT_COL_W });

  let hy = doc.y + 4;
  doc.font("Helvetica").fontSize(10).fillColor("#334155");
  if (company.address?.street) {
    doc.text(company.address.street, SIDE, hy, { width: LEFT_COL_W });
    hy = doc.y + 2;
  }
  if (company.address?.city && company.address?.country) {
    const line = `${company.address.city}, ${company.address.country}${company.address.postal_code ? ` · ${company.address.postal_code}` : ""}`;
    doc.text(line, SIDE, hy, { width: LEFT_COL_W });
    hy = doc.y + 2;
  }
  if (company.email) {
    doc.text(`Email: ${company.email}`, SIDE, hy, { width: LEFT_COL_W });
    hy = doc.y + 2;
  }
  if (company.phone) {
    doc.text(`Tel: ${company.phone}`, SIDE, hy, { width: LEFT_COL_W });
    hy = doc.y + 2;
  }
  if (company.website) {
    doc.text(`Website: ${company.website}`, SIDE, hy, { width: LEFT_COL_W });
    hy = doc.y + 2;
  }
  if (company.tax_id) {
    doc.text(`KRA PIN: ${company.tax_id}`, SIDE, hy, { width: LEFT_COL_W });
    hy = doc.y + 2;
  }
  doc.fillColor("#000000");

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(`${company.name.toUpperCase()} — EXPENSE RECEIPT`, RIGHT_DETAIL_X, 30, {
      width: RIGHT_DETAIL_W,
      align: "right"
    });

  const detailLabels = [
    { label: "Receipt #:", value: safe(input.receiptNumber) },
    { label: "Expense date:", value: safe(input.spentAt) },
    { label: "Recorded:", value: safe(input.createdAt) },
    { label: "Status:", value: safe(input.status).toUpperCase() || "—" }
  ];
  let dy = 78;
  doc.font("Helvetica").fontSize(10);
  for (const d of detailLabels) {
    doc.text(d.label, RIGHT_DETAIL_X, dy, { width: RIGHT_DETAIL_W, align: "right" });
    doc.font("Helvetica-Bold").text(d.value, RIGHT_DETAIL_X, dy + 11, { width: RIGHT_DETAIL_W, align: "right" });
    doc.font("Helvetica");
    dy += 28;
  }

  let y = Math.max(hy + 8, dy + 8);
  const limitEarly = contentBottom() - 4;
  if (y >= limitEarly) y = limitEarly - 8;

  doc.moveTo(SIDE, y).lineTo(pageW - SIDE, y).strokeColor("#CBD5E1").lineWidth(0.5).stroke();
  y += 18;

  doc.font("Helvetica-Bold").fontSize(12).text("FROM:", SIDE, y);
  y = doc.y + 6;
  doc.font("Helvetica").fontSize(10).text(company.name, SIDE, y, { width: LEFT_COL_W });
  y = doc.y + 10;

  doc.font("Helvetica").fontSize(10).fillColor("#334155").text("Amount (" + (input.currency || "KES") + ")", SIDE, y);
  y = doc.y + 4;
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#B45309").text(money(input.amount, input.currency), SIDE, y);
  doc.fillColor("#000000");
  y = doc.y + 12;

  doc.font("Helvetica-Bold").fontSize(11).text("EXPENSE DETAILS", SIDE, y);
  y = doc.y + 8;

  const rows = [
    ["Category", safe(input.category).replace(/_/g, " ")],
    ["Vendor / source", safe(input.source)],
    ["Receipt / transaction code", safe(input.transactionCode)],
    ["Account", safe(input.account)],
    ["Paid via", safe(input.paymentMethod)]
  ].filter((r): r is [string, string] => r[1].length > 0);

  const labelW = 160;
  const valueX = SIDE + labelW + 8;
  const valueW = pageW - valueX - SIDE;

  doc.fontSize(10);
  for (const [k, v] of rows) {
    if (y >= contentBottom() - 20) break;
    const hLabel = doc.heightOfString(k, { width: labelW, lineGap: 1 });
    const hVal = doc.heightOfString(v, { width: valueW, lineGap: 1 });
    const rowH = Math.max(hLabel, hVal, 14);
    if (y + rowH > contentBottom() - 4) break;

    doc.font("Helvetica").fillColor("#334155").text(k, SIDE, y, { width: labelW, lineGap: 1 });
    doc.font("Helvetica").fillColor("#0F172A").text(v, valueX, y, { width: valueW, lineGap: 1 });
    y += rowH + 4;
  }
  doc.fillColor("#000000");

  if (input.description || input.notes) {
    y += 6;
    if (y < contentBottom() - 24) {
      doc.moveTo(SIDE, y).lineTo(pageW - SIDE, y).strokeColor("#CBD5E1").stroke();
      y += 14;
      if (input.description) {
        y = fitNotesBlock("Description", safe(input.description), y);
      }
      if (input.notes && y < contentBottom() - 16) {
        y = fitNotesBlock("Notes", safe(input.notes), y + 4);
      }
    }
  }

  const footerTop = contentBottom();
  doc.moveTo(SIDE, footerTop - 6).lineTo(pageW - SIDE, footerTop - 6).strokeColor("#cccccc").lineWidth(0.5).stroke();

  let fy = footerTop + 2;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#334155");
  doc.text("CRES DYNAMICS LTD | Building digital systems that Businesses Run On.", SIDE, fy, {
    align: "center",
    width: textW
  });
  fy = doc.y + 4;
  doc.font("Helvetica").fontSize(8);
  doc.text(
    "P.O. BOX 1112 – 00100, Kivuli Towers-WESTLANDS, KENYA | info@cresdynamics.com | www.cresdynamics.com",
    SIDE,
    fy,
    { align: "center", width: textW }
  );
  fy = doc.y + 4;
  doc.fillColor("#64748B").fontSize(8);
  doc.text("Internal expense receipt — retain for records and approvals.", SIDE, fy, {
    align: "center",
    width: textW
  });
  doc.fillColor("#000000");
  doc.font("Helvetica").fontSize(10);

  doc.end();
  return await new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(buffers))));
}
