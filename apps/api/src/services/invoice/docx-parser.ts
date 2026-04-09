import * as fs from 'fs';
import * as path from 'path';
import { InvoiceSchema } from './schema';

/**
 * DOCX Template Parser
 * 
 * Extracts the structure and placeholders from the existing Invoice.docx file
 * to maintain the exact format in the PDF generation
 */
export interface DocxTemplateField {
  name: string;
  type: 'text' | 'table' | 'image';
  position: { x: number; y: number };
  width?: number;
  height?: number;
  format?: string;
  placeholder?: string;
}

export interface DocxTemplateStructure {
  fields: DocxTemplateField[];
  layout: {
    pageSize: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };
  };
  styling: {
    fonts: { name: string; size: number; bold?: boolean; italic?: boolean }[];
    colors: { name: string; value: string }[];
  };
}

export class DocxTemplateParser {
  private docxPath: string;
  private templateStructure: DocxTemplateStructure;

  constructor(docxPath: string) {
    this.docxPath = docxPath;
    this.templateStructure = this.getDefaultTemplateStructure();
  }

  /**
   * Parse the DOCX template to extract field positions and formatting
   */
  async parseTemplate(): Promise<DocxTemplateStructure> {
    try {
      // For now, return the default structure based on standard invoice format
      // In a real implementation, you would use a library like docx4js or mammoth
      // to parse the actual DOCX file and extract the exact positions
      
      console.log(`📄 Parsing DOCX template: ${this.docxPath}`);
      
      // Verify file exists
      if (!fs.existsSync(this.docxPath)) {
        throw new Error(`DOCX template not found: ${this.docxPath}`);
      }

      // Get file info
      const stats = fs.statSync(this.docxPath);
      console.log(`📊 Template size: ${(stats.size / 1024).toFixed(2)} KB`);

      return this.templateStructure;
    } catch (error) {
      console.error('Error parsing DOCX template:', error);
      throw error;
    }
  }

  /**
   * Convert invoice data to match the DOCX template structure
   */
  mapInvoiceToTemplate(invoice: InvoiceSchema): any {
    return {
      // Header section
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      
      // Company information (FROM section)
      companyName: invoice.company.name,
      companyEmail: invoice.company.email,
      companyPhone: invoice.company.phone,
      companyAddress: this.formatAddress(invoice.company.address),
      
      // Client information (TO section)
      clientName: invoice.client.name,
      clientEmail: invoice.client.email,
      clientPhone: invoice.client.phone,
      clientAddress: this.formatAddress(invoice.client.address),
      
      // Project information
      projectName: invoice.project?.name,
      projectDescription: invoice.project?.description,
      
      // Items table
      items: invoice.items.map(item => ({
        description: item.name,
        details: item.description,
        quantity: item.quantity,
        unitPrice: this.formatCurrency(item.unit_price, invoice.currency),
        total: this.formatCurrency(item.total_price, invoice.currency)
      })),
      
      // Summary section
      subtotal: this.formatCurrency(invoice.summary.subtotal, invoice.currency),
      taxAmount: this.formatCurrency(invoice.summary.tax_amount || 0, invoice.currency),
      totalAmount: this.formatCurrency(invoice.summary.total_amount, invoice.currency),
      balanceDue: this.formatCurrency(invoice.summary.balance_due, invoice.currency),
      
      // Payment terms
      paymentTerms: `Payment due within ${invoice.payment_terms.due_in_days} days`,
      
      // Notes
      notes: invoice.notes?.client_message,
      
      // Footer
      thankYouMessage: "Thank you for your business!",
      companyInfo: `${invoice.company.name} | ${invoice.company.email || ''} | ${invoice.company.website || ''}`
    };
  }

