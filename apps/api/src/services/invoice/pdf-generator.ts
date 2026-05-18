import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { InvoiceSchema } from './schema';

export interface PDFGenerationOptions {
  outputPath?: string;
  filename?: string;
  format?: 'A4' | 'Letter';
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  watermark?: string;
  stamp?: 'DRAFT' | 'PAID' | 'OVERDUE' | undefined;
}

export class PDFGenerator {
  private doc: PDFKit.PDFDocument;
  private options: PDFGenerationOptions;
  private yPosition: number;
  private pageHeight: number;
  /** Space reserved at bottom for footer (signature + tagline). Body must stay above this. */
  private readonly footerBandHeight = 128;
  private readonly sideMargin = 40;
  private readonly colGap = 12;
  /** Left column width — keeps header clear of right “invoice details” column. */
  private readonly leftColWidth = 248;
  private readonly rightColX = 308;
  private readonly rightColWidth = 247;

  constructor(options: PDFGenerationOptions = {}) {
    this.options = {
      outputPath: './generated',
      filename: 'invoice.pdf',
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
      watermark: '',
      stamp: options.stamp || undefined,
      ...options
    };

    this.doc = new PDFDocument({
      size: this.options.format || 'A4',
      margins: this.options.margin || { top: 40, right: 40, bottom: 40, left: 40 }
    });

    this.pageHeight = this.doc.page.height;
    this.yPosition = (this.options.margin?.top) || 40;
  }

  private bottomMargin(): number {
    return this.options.margin?.bottom ?? 40;
  }

  /** Last Y coordinate for content (above bottom margin). */
  private pageMaxY(): number {
    return this.pageHeight - this.bottomMargin();
  }

  /** Y coordinate where footer band starts; no body text below this. */
  private contentBottomLimit(): number {
    return this.pageMaxY() - this.footerBandHeight;
  }

  /** Prevent PDFKit from flowing content onto an extra page. */
  private fitsAboveFooter(neededHeight: number): boolean {
    return this.yPosition + neededHeight <= this.contentBottomLimit() - 4;
  }

