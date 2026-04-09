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
  private readonly footerBandHeight = 118;
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

  /** Y coordinate where footer band starts; no body text below this. */
  private contentBottomLimit(): number {
    return this.pageHeight - this.bottomMargin() - this.footerBandHeight;
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
    if (invoice.company.tax_id) {
      this.doc.text(`KRA PIN: ${invoice.company.tax_id}`, this.sideMargin, fromY, { width: fromW });
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

  private addSummary(invoice: InvoiceSchema): void {
    const limit = this.contentBottomLimit() - 6;
    if (this.yPosition > limit - 50) return;

    const summaryX = 450;
    const summaryWidth = 150;
    
    // Subtotal
    this.doc.fontSize(10).font('Helvetica');
    this.doc.text('Subtotal:', summaryX, this.yPosition, { width: summaryWidth, align: 'right' });
    this.doc.text(
      this.formatCurrency(invoice.summary.subtotal, invoice.currency),
      summaryX,
      this.yPosition + 12,
      { width: summaryWidth, align: 'right' }
    );
    this.yPosition += 25;
    
    // Tax (if applicable)
    if (invoice.summary.tax_amount && invoice.summary.tax_amount > 0) {
      this.doc.text('Tax:', summaryX, this.yPosition, { width: summaryWidth, align: 'right' });
      this.doc.text(
        this.formatCurrency(invoice.summary.tax_amount, invoice.currency),
        summaryX,
        this.yPosition + 12,
        { width: summaryWidth, align: 'right' }
      );
      this.yPosition += 25;
    }
    
    // Total
    this.doc.font('Helvetica-Bold');
    this.doc.text('Total Amount:', summaryX, this.yPosition, { width: summaryWidth, align: 'right' });
    this.doc.text(
      this.formatCurrency(invoice.summary.total_amount, invoice.currency),
      summaryX,
      this.yPosition + 12,
      { width: summaryWidth, align: 'right' }
    );
    this.yPosition += 25;
    
    // Balance Due
    this.doc.fontSize(14).fillColor('#28a745');
    this.doc.text('Balance Due:', summaryX, this.yPosition, { width: summaryWidth, align: 'right' });
    this.doc.text(
      this.formatCurrency(invoice.summary.balance_due, invoice.currency),
      summaryX,
      this.yPosition + 15,
      { width: summaryWidth, align: 'right' }
    );
    this.doc.fillColor('#000000');
    
    this.yPosition += 35;
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
    const y0 = this.contentBottomLimit();
    const pageW = this.doc.page.width;
    const mx = this.sideMargin;

    this.doc
      .moveTo(mx, y0 - 3)
      .lineTo(pageW - mx, y0 - 3)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();

    let fy = y0 + 2;
    this.doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    this.doc.text('AUTHORISED BY:', mx, fy);
    fy += 11;
    this.doc.font('Helvetica').fontSize(9).text('Signature:', mx, fy);
    this.drawSignatureDraft(mx + 52, fy - 2);
    fy += 18;
    this.doc.text('Name: Nelson Were', mx, fy);
    fy += 11;
    this.doc.text('Title: Chief Executive Officer, Cres Dynamics Ltd', mx, fy);
    fy += 11;
    this.doc.text(`Date: ${invoice.invoice_date}`, mx, fy);
    fy += 14;

    const footW = pageW - 2 * mx;
    this.doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    this.doc.text('CRES DYNAMICS LTD | Building digital systems that Businesses Run On.', mx, fy, {
      align: 'center',
      width: footW
    });
    fy = this.doc.y + 4;

    this.doc.fontSize(8).font('Helvetica').fillColor('#334155');
    this.doc.text(
      'P.O. BOX 1112 – 00100, Kivuli Towers-WESTLANDS, KENYA | info@cresdynamics.com | www.cresdynamics.com',
      mx,
      fy,
      { align: 'center', width: footW }
    );
    fy = this.doc.y + 2;

    if (invoice.company.tax_id) {
      this.doc.fontSize(8).font('Helvetica').fillColor('#64748B').text(`KRA PIN: ${invoice.company.tax_id}`, mx, fy, {
        align: 'center',
        width: footW
      });
      fy = this.doc.y + 2;
    }
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#64748B')
      .text('Thank you for your business. Cres Dynamics Ltd — cresdynamics.com', mx, fy, {
        align: 'center',
        width: footW
      });
    fy = this.doc.y + 2;

    this.doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Page 1 of 1', mx, fy, {
      align: 'right',
      width: footW
    });
  }

  /** Stylised draft signature (no image asset). */
  private drawSignatureDraft(x: number, y: number): void {
    this.doc.save();
    this.doc.font("Times-Italic").fontSize(16).fillColor("#1e3a5f");
    this.doc.text("Nelson Were", x, y, { width: 200 });
    this.doc
      .lineWidth(0.8)
      .strokeColor("#0f172a")
      .opacity(0.85)
      .moveTo(x, y + 18)
      .bezierCurveTo(x + 28, y + 12, x + 55, y + 22, x + 88, y + 14)
      .bezierCurveTo(x + 110, y + 8, x + 125, y + 18, x + 140, y + 12)
      .stroke();
    this.doc.opacity(1).fillColor("#000000");
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'KES' ? 'KES' : 'USD',
    }).format(amount);
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
