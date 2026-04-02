import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PDFGenerator } from './pdf-generator';
import { DocxTemplateParser } from './docx-parser';
import { InvoiceSchema } from './schema';

/**
 * Finance Invoice Integration Service
 * 
 * Integrates PDF invoice generation with the existing finance system
 * and maintains the exact format from the Invoice.docx template
 */
export interface FinanceInvoiceData {
  clientId: string;
  projectId?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
  }>;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
}

export class FinanceInvoiceService {
  private prisma: PrismaClient;
  private docxParser: DocxTemplateParser;
  private pdfGenerator: PDFGenerator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.docxParser = new DocxTemplateParser(
      '/Users/airm1/Projects/CresOs/apps/api/src/services/invoice/Invoice.docx'
    );
    this.pdfGenerator = new PDFGenerator();
  }

  /**
   * Create invoice from finance module with PDF generation
   */
  async createFinanceInvoice(
    orgId: string,
    invoiceData: FinanceInvoiceData,
    createdBy: string
  ): Promise<{ invoice: any; pdfBuffer: Buffer }> {
    try {
      console.log('🚀 Creating finance invoice with PDF generation...');

      // 1. Get organization and client data
      const [organization, client] = await Promise.all([
        this.getOrganizationData(orgId),
        this.getClientData(invoiceData.clientId, orgId)
      ]);

      if (!client) {
        throw new Error('Client not found');
      }

      // 2. Get project data if provided
      let project = null;
      if (invoiceData.projectId) {
        project = await this.getProjectData(invoiceData.projectId, orgId);
      }

      // 3. Generate invoice number using the DOCX template format
      const invoiceNumber = this.docxParser.generateInvoiceNumber(
        invoiceData.projectId || invoiceData.clientId,
        orgId
      );

      // 4. Create invoice in database (using existing finance logic)
      const invoice = await this.createInvoiceInDatabase(
        orgId,
        invoiceData,
        invoiceNumber,
        createdBy
      );

      // 5. Map to invoice schema for PDF generation
      const invoiceSchema = await this.mapToInvoiceSchema(
        invoice,
        client,
        organization,
        project,
        invoiceData
      );

      // 6. Generate PDF using the DOCX template format
      const pdfBuffer = await this.generateInvoicePDF(invoiceSchema);

      // 7. Log the activity (commented out for now)
      // await logAdminActivity(
      //   this.prisma,
      //   orgId,
      //   'invoice.created_with_pdf',
      //   'invoice',
      //   invoice.id,
      //   createdBy,
      //   {
      //     invoiceNumber: invoice.number,
      //     clientId: invoice.clientId,
      //     projectId: invoice.projectId,
      //     pdfGenerated: true
      //   }
      // );

      console.log(`✅ Finance invoice created: ${invoice.number}`);
      console.log(`📄 PDF generated: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

      return { invoice, pdfBuffer };
    } catch (error) {
      console.error('Error creating finance invoice:', error);
      throw error;
    }
  }

  /**
   * Generate invoice for project when created by sales person
   */
  async generateProjectInvoice(
    projectId: string,
    orgId: string,
    createdBy: string
  ): Promise<{ invoice: any; pdfBuffer: Buffer }> {
    try {
      console.log('🚀 Generating invoice for new project...');

      // 1. Get project details
      const project = await this.getProjectData(projectId, orgId);
      if (!project) {
        throw new Error('Project not found');
      }

      // 2. Get client and organization data
      const [client, organization] = await Promise.all([
        this.getClientData(project.clientId!, orgId),
        this.getOrganizationData(orgId)
      ]);

      if (!client) {
        throw new Error('Client not found for project');
      }

      // 3. Create invoice items from project data
      const invoiceItems = this.createItemsFromProject(project);

      // 4. Generate invoice number
      const invoiceNumber = this.docxParser.generateInvoiceNumber(projectId, orgId);

      // 5. Create invoice data
      const financeInvoiceData: FinanceInvoiceData = {
        clientId: client.id,
        projectId: project.id,
        items: invoiceItems,
        currency: 'KES', // Default to KES as per existing system
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: this.calculateDueDate(new Date()).toISOString().split('T')[0]
      };

      // 6. Create invoice
      const invoice = await this.createInvoiceInDatabase(
        orgId,
        financeInvoiceData,
        invoiceNumber,
        createdBy
      );

      // 7. Map to schema and generate PDF
      const invoiceSchema = await this.mapToInvoiceSchema(
        invoice,
        client,
        organization,
        project,
        financeInvoiceData
      );

      const pdfBuffer = await this.generateInvoicePDF(invoiceSchema);

      // 8. Log activity (commented out for now)
      // await logAdminActivity(
      //   this.prisma,
      //   orgId,
      //   'project.invoice_generated',
      //   'project',
      //   projectId,
      //   createdBy,
      //   {
      //     invoiceId: invoice.id,
      //     invoiceNumber: invoice.number,
      //     clientId: client.id
      //   }
      // );

      console.log(`✅ Project invoice generated: ${invoice.number}`);
      console.log(`📄 PDF generated: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

      return { invoice, pdfBuffer };
    } catch (error) {
      console.error('Error generating project invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice with PDF for download
   */
  async getInvoiceWithPDF(invoiceId: string, orgId: string): Promise<{ invoice: any; pdfBuffer: Buffer }> {
    try {
      // Get invoice from database
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, orgId, deletedAt: null },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          project: { select: { id: true, name: true, projectDetails: true } },
          items: true
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get organization data
      const organization = await this.getOrganizationData(orgId);

      // Map to schema
      const invoiceSchema = await this.mapToInvoiceSchema(
        invoice,
        invoice.client,
        organization,
        invoice.project,
        {
          clientId: invoice.clientId,
          items: invoice.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString()
          }))
        }
      );

      // Generate PDF
      const pdfBuffer = await this.generateInvoicePDF(invoiceSchema);

      return { invoice, pdfBuffer };
    } catch (error) {
      console.error('Error getting invoice with PDF:', error);
      throw error;
    }
  }

  /**
   * Create invoice in database using existing finance logic
   */
  private async createInvoiceInDatabase(
    orgId: string,
    invoiceData: FinanceInvoiceData,
    invoiceNumber: string,
    createdBy: string
  ): Promise<any> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Calculate total amount
      const totalAmount = invoiceData.items.reduce((sum, item) => {
        const value = Number(item.unitPrice) * (item.quantity || 1);
        return sum + value;
      }, 0);

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          orgId,
          clientId: invoiceData.clientId,
          projectId: invoiceData.projectId,
          number: invoiceNumber,
          status: 'sent',
          issueDate: invoiceData.issueDate ? new Date(invoiceData.issueDate) : new Date(),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          currency: invoiceData.currency ?? 'KES',
          totalAmount: new Prisma.Decimal(totalAmount.toFixed(2))
        }
      });

      // Create invoice items
      await tx.invoiceItem.createMany({
        data: invoiceData.items.map((item) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: new Prisma.Decimal(item.unitPrice)
        }))
      });

      // Create event log
      await tx.eventLog.create({
        data: {
          orgId,
          type: 'invoice.created',
          entityType: 'invoice',
          entityId: invoice.id,
          metadata: {
            number: invoice.number,
            clientId: invoice.clientId,
            projectId: invoice.projectId,
            createdBy,
            pdfGenerated: true
          }
        }
      });

      return invoice;
    });

    return result;
  }

  /**
   * Map database data to invoice schema for PDF generation
   */
  private async mapToInvoiceSchema(
    invoice: any,
    client: any,
    organization: any,
    project: any,
    invoiceData: FinanceInvoiceData
  ): Promise<InvoiceSchema> {
    const now = new Date();

    return {
      invoice_number: invoice.number,
      invoice_date: invoice.issueDate.toISOString().split('T')[0],
      due_date: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : '',
      status: invoice.status as any,
      currency: invoice.currency,
      client: {
        id: client.id,
        name: client.name,
        email: client.email || undefined,
        phone: client.phone || undefined,
      },
      company: {
        name: organization.name,
        email: undefined, // Not in current schema
        phone: undefined, // Not in current schema
        address: undefined, // Not in current schema
        logo_url: undefined, // Not in current schema
        tax_id: undefined, // Not in current schema
        website: undefined, // Not in current schema
      },
      project: project ? {
        id: project.id,
        name: project.name,
        description: project.projectDetails || undefined,
      } : undefined,
      items: invoiceData.items.map((item, index) => ({
        id: `item-${index + 1}`,
        name: item.description,
        description: '',
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        total_price: Number(item.unitPrice) * item.quantity,
        type: 'service' as const,
        category: 'professional_services',
      })),
      summary: {
        subtotal: invoiceData.items.reduce((sum, item) => sum + (Number(item.unitPrice) * item.quantity), 0),
        tax_rate: 0, // No tax for now
        tax_amount: 0,
        total_amount: Number(invoice.totalAmount),
        balance_due: Number(invoice.totalAmount),
      },
      payment_terms: {
        due_in_days: 7, // Default 7 days
        payment_methods: ['bank_transfer', 'mobile_money'],
      },
      notes: {
        client_message: 'Thank you for your business! Payment is due within 7 days.',
      },
      automation: {
        auto_reminders_enabled: true,
        reminder_schedule: [3, 1],
        late_fee_enabled: false,
      },
      created_at: invoice.createdAt.toISOString(),
      updated_at: invoice.updatedAt.toISOString(),
      created_by: 'system',
      organization_id: invoice.orgId,
    };
  }

  /**
   * Generate PDF using the DOCX template format
   */
  private async generateInvoicePDF(invoiceSchema: InvoiceSchema): Promise<Buffer> {
    // Map invoice data to match DOCX template structure
    const templateData = this.docxParser.mapInvoiceToTemplate(invoiceSchema);

    // Generate PDF with the exact format from the DOCX template
    const pdfGenerator = new PDFGenerator({
      filename: `${invoiceSchema.invoice_number}.pdf`,
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 }
    });

    return await pdfGenerator.generatePDF(invoiceSchema);
  }

  /**
   * Get organization data
   */
  private async getOrganizationData(orgId: string): Promise<any> {
    const org = await this.prisma.org.findFirst({
      where: { id: orgId },
      select: { id: true, name: true, slug: true }
    });

    return org;
  }

  /**
   * Get client data
   */
  private async getClientData(clientId: string, orgId: string): Promise<any> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, orgId, deletedAt: null },
      select: { id: true, name: true, email: true, phone: true }
    });

    return client;
  }

  /**
   * Get project data
   */
  private async getProjectData(projectId: string, orgId: string): Promise<any> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        clientId: true,
        price: true,
        projectDetails: true,
        startDate: true,
        endDate: true
      }
    });

    return project;
  }

  /**
   * Create invoice items from project data
   */
  private createItemsFromProject(project: any): Array<{ description: string; quantity: number; unitPrice: string }> {
    const items = [];

    // Main project service
    if (project.price) {
      items.push({
        description: `${project.name} - Project Development`,
        quantity: 1,
        unitPrice: project.price.toString()
      });
    }

    // Add additional items based on project details if available
    if (project.projectDetails) {
      items.push({
        description: 'Project Management & Coordination',
        quantity: 1,
        unitPrice: '0' // Could be calculated based on project size
      });
    }

    return items;
  }

  /**
   * Calculate due date (7 days from invoice date)
   */
  private calculateDueDate(invoiceDate: Date): Date {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 7);
    return dueDate;
  }
}