  async generatePDF(invoice: InvoiceSchema): Promise<Buffer> {
    try {
      // Setup fonts and colors
      this.setupStyles();

      // Add content sections
      this.addHeaderAndInvoiceDetails(invoice);
      this.addAddresses(invoice);
      this.addProjectInfo(invoice);
      this.addItemsTable(invoice);
      this.addSummary(invoice);
      this.addPaymentTerms(invoice);
      this.addNotes(invoice);
      this.addFooter(invoice);

      // Add stamp if specified
      if (this.options.stamp) {
        this.addStamp(this.options.stamp || undefined);
      }

      // Add watermark if specified
      if (this.options.watermark) {
        this.addWatermark(this.options.watermark);
      }

      // Finalize the PDF
      this.doc.end();

      return new Promise((resolve) => {
        const buffers: Buffer[] = [];
        this.doc.on('data', (chunk) => buffers.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(buffers)));
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private setupStyles(): void {
    // Default fonts
    this.doc.font('Helvetica');
  }

  /** Top banner: issuer (left, wrapped) + title + invoice details (right). Avoids overlap with two columns. */
  private addHeaderAndInvoiceDetails(invoice: InvoiceSchema): void {
    const lx = this.sideMargin;
    const lw = this.leftColWidth;
    let leftY = 34;

    if (invoice.company?.logo_url) {
      try {
        this.doc.fontSize(10).font('Helvetica').fillColor('#666').text('[LOGO]', lx, leftY, { width: lw });
        leftY = this.doc.y + 4;
        this.doc.fontSize(8).text(String(invoice.company.logo_url), lx, leftY, { width: lw });
        leftY = this.doc.y + 4;
      } catch {
        this.doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text(invoice.company.name, lx, leftY, { width: lw });
        leftY = this.doc.y + 6;
      }
    } else {
      this.doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text(invoice.company?.name ?? '', lx, leftY, { width: lw });
      leftY = this.doc.y + 6;
    }

    this.doc.fontSize(9).font('Helvetica').fillColor('#334155');
    const leftBits: string[] = [];
    if (invoice.company?.email) leftBits.push(`Email: ${invoice.company.email}`);
    if (invoice.company?.phone) leftBits.push(`Phone: ${invoice.company.phone}`);
    if (invoice.company?.website) leftBits.push(`Website: ${invoice.company.website}`);
    for (const line of leftBits) {
      this.doc.text(line, lx, leftY, { width: lw, lineGap: 1 });
      leftY = this.doc.y + 2;
    }
    this.doc.fillColor('#000000');

    const title = `${(invoice.company?.name || '').toUpperCase()} — TAX INVOICE`.trim();
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text(title, this.rightColX, 32, { width: this.rightColWidth, align: 'right' });

    let rightY = 70;
    this.doc.fontSize(10).font('Helvetica-Bold').text('INVOICE DETAILS', this.rightColX, rightY, {
      width: this.rightColWidth,
      align: 'right'
    });
    rightY = this.doc.y + 6;

    const details: { label: string; value: string }[] = [
      { label: 'Invoice Number:', value: invoice.invoice_number },
      { label: 'Invoice Date:', value: invoice.invoice_date },
      { label: 'Payment Due Date:', value: invoice.due_date || '—' },
      { label: 'Status:', value: invoice.status.toUpperCase() }
    ];

    this.doc.fontSize(9).font('Helvetica');
    for (const d of details) {
      this.doc.text(d.label, this.rightColX, rightY, { width: this.rightColWidth, align: 'right' });
      this.doc.font('Helvetica-Bold').text(d.value, this.rightColX, rightY + 9, { width: this.rightColWidth, align: 'right' });
      this.doc.font('Helvetica');
      rightY += 24;
    }

    this.yPosition = Math.max(leftY, rightY) + this.colGap;
  }

  private addAddresses(invoice: InvoiceSchema): void {
    const rowTop = this.yPosition;
    let fromY = rowTop;
    const fromW = this.leftColWidth;

    this.doc.fontSize(11).font('Helvetica-Bold').text('FROM:', this.sideMargin, fromY);
    fromY += 13;
    this.doc.fontSize(9).font('Helvetica');
    this.doc.text(invoice.company.name, this.sideMargin, fromY, { width: fromW, lineGap: 1 });
    fromY = this.doc.y + 2;

    if (invoice.company.address?.street) {
      this.doc.text(invoice.company.address.street, this.sideMargin, fromY, { width: fromW });
      fromY = this.doc.y + 2;
    }
    if (invoice.company.address?.city && invoice.company.address?.country) {
      const cityState = `${invoice.company.address.city}, ${invoice.company.address.country}`;
      const postal = invoice.company.address.postal_code ? ` · ${invoice.company.address.postal_code}` : '';
      this.doc.text(cityState + postal, this.sideMargin, fromY, { width: fromW });
      fromY = this.doc.y + 2;
    }
    if (invoice.company.email) {
      this.doc.text(invoice.company.email, this.sideMargin, fromY, { width: fromW });
      fromY = this.doc.y + 2;
    }
    if (invoice.company.phone) {
      this.doc.text(invoice.company.phone, this.sideMargin, fromY, { width: fromW });
      fromY = this.doc.y + 2;
    }
    if (invoice.company.website) {
      this.doc.text(`Website: ${invoice.company.website}`, this.sideMargin, fromY, { width: fromW });
      fromY = this.doc.y + 2;
    }

    let billY = rowTop;
    const bx = this.rightColX;
    const bw = this.rightColWidth;

    this.doc.fontSize(11).font('Helvetica-Bold').text('BILL TO:', bx, billY);
    billY += 13;
    this.doc.fontSize(9).font('Helvetica');
    this.doc.text(invoice.client.name, bx, billY, { width: bw, lineGap: 1 });
    billY = this.doc.y + 2;

    if (invoice.client.address?.street) {
      this.doc.text(invoice.client.address.street, bx, billY, { width: bw });
      billY = this.doc.y + 2;
    }
    if (invoice.client.address?.city && invoice.client.address?.country) {
      const cityState = `${invoice.client.address.city}, ${invoice.client.address.country}`;
      const postal = invoice.client.address.postal_code ? ` ${invoice.client.address.postal_code}` : '';
      this.doc.text(cityState + postal, bx, billY, { width: bw });
      billY = this.doc.y + 2;
    }
    if (invoice.client.email) {
      this.doc.text(invoice.client.email, bx, billY, { width: bw });
      billY = this.doc.y + 2;
    }
    if (invoice.client.phone) {
      this.doc.text(invoice.client.phone, bx, billY, { width: bw });
      billY = this.doc.y + 2;
    }

    this.yPosition = Math.max(fromY, billY) + 14;
  }

  private addProjectInfo(invoice: InvoiceSchema): void {
    if (!invoice.project) return;
    const limit = this.contentBottomLimit() - 6;
    if (this.yPosition >= limit - 24) return;

    const startX = this.sideMargin;
    const textW = this.doc.page.width - 2 * this.sideMargin;

    this.doc.fontSize(10).font('Helvetica-Bold').text('Project reference:', startX, this.yPosition);
    this.yPosition = this.doc.y + 4;

    this.doc.fontSize(9).font('Helvetica');
    this.doc.text(`CD-${invoice.project.name}`, startX, this.yPosition, { width: textW });
    this.yPosition = this.doc.y + 2;

    if (invoice.project.description) {
      const h = this.doc.heightOfString(invoice.project.description, { width: textW, lineGap: 1 });
      if (this.yPosition + h <= limit) {
        this.doc.text(invoice.project.description, startX, this.yPosition, { width: textW, lineGap: 1 });
        this.yPosition = this.doc.y + 2;
      }
    }

    this.yPosition += 8;
  }

  private addItemsTable(invoice: InvoiceSchema): void {
    const limit = this.contentBottomLimit() - 6;
    if (this.yPosition >= limit - 24) return;

    const startX = this.sideMargin;
    const headers = ['#', 'Description', 'Qty', `Unit (${invoice.currency})`, `Amount (${invoice.currency})`];
    const columnWidths = [28, 242, 36, 88, 96];
    const tableW = columnWidths.reduce((a, b) => a + b, 0);
    const c0 = startX;
    const c1 = c0 + columnWidths[0];
    const c2 = c1 + columnWidths[1];
    const c3 = c2 + columnWidths[2];
    const c4 = c3 + columnWidths[3];
    const wDesc = columnWidths[1];

    this.doc.fontSize(10).font('Helvetica-Bold').text('INVOICE ITEMS', startX, this.yPosition);
    this.yPosition = this.doc.y + 8;

    let cx = startX;
    this.doc.fontSize(9);
    headers.forEach((header, index) => {
      this.doc.text(header, cx, this.yPosition, { width: columnWidths[index] });
      cx += columnWidths[index];
    });
    this.yPosition += 12;
    this.doc.moveTo(startX, this.yPosition).lineTo(startX + tableW, this.yPosition).strokeColor('#999').stroke();
    this.yPosition += 6;

    this.doc.font('Helvetica').fontSize(9);
    for (let index = 0; index < invoice.items.length; index++) {
      const item = invoice.items[index];
      const desc =
        [item.name, item.description].filter(Boolean).join(' — ') || item.description || '';
      const hDesc = this.doc.heightOfString(desc, { width: wDesc, lineGap: 1 });
      const rowH = Math.max(12, hDesc);
      if (this.yPosition + rowH + 18 > limit) {
        this.doc
          .fontSize(8)
          .fillColor('#64748B')
          .text('(Further line items omitted so this invoice fits on one page.)', startX, this.yPosition, {
            width: tableW
          });
        this.doc.fillColor('#000000');
        this.yPosition += 14;
        break;
      }
      const top = this.yPosition;
      this.doc.text(String(index + 1), c0, top, { width: columnWidths[0] });
      this.doc.text(desc, c1, top, { width: wDesc, lineGap: 1 });
      this.doc.text(String(item.quantity), c2, top, { width: columnWidths[2], align: 'right' });
      this.doc.text(this.formatCurrency(item.unit_price, invoice.currency), c3, top, {
        width: columnWidths[3],
        align: 'right'
      });
      this.doc.text(this.formatCurrency(item.total_price, invoice.currency), c4, top, {
        width: columnWidths[4],
        align: 'right'
      });
      this.yPosition = top + rowH + 4;
    }

    this.doc.moveTo(startX, this.yPosition).lineTo(startX + tableW, this.yPosition).stroke();
    this.yPosition += 14;
  }

  /** Column layout matches addItemsTable so totals align with the Amount column. */
  private itemsTableMetrics() {
    const startX = this.sideMargin;
    const columnWidths = [28, 242, 36, 88, 96];
    const tableW = columnWidths.reduce((a, b) => a + b, 0);
    return { startX, columnWidths, tableW };
  }

  private addSummary(invoice: InvoiceSchema): void {
    const { startX, tableW } = this.itemsTableMetrics();
    const boxWidth = 248;
    const boxX = startX + tableW - boxWidth;
    const rowH = 22;
    const balanceRowH = 28;
    const padY = 10;
    const rowCount =
      1 + (invoice.summary.tax_amount && invoice.summary.tax_amount > 0 ? 1 : 0) + 1 + 1;
    const boxHeight = padY * 2 + (rowCount - 1) * rowH + balanceRowH;
    if (!this.fitsAboveFooter(boxHeight + 12)) return;

    const boxTop = this.yPosition;
    const labelX = boxX + 12;
    const labelW = 108;
    const valueX = boxX + boxWidth - 12 - 108;
    const valueW = 108;

    this.doc
      .roundedRect(boxX, boxTop, boxWidth, boxHeight, 4)
      .fillAndStroke('#f1f5f9', '#cbd5e1');

    let y = boxTop + padY;

    const drawRow = (
      label: string,
      value: string,
      opts: { bold?: boolean; valueSize?: number; valueColor?: string; tall?: boolean } = {}
    ) => {
      const fontSize = opts.bold ? 11 : 10;
      this.doc.fontSize(fontSize).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
      this.doc.text(label, labelX, y + 4, { width: labelW, align: 'left', lineBreak: false });
      this.doc
        .fontSize(opts.valueSize ?? fontSize)
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(opts.valueColor ?? '#0f172a')
        .text(value, valueX, y + 4, { width: valueW, align: 'right', lineBreak: false });
      y += opts.tall ? balanceRowH : rowH;
    };

    drawRow('Subtotal', this.formatCurrency(invoice.summary.subtotal, invoice.currency));

    if (invoice.summary.tax_amount && invoice.summary.tax_amount > 0) {
      drawRow('Tax', this.formatCurrency(invoice.summary.tax_amount, invoice.currency));
    }

    drawRow('Total Amount', this.formatCurrency(invoice.summary.total_amount, invoice.currency), { bold: true });

    this.doc
      .moveTo(boxX + 10, y)
      .lineTo(boxX + boxWidth - 10, y)
      .lineWidth(0.5)
      .strokeColor('#94a3b8')
      .stroke();
    y += 6;

    drawRow('Balance Due', this.formatCurrency(invoice.summary.balance_due, invoice.currency), {
      bold: true,
      valueSize: 13,
      valueColor: '#15803d',
      tall: true
    });
    this.doc.fillColor('#000000');

    this.yPosition = boxTop + boxHeight + 12;
  }

  private addPaymentTerms(invoice: InvoiceSchema): void {
    const limit = this.contentBottomLimit() - 6;
    if (this.yPosition >= limit - 8) return;

    const startX = this.sideMargin;
    const textW = this.doc.page.width - 2 * this.sideMargin;

    this.doc.fontSize(10).font('Helvetica-Bold');
    this.doc.text('PAYMENT INSTRUCTIONS', startX, this.yPosition);
    this.yPosition = this.doc.y + 6;

    this.doc.fontSize(9).font('Helvetica');
    const lines = [
      `Pay within ${invoice.payment_terms.due_in_days} days of invoice date.`,
      '☐ M-Pesa: Paybill 542542 | Account: 43869',
      '☐ Bank Transfer: Bank: I & M Bank | Account Name: Cres Dynamics Ltd | Account No: 01207943936150 | Branch: Ongata Rongai',
      `Please use Invoice Number ${invoice.invoice_number} as your payment reference.`
    ];
    for (const line of lines) {
      const h = this.doc.heightOfString(line, { width: textW, lineGap: 1 });
      if (this.yPosition + h > limit) break;
      this.doc.text(line, startX, this.yPosition, { width: textW, lineGap: 1 });
      this.yPosition += h + 4;
    }
  }

  private addNotes(invoice: InvoiceSchema): void {
    let body = invoice.notes?.client_message?.trim();
    if (!body) return;

    const limit = this.contentBottomLimit() - 6;
    if (this.yPosition >= limit - 12) return;

    const startX = this.sideMargin;
    const textW = this.doc.page.width - 2 * this.sideMargin;

    this.doc.fontSize(10).font('Helvetica-Bold');
    this.doc.text('NOTES', startX, this.yPosition);
    this.yPosition = this.doc.y + 6;

    this.doc.fontSize(9).font('Helvetica');
    let maxH = limit - this.yPosition - 2;
    if (maxH < 12) return;
    while (body.length > 0 && this.doc.heightOfString(body, { width: textW, lineGap: 1 }) > maxH) {
      body = body.slice(0, -2).trim();
    }
    if (body.length === 0) return;
    if (this.doc.heightOfString(body, { width: textW, lineGap: 1 }) > maxH) {
      body = `${body.slice(0, 120)}…`;
    }
    this.doc.text(body, startX, this.yPosition, { width: textW, lineGap: 1 });
    this.yPosition = this.doc.y + 6;
  }

  private addFooter(invoice: InvoiceSchema): void {
    const pageW = this.doc.page.width;
    const mx = this.sideMargin;
    const footW = pageW - 2 * mx;
    const bottom = this.pageMaxY();
    const y0 = this.contentBottomLimit();

    // Fixed positions (bottom-up) so footer never triggers a second page.
    const lineH = 9;
    let y = bottom - lineH;
    this.doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
    this.doc.text('Page 1 of 1', mx, y, { width: footW, align: 'right', lineBreak: false });

    y -= lineH;
    this.doc.fontSize(8).font('Helvetica').fillColor('#64748B');
    this.doc.text('Thank you for your business. Cres Dynamics Ltd — cresdynamics.com', mx, y, {
      width: footW,
      align: 'center',
      lineBreak: false
    });

    y -= lineH + 1;
    this.doc.fillColor('#334155');
    this.doc.text(
      'P.O. BOX 1112 – 00100, Kivuli Towers-WESTLANDS, KENYA | info@cresdynamics.com | www.cresdynamics.com',
      mx,
      y,
      { width: footW, align: 'center', lineBreak: false }
    );

    y -= lineH + 2;
    this.doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    this.doc.text('CRES DYNAMICS LTD | Building digital systems that Businesses Run On.', mx, y, {
      width: footW,
      align: 'center',
      lineBreak: false
    });

    y -= 10;
    this.doc.font('Helvetica').fontSize(9);
    this.doc.text(`Date: ${invoice.invoice_date}`, mx, y, { lineBreak: false });
    y -= lineH;
    this.doc.text('Title: Chief Executive Officer, Cres Dynamics Ltd', mx, y, { lineBreak: false });
    y -= lineH;
    this.doc.text('Name: Nelson Were', mx, y, { lineBreak: false });
    y -= 14;
    this.doc.text('Signature:', mx, y, { lineBreak: false });
    this.drawSignatureDraft(mx + 52, y - 1);
    y -= lineH + 2;
    this.doc.font('Helvetica-Bold').text('AUTHORISED BY:', mx, y, { lineBreak: false });

    const ruleY = Math.min(y0 + 2, y - 6);
    this.doc
      .moveTo(mx, ruleY)
      .lineTo(pageW - mx, ruleY)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();

    // Keep cursor above footer band so nothing auto-flows to page 2.
    this.yPosition = Math.min(this.yPosition, y0 - 4);
    this.doc.y = this.yPosition;
  }

  /** Stylised draft signature (no image asset). */
  private drawSignatureDraft(x: number, y: number): void {
    this.doc.save();
    this.doc.font('Times-Italic').fontSize(12).fillColor('#1e3a5f');
    this.doc.text('Nelson Were', x, y, { width: 160, lineBreak: false });
    this.doc
      .lineWidth(0.7)
      .strokeColor('#0f172a')
      .opacity(0.85)
      .moveTo(x, y + 12)
      .bezierCurveTo(x + 24, y + 8, x + 48, y + 14, x + 72, y + 10)
      .bezierCurveTo(x + 92, y + 6, x + 108, y + 12, x + 120, y + 8)
      .stroke();
    this.doc.opacity(1).fillColor('#000000');
    this.doc.restore();
  }

  private addStamp(stamp: string): void {
    const centerX = this.doc.page.width / 2;
    const centerY = this.doc.page.height / 2;
    
    this.doc.save();
    this.doc.translate(centerX, centerY);
    this.doc.rotate(-Math.PI / 6);
    
    this.doc.fontSize(120)
      .font('Helvetica-Bold')
      .fillColor('red')
      .fillOpacity(0.3)
      .text(stamp, -150, 0, { align: 'center' });
    
    this.doc.restore();
  }

  private addWatermark(text: string): void {
    this.doc.save();
    this.doc.translate(this.doc.page.width / 2, this.doc.page.height / 2);
    
    this.doc.fontSize(48)
      .font('Helvetica')
      .fillColor('gray')
      .fillOpacity(0.1)
      .text(text, 0, 0, { align: 'center' });
    
    this.doc.restore();
  }

  private formatCurrency(amount: number, currency: string): string {
    const n = Number(amount);
    const safe = Number.isFinite(n) ? n : 0;
    const formatted = safe.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    if (currency === 'KES') {
      return `KES ${formatted}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe);
  }

  async saveToFile(buffer: Buffer): Promise<string> {
    const outputPath = path.join(this.options.outputPath || './generated', this.options.filename || 'invoice.pdf');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputPath || './generated')) {
      fs.mkdirSync(this.options.outputPath || './generated', { recursive: true });
    }
    
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }
}