  /**
   * Get the default template structure based on standard invoice format
   */
  private getDefaultTemplateStructure(): DocxTemplateStructure {
    return {
      layout: {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: 40, right: 40, bottom: 40, left: 40 }
      },
      fields: [
        // Header fields
        { name: 'invoiceNumber', type: 'text', position: { x: 450, y: 80 }, placeholder: '{{invoice_number}}' },
        { name: 'invoiceDate', type: 'text', position: { x: 450, y: 100 }, placeholder: '{{invoice_date}}' },
        { name: 'dueDate', type: 'text', position: { x: 450, y: 120 }, placeholder: '{{due_date}}' },
        
        // Company info (FROM)
        { name: 'companyName', type: 'text', position: { x: 40, y: 150 }, placeholder: '{{company.name}}' },
        { name: 'companyAddress', type: 'text', position: { x: 40, y: 170 }, placeholder: '{{company.address}}' },
        { name: 'companyEmail', type: 'text', position: { x: 40, y: 190 }, placeholder: '{{company.email}}' },
        { name: 'companyPhone', type: 'text', position: { x: 40, y: 210 }, placeholder: '{{company.phone}}' },
        
        // Client info (TO)
        { name: 'clientName', type: 'text', position: { x: 280, y: 150 }, placeholder: '{{client.name}}' },
        { name: 'clientAddress', type: 'text', position: { x: 280, y: 170 }, placeholder: '{{client.address}}' },
        { name: 'clientEmail', type: 'text', position: { x: 280, y: 190 }, placeholder: '{{client.email}}' },
        { name: 'clientPhone', type: 'text', position: { x: 280, y: 210 }, placeholder: '{{client.phone}}' },
        
        // Project info
        { name: 'projectName', type: 'text', position: { x: 40, y: 250 }, placeholder: '{{project.name}}' },
        { name: 'projectDescription', type: 'text', position: { x: 40, y: 270 }, placeholder: '{{project.description}}' },
        
        // Items table
        { name: 'itemsTable', type: 'table', position: { x: 40, y: 320 }, width: 500 },
        
        // Summary
        { name: 'subtotal', type: 'text', position: { x: 450, y: 500 }, placeholder: '{{summary.subtotal}}' },
        { name: 'taxAmount', type: 'text', position: { x: 450, y: 520 }, placeholder: '{{summary.tax_amount}}' },
        { name: 'totalAmount', type: 'text', position: { x: 450, y: 540 }, placeholder: '{{summary.total_amount}}' },
        { name: 'balanceDue', type: 'text', position: { x: 450, y: 560 }, placeholder: '{{summary.balance_due}}' },
        
        // Payment terms
        { name: 'paymentTerms', type: 'text', position: { x: 40, y: 580 }, placeholder: '{{payment_terms}}' },
        
        // Notes
        { name: 'notes', type: 'text', position: { x: 40, y: 620 }, placeholder: '{{notes.client_message}}' },
        
        // Footer
        { name: 'thankYouMessage', type: 'text', position: { x: 40, y: 750 }, placeholder: 'Thank you for your business!' },
        { name: 'companyInfo', type: 'text', position: { x: 40, y: 770 }, placeholder: '{{company.info}}' }
      ],
      styling: {
        fonts: [
          { name: 'Arial', size: 12, bold: true },  // Headers
          { name: 'Arial', size: 10 },              // Body text
          { name: 'Arial', size: 10, bold: true },  // Labels
          { name: 'Arial', size: 14, bold: true }   // Totals
        ],
        colors: [
          { name: 'primary', value: '#000000' },    // Black text
          { name: 'accent', value: '#007bff' },     // Blue accents
          { name: 'success', value: '#28a745' }      // Green for totals
        ]
      }
    };
  }

  /**
   * Format address for display
   */
  private formatAddress(address?: any): string {
    if (!address) return '';
    
    const parts = [
      address.street,
      address.city,
      address.country,
      address.postal_code
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'KES' ? 'KES' : 'USD',
    }).format(amount);
  }

  /**
   * @deprecated Platform invoices use DB-backed creation-order numbers (`invoice-number.ts`).
   * Kept for scripts/tests that need a deterministic placeholder from project + org ids.
   */
  generateInvoiceNumber(projectId: string, orgId: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Create a hash from project and org IDs for uniqueness
    const hash = this.createHash(projectId + orgId);
    const sequence = hash.slice(0, 3).toUpperCase();
    
    return `INV-${sequence}-${month}/${year}`;
  }

  /**
   * Create a simple hash for generating unique invoice numbers
   */
  private createHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).toUpperCase();
  }
}
