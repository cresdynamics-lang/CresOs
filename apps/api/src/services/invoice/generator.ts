import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import * as fs from 'fs';
import * as path from 'path';
import { InvoiceData, InvoiceTemplate, GeneratedInvoice } from './types';
import { InvoiceDataMapper } from './data-mapper';

export class InvoiceGenerator {
  private templatesPath: string;
  private outputPath: string;

  constructor(templatesPath: string = '/Users/airm1/Projects/CresOs/apps/api/templates', outputPath: string = '/Users/airm1/Projects/CresOs/apps/api/generated') {
    this.templatesPath = templatesPath;
    this.outputPath = outputPath;
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    if (!fs.existsSync(this.templatesPath)) {
      fs.mkdirSync(this.templatesPath, { recursive: true });
    }
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  async generateInvoice(
    template: InvoiceTemplate,
    data: InvoiceData,
    outputFileName?: string
  ): Promise<GeneratedInvoice> {
    try {
      // Load the template
      const templatePath = path.join(this.templatesPath, template.filePath);
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      const templateContent = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(templateContent);
      
      // Create the docxtemplater instance
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Prepare data for template
      const templateData = this.prepareTemplateData(data);

      // Render the document
      doc.render(templateData);

      // Generate the output
      const buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      // Save the generated file
      const fileName = outputFileName || `${data.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
      const outputPath = path.join(this.outputPath, fileName);
      fs.writeFileSync(outputPath, buf);

      const generatedInvoice: GeneratedInvoice = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        templateId: template.id,
        data,
        generatedFilePath: outputPath,
        generatedAt: new Date(),
        status: 'generated',
      };

      return generatedInvoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private prepareTemplateData(data: InvoiceData): any {
    return {
      // Invoice Details
      invoiceNumber: data.invoiceNumber,
      issueDate: this.formatDate(data.issueDate),
      dueDate: data.dueDate ? this.formatDate(data.dueDate) : '',
      currency: data.currency,
      
      // Client Information
      clientName: data.clientName,
      clientEmail: data.clientEmail || '',
      clientPhone: data.clientPhone || '',
      clientAddress: data.clientAddress || '',
      
      // Company Information
      companyName: data.companyName,
      companyAddress: data.companyAddress || '',
      companyPhone: data.companyPhone || '',
      companyEmail: data.companyEmail || '',
      
      // Project Information
      projectTitle: data.projectTitle || '',
      projectDescription: data.projectDescription || '',
      
      // Financial Details
      subtotal: this.formatCurrency(data.subtotal, data.currency),
      taxRate: data.taxRate ? `${data.taxRate}%` : '',
      taxAmount: data.taxAmount ? this.formatCurrency(data.taxAmount, data.currency) : '',
      totalAmount: this.formatCurrency(data.totalAmount, data.currency),
      
      // Additional Information
      notes: data.notes || '',
      paymentTerms: data.paymentTerms || '',
      
      // Items Table
      items: data.items.map((item, index) => ({
        index: index + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: this.formatCurrency(item.unitPrice, data.currency),
        total: this.formatCurrency(item.total, data.currency),
      })),
      
      // Computed fields
      itemCount: data.items.length,
      subtotalNumeric: data.subtotal,
      totalAmountNumeric: data.totalAmount,
      currentDate: this.formatDate(new Date()),
    };
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.getCurrencyCode(currency),
    }).format(amount);
  }

  private getCurrencyCode(currency: string): string {
    const currencyMap: { [key: string]: string } = {
      'KES': 'KES',
      'USD': 'USD',
      'EUR': 'EUR',
      'GBP': 'GBP',
    };
    return currencyMap[currency.toUpperCase()] || 'USD';
  }

  async createTemplateFromDocx(templateName: string, docxFilePath: string): Promise<InvoiceTemplate> {
    try {
      const templateId = templateName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const templateFileName = `${templateId}.docx`;
      const templatePath = path.join(this.templatesPath, templateFileName);

      // Copy the uploaded file to templates directory
      if (!fs.existsSync(docxFilePath)) {
        throw new Error(`Source DOCX file not found: ${docxFilePath}`);
      }

      fs.copyFileSync(docxFilePath, templatePath);

      // Analyze the template to extract placeholders
      const placeholders = await this.extractPlaceholders(templatePath);

      const template: InvoiceTemplate = {
        id: templateId,
        name: templateName,
        description: `Invoice template: ${templateName}`,
        filePath: templateFileName,
        placeholders,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return template;
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractPlaceholders(templatePath: string): Promise<any[]> {
    try {
      const templateContent = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(templateContent);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // For now, return default placeholders
      // In a real implementation, you would parse the DOCX to find actual placeholders
      return [];
    } catch (error) {
      console.error('Error extracting placeholders:', error);
      return [];
    }
  }

  async listTemplates(): Promise<InvoiceTemplate[]> {
    try {
      const templates: InvoiceTemplate[] = [];
      const files = fs.readdirSync(this.templatesPath);

      for (const file of files) {
        if (file.endsWith('.docx')) {
          const templateId = file.replace('.docx', '');
          const template: InvoiceTemplate = {
            id: templateId,
            name: templateId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `Invoice template: ${templateId}`,
            filePath: file,
            placeholders: [], // Would be loaded from metadata in a real implementation
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          templates.push(template);
        }
      }

      return templates;
    } catch (error) {
      console.error('Error listing templates:', error);
      return [];
    }
  }

  async getTemplate(templateId: string): Promise<InvoiceTemplate | null> {
    try {
      const templateFileName = `${templateId}.docx`;
      const templatePath = path.join(this.templatesPath, templateFileName);

      if (!fs.existsSync(templatePath)) {
        return null;
      }

      const template: InvoiceTemplate = {
        id: templateId,
        name: templateId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Invoice template: ${templateId}`,
        filePath: templateFileName,
        placeholders: [], // Would be loaded from metadata in a real implementation
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return template;
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const templateFileName = `${templateId}.docx`;
      const templatePath = path.join(this.templatesPath, templateFileName);

      if (fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }
}
