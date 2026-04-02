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

  async generatePDF(invoice: InvoiceSchema): Promise<Buffer> {
    try {
      // Setup fonts and colors
      this.setupStyles();

      // Add content sections
      this.addHeader(invoice);
      this.addInvoiceDetails(invoice);
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

  private addHeader(invoice: InvoiceSchema): void {
    // Add company logo if available
    if (invoice.company && invoice.company.logo_url) {
      try {
        // Note: In a real implementation, you would fetch and add the logo image
        // For now, we'll add a placeholder for the logo
        this.doc.fontSize(10).font('Helvetica').text('[LOGO]', 40, 30);
        this.doc.fontSize(8).font('Helvetica').fillColor('gray').text(`${invoice.company.logo_url}`, 40, 45);
      } catch (error) {
        console.log('Logo could not be loaded:', error);
        // Fallback to company name if logo fails
        this.doc.fontSize(12).font('Helvetica-Bold').text(invoice.company.name, 40, 30);
      }
    } else {
      // Company name as fallback when no logo
      this.doc.fontSize(12).font('Helvetica-Bold').text(invoice.company ? invoice.company.name : '', 40, 30);
    }

    // Company header information
    this.yPosition = 50;
    this.doc.fontSize(10).font('Helvetica');
    
    if (invoice.company.email) {
      this.doc.text(`Email: ${invoice.company.email}`, 40, this.yPosition);
      this.yPosition += 12;
    }
    
    if (invoice.company.phone) {
      this.doc.text(`Phone: ${invoice.company.phone}`, 40, this.yPosition);
      this.yPosition += 12;
    }
    
    if (invoice.company.website) {
      this.doc.text(`Website: ${invoice.company.website}`, 40, this.yPosition);
      this.yPosition += 12;
    }

    // Invoice label and number on the right
    this.doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 450, 30, { align: 'right' });
    
    this.yPosition = 100;
  }

  private addInvoiceDetails(invoice: InvoiceSchema): void {
    const details = [
      { label: 'Invoice Number:', value: invoice.invoice_number },
      { label: 'Invoice Date:', value: invoice.invoice_date },
      { label: 'Due Date:', value: invoice.due_date },
      { label: 'Status:', value: invoice.status.toUpperCase() }
    ];

    this.doc.fontSize(10).font('Helvetica');
    
    details.forEach((detail, index) => {
      const y = 80 + (index * 20);
      this.doc.text(detail.label, 450, y, { align: 'right' });
      this.doc.font('Helvetica-Bold').text(detail.value, 450, y + 10, { align: 'right' });
      this.doc.font('Helvetica');
    });

    this.yPosition = 150;
  }

  private addAddresses(invoice: InvoiceSchema): void {
    // From address
    this.doc.fontSize(12).font('Helvetica-Bold').text('FROM:', 40, this.yPosition);
    this.yPosition += 15;
    
    this.doc.fontSize(10).font('Helvetica');
    this.doc.text(invoice.company.name, 40, this.yPosition);
    
    if (invoice.company.address) {
      this.yPosition += 12;
      if (invoice.company.address.street) {
        this.doc.text(invoice.company.address.street, 40, this.yPosition);
        this.yPosition += 12;
      }
      if (invoice.company.address.city && invoice.company.address.country) {
        const cityState = `${invoice.company.address.city}, ${invoice.company.address.country}`;
        const postal = invoice.company.address.postal_code ? ` ${invoice.company.address.postal_code}` : '';
        this.doc.text(cityState + postal, 40, this.yPosition);
        this.yPosition += 12;
      }
    }
    
    if (invoice.company.email) {
      this.doc.text(invoice.company.email, 40, this.yPosition);
      this.yPosition += 12;
    }
    
    if (invoice.company.phone) {
      this.doc.text(invoice.company.phone, 40, this.yPosition);
      this.yPosition += 12;
    }

    if (invoice.company.website) {
      this.doc.text(invoice.company.website, 40, this.yPosition);
      this.yPosition += 12;
    }

    // To address
    const originalY = 150;
    let currentY = originalY;
    
    this.doc.fontSize(12).font('Helvetica-Bold').text('BILL TO:', 280, currentY);
    currentY += 15;
    
    this.doc.fontSize(10).font('Helvetica');
    this.doc.text(invoice.client.name, 280, currentY);
    currentY += 12;
    
    if (invoice.client.address) {
      if (invoice.client.address.street) {
        this.doc.text(invoice.client.address.street, 280, currentY);
        currentY += 12;
      }
      if (invoice.client.address.city && invoice.client.address.country) {
        const cityState = `${invoice.client.address.city}, ${invoice.client.address.country}`;
        const postal = invoice.client.address.postal_code ? ` ${invoice.client.address.postal_code}` : '';
        this.doc.text(cityState + postal, 280, currentY);
        currentY += 12;
      }
    }
    
    if (invoice.client.email) {
      this.doc.text(invoice.client.email, 280, currentY);
      currentY += 12;
    }
    
    if (invoice.client.phone) {
      this.doc.text(invoice.client.phone, 280, currentY);
      currentY += 12;
    }

    this.yPosition = Math.max(this.yPosition, currentY) + 20;
  }

  private addProjectInfo(invoice: InvoiceSchema): void {
    if (!invoice.project) return;

    this.doc.fontSize(12).font('Helvetica-Bold').text('Project:', 40, this.yPosition);
    this.yPosition += 15;
    
    this.doc.fontSize(10).font('Helvetica');
    this.doc.text(invoice.project.name, 40, this.yPosition);
    this.yPosition += 12;
    
    if (invoice.project.description) {
      this.doc.text(invoice.project.description, 40, this.yPosition);
      this.yPosition += 12;
    }

    this.yPosition += 10;
  }

  private addItemsTable(invoice: InvoiceSchema): void {
    if (this.yPosition > 500) {
      this.doc.addPage();
      this.yPosition = (this.options.margin?.top) || 40;
    }

    // Table headers
    const headers = ['Item', 'Description', 'Qty', 'Unit Price', 'Total'];
    const columnWidths = [200, 200, 50, 80, 80];
    const startX = 40;
    
    this.doc.fontSize(10).font('Helvetica-Bold');
    let currentX = startX;
    
    headers.forEach((header, index) => {
      this.doc.text(header, currentX, this.yPosition);
      currentX += columnWidths[index];
    });
    
    this.yPosition += 15;
    
    // Draw line under headers
    this.doc.moveTo(startX, this.yPosition)
      .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), this.yPosition)
      .stroke();
    
    this.yPosition += 10;
    
    // Table rows
    this.doc.font('Helvetica');
    invoice.items.forEach((item, index) => {
      if (this.yPosition > 700) {
        this.doc.addPage();
        this.yPosition = (this.options.margin?.top) || 40;
        
        // Repeat headers on new page
        this.doc.fontSize(10).font('Helvetica-Bold');
        currentX = startX;
        headers.forEach((header, headerIndex) => {
          this.doc.text(header, currentX, this.yPosition);
          currentX += columnWidths[headerIndex];
        });
        this.yPosition += 15;
        this.doc.moveTo(startX, this.yPosition)
          .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), this.yPosition)
          .stroke();
        this.yPosition += 10;
        this.doc.font('Helvetica');
      }
      
      currentX = startX;
      const row = [
        item.name,
        item.description || '',
        item.quantity.toString(),
        this.formatCurrency(item.unit_price, invoice.currency),
        this.formatCurrency(item.total_price, invoice.currency)
      ];
      
      row.forEach((cell, cellIndex) => {
        const align = cellIndex >= 3 ? 'right' : 'left';
        this.doc.text(cell, currentX, this.yPosition, { align, width: columnWidths[cellIndex] });
        currentX += columnWidths[cellIndex];
      });
      
      this.yPosition += 15;
    });
    
    // Draw line under table
    this.doc.moveTo(startX, this.yPosition)
      .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), this.yPosition)
      .stroke();
    
    this.yPosition += 20;
  }

  private addSummary(invoice: InvoiceSchema): void {
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
    if (this.yPosition > 650) {
      this.doc.addPage();
      this.yPosition = (this.options.margin?.top) || 40;
    }
    
    this.doc.fontSize(12).font('Helvetica-Bold');
    this.doc.text(`Payment is due within ${invoice.payment_terms.due_in_days} days. Late payments are subject to a 1.5% monthly fee.`, 40, this.yPosition, { width: 400 });
    
    this.yPosition += 30;
  }

  private addNotes(invoice: InvoiceSchema): void {
    if (!invoice.notes?.client_message) return;
    
    if (this.yPosition > 700) {
      this.doc.addPage();
      this.yPosition = (this.options.margin?.top) || 40;
    }
    
    this.doc.fontSize(10).font('Helvetica-Bold');
    this.doc.text('Notes', 40, this.yPosition);
    this.yPosition += 12;
    
    this.doc.font('Helvetica');
    this.doc.text(invoice.notes.client_message || '', 40, this.yPosition, { width: 400 });
    
    this.yPosition += 30;
  }

  private addFooter(invoice: InvoiceSchema): void {
    const footerY = this.pageHeight - 80;
    
    // Add a line above the footer
    this.doc.moveTo(40, footerY - 10)
      .lineTo(this.doc.page.width - 40, footerY - 10)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();
    
    // Company branding in footer
    this.doc.fontSize(12).font('Helvetica-Bold').text(invoice.company.name, 40, footerY, { align: 'center' });
    
    // Company contact information
    this.doc.fontSize(10).font('Helvetica');
    const contactInfo = [];
    
    if (invoice.company.email) {
      contactInfo.push(invoice.company.email);
    }
    if (invoice.company.phone) {
      contactInfo.push(invoice.company.phone);
    }
    if (invoice.company.website) {
      contactInfo.push(invoice.company.website);
    }
    
    if (contactInfo.length > 0) {
      this.doc.text(contactInfo.join(' | '), 40, footerY + 15, { align: 'center' });
    }
    
    // Tax ID and business registration if available
    if (invoice.company.tax_id) {
      this.doc.fontSize(9).font('Helvetica').fillColor('gray')
        .text(`Tax ID: ${invoice.company.tax_id}`, 40, footerY + 30, { align: 'center' });
    }
    
    // Thank you message
    this.doc.fontSize(10).font('Helvetica').fillColor('#000000')
      .text('Thank you for your business!', 40, footerY + 45, { align: 'center' });
    
    // Page number
    this.doc.fontSize(8).font('Helvetica').fillColor('gray')
      .text(`Page 1 of 1`, this.doc.page.width - 40, footerY + 45, { align: 'right' });
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
