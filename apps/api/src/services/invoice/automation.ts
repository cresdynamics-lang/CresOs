import type { PrismaClient } from '@prisma/client';
import { InvoiceSchema, InvoiceTemplate, InvoiceAnalytics } from './schema';
import { InvoiceDataMapper, ProjectData, OrganizationData } from './mapper';
import { InvoiceNumberGenerator } from './calculators';
import { PDFGenerator } from './pdf-generator';

export interface InvoiceAutomationConfig {
  organization_id: string;
  invoice_number: {
    prefix: string;
    format: string;
    separator: string;
    reset_frequency: 'monthly' | 'yearly' | 'never';
  };
  due_date: {
    default_days: number;
    business_days_only: boolean;
  };
  tax: {
    default_rate?: number;
  };
  automation: {
    auto_generate_on_project_create: boolean;
    auto_generate_on_milestone_complete: boolean;
    auto_send_invoice: boolean;
    auto_reminders: {
      enabled: boolean;
      schedule: number[];
    };
  };
}

export class InvoiceAutomationService {
  private prisma: PrismaClient;
  private config: InvoiceAutomationConfig;

  constructor(prisma: PrismaClient, config: InvoiceAutomationConfig) {
    this.prisma = prisma;
    this.config = config;
  }

  /**
   * Generate invoice automatically when a project is created
   */
  async generateInvoiceOnProjectCreation(projectId: string): Promise<InvoiceSchema> {
    if (!this.config.automation.auto_generate_on_project_create) {
      throw new Error('Auto-generation on project creation is disabled');
    }

    try {
      // Get project data
      const project = await this.getProjectData(projectId);
      
      // Get organization data
      const organization = await this.getOrganizationData(this.config.organization_id);
      
      // Map to invoice schema
      const invoice = InvoiceDataMapper.mapProjectToInvoice(
        project,
        organization,
        this.config,
        'standard'
      );
      
      // Save to database
      const savedInvoice = await this.saveInvoiceToDatabase(invoice);
      
      // Generate PDF
      const pdfBuffer = await this.generateInvoicePDF(savedInvoice);
      
      // Send invoice if auto-send is enabled
      if (this.config.automation.auto_send_invoice) {
        await this.sendInvoice(savedInvoice, pdfBuffer);
      }
      
      return savedInvoice;
    } catch (error) {
      console.error('Error generating invoice on project creation:', error);
      throw error;
    }
  }

  /**
   * Generate milestone-based invoice
   */
  async generateMilestoneInvoice(projectId: string, milestoneId: string): Promise<InvoiceSchema> {
    try {
      const project = await this.getProjectData(projectId);
      const organization = await this.getOrganizationData(this.config.organization_id);
      
      const invoice = InvoiceDataMapper.mapProjectToInvoice(
        project,
        organization,
        this.config,
        'milestone',
        milestoneId
      );
      
      const savedInvoice = await this.saveInvoiceToDatabase(invoice);
      const pdfBuffer = await this.generateInvoicePDF(savedInvoice);
      
      if (this.config.automation.auto_send_invoice) {
        await this.sendInvoice(savedInvoice, pdfBuffer);
      }
      
      return savedInvoice;
    } catch (error) {
      console.error('Error generating milestone invoice:', error);
      throw error;
    }
  }

  /**
   * Generate retainer invoice
   */
  async generateRetainerInvoice(projectId: string): Promise<InvoiceSchema> {
    try {
      const project = await this.getProjectData(projectId);
      const organization = await this.getOrganizationData(this.config.organization_id);
      
      const invoice = InvoiceDataMapper.mapProjectToInvoice(
        project,
        organization,
        this.config,
        'retainer'
      );
      
      const savedInvoice = await this.saveInvoiceToDatabase(invoice);
      const pdfBuffer = await this.generateInvoicePDF(savedInvoice);
      
      if (this.config.automation.auto_send_invoice) {
        await this.sendInvoice(savedInvoice, pdfBuffer);
      }
      
      return savedInvoice;
    } catch (error) {
      console.error('Error generating retainer invoice:', error);
      throw error;
    }
  }

  /**
   * Generate custom invoice with manual data
   */
  async generateCustomInvoice(invoiceData: Partial<InvoiceSchema>): Promise<InvoiceSchema> {
    try {
      const organization = await this.getOrganizationData(this.config.organization_id);
      
      // Generate invoice number
      const now = new Date();
      const invoiceNumber = InvoiceNumberGenerator.generateInvoiceNumber(
        this.config.invoice_number,
        this.config.organization_id,
        now
      );
      
      // Complete the invoice data
      const completeInvoice: InvoiceSchema = {
        invoice_number: invoiceNumber,
        invoice_date: now.toISOString().split('T')[0],
        due_date: this.calculateDueDate(now).toISOString().split('T')[0],
        status: 'draft',
        currency: 'USD',
        client: invoiceData.client!,
        company: {
          id: organization.id,
          name: organization.name,
          email: organization.email,
          phone: organization.phone,
          address: organization.address,
          logo_url: organization.logo_url,
          tax_id: organization.tax_id,
          website: organization.website,
        },
        items: invoiceData.items || [],
        summary: invoiceData.summary || {
          subtotal: 0,
          total_amount: 0,
          balance_due: 0,
        },
        payment_terms: {
          due_in_days: this.config.due_date.default_days,
          payment_methods: ['bank_transfer', 'credit_card'],
        },
        automation: {
          auto_reminders_enabled: this.config.automation.auto_reminders.enabled,
          reminder_schedule: this.config.automation.auto_reminders.schedule,
          late_fee_enabled: false,
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        created_by: 'system',
        organization_id: this.config.organization_id,
        ...invoiceData,
      };
      
      const savedInvoice = await this.saveInvoiceToDatabase(completeInvoice);
      const pdfBuffer = await this.generateInvoicePDF(savedInvoice);
      
      return savedInvoice;
    } catch (error) {
      console.error('Error generating custom invoice:', error);
      throw error;
    }
  }

  /**
   * Process payment for an invoice
   */
  async processInvoicePayment(invoiceId: string, paymentAmount: number): Promise<InvoiceSchema> {
    try {
      // Get current invoice
      const currentInvoice = await this.getInvoiceFromDatabase(invoiceId);
      
      // Update invoice with payment
      const updatedInvoice = InvoiceDataMapper.updateInvoiceForPayment(
        currentInvoice,
        paymentAmount
      );
      
      // Save updated invoice
      await this.updateInvoiceInDatabase(updatedInvoice);
      
      // Send payment confirmation
      if (updatedInvoice.status === 'paid') {
        await this.sendPaymentConfirmation(updatedInvoice);
      }
      
      return updatedInvoice;
    } catch (error) {
      console.error('Error processing invoice payment:', error);
      throw error;
    }
  }

  /**
   * Apply late fees to overdue invoices
   */
  async applyLateFees(): Promise<void> {
    try {
      const overdueInvoices = await this.getOverdueInvoices();
      
      for (const invoice of overdueInvoices) {
        if (invoice.automation.late_fee_enabled) {
          const updatedInvoice = InvoiceDataMapper.addLateFee(invoice, 1.5); // 1.5% late fee
          await this.updateInvoiceInDatabase(updatedInvoice);
          
          // Send late fee notification
          await this.sendLateFeeNotification(updatedInvoice);
        }
      }
    } catch (error) {
      console.error('Error applying late fees:', error);
    }
  }

  /**
   * Send invoice reminders
   */
  async sendInvoiceReminders(): Promise<void> {
    try {
      if (!this.config.automation.auto_reminders.enabled) return;
      
      const upcomingInvoices = await this.getInvoicesDueForReminder();
      
      for (const invoice of upcomingInvoices) {
        await this.sendInvoiceReminder(invoice);
      }
    } catch (error) {
      console.error('Error sending invoice reminders:', error);
    }
  }

  /**
   * Get invoice analytics
   */
  async getInvoiceAnalytics(dateRange?: { start: Date; end: Date }): Promise<InvoiceAnalytics> {
    try {
      const whereClause: any = {
        organization_id: this.config.organization_id,
        deletedAt: null,
      };
      
      if (dateRange) {
        whereClause.created_at = {
          gte: dateRange.start,
          lte: dateRange.end,
        };
      }
      
      const invoices = await this.prisma.invoice.findMany({
        where: whereClause,
        include: {
          items: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      // Calculate analytics
      const totalInvoices = invoices.length;
      const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const paidAmount = invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const outstandingAmount = invoices
        .filter(inv => inv.status === 'sent' || inv.status === 'partial')
        .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const overdueAmount = invoices
        .filter(inv => inv.status === 'overdue')
        .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      
      // Group by status
      const invoicesByStatus = invoices.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Group by month
      const invoicesByMonth = this.groupInvoicesByMonth(invoices);
      
      // Top clients
      const topClients = this.getTopClients(invoices);
      
      return {
        total_invoices: totalInvoices,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        overdue_amount: overdueAmount,
        average_payment_time: this.calculateAveragePaymentTime(invoices),
        invoices_by_status: invoicesByStatus,
        invoices_by_month: invoicesByMonth,
        top_clients: topClients,
      };
    } catch (error) {
      console.error('Error getting invoice analytics:', error);
      throw error;
    }
  }

  // Private helper methods
  private async getProjectData(projectId: string): Promise<ProjectData> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: this.config.organization_id,
        deletedAt: null,
      },
    });
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Get client data separately
    const client = project.clientId ? await this.prisma.client.findFirst({
      where: {
        id: project.clientId,
        orgId: this.config.organization_id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    }) : null;
    
    return {
      id: project.id,
      name: project.name,
      description: project.projectDetails || undefined,
      client_id: project.clientId || '',
      client_name: client?.name || '',
      client_email: client?.email || undefined,
      client_phone: client?.phone || undefined,
      services: [], // Would need to be populated from project data
      total_price: Number(project.price || 0),
      start_date: project.startDate?.toISOString().split('T')[0],
      end_date: project.endDate?.toISOString().split('T')[0],
      milestones: [], // Not including milestones for now due to schema limitations
    };
  }

  private async getOrganizationData(orgId: string): Promise<OrganizationData> {
    const org = await this.prisma.org.findFirst({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    return {
      id: org.id,
      name: org.name,
      email: undefined, // Not in current schema
      phone: undefined, // Not in current schema
      address: undefined, // Not in current schema
      logo_url: undefined, // Not in current schema
      tax_id: undefined, // Not in current schema
      website: undefined, // Not in current schema
    };
  }

  private calculateDueDate(invoiceDate: Date): Date {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + this.config.due_date.default_days);
    return dueDate;
  }

  private async saveInvoiceToDatabase(invoice: InvoiceSchema): Promise<InvoiceSchema> {
    // Implementation would save to database
    // For now, return the invoice as-is
    return invoice;
  }

  private async updateInvoiceInDatabase(invoice: InvoiceSchema): Promise<void> {
    // Implementation would update in database
  }

  private async getInvoiceFromDatabase(invoiceId: string): Promise<InvoiceSchema> {
    // Implementation would get from database
    throw new Error('Not implemented');
  }

  private async generateInvoicePDF(invoice: InvoiceSchema): Promise<Buffer> {
    const pdfGenerator = new PDFGenerator({
      filename: `${invoice.invoice_number}.pdf`,
    });
    
    return await pdfGenerator.generatePDF(invoice);
  }

  private async sendInvoice(invoice: InvoiceSchema, pdfBuffer: Buffer): Promise<void> {
    // Implementation would send email with PDF attachment
    console.log(`Sending invoice ${invoice.invoice_number} to ${invoice.client.email}`);
  }

  private async sendPaymentConfirmation(invoice: InvoiceSchema): Promise<void> {
    // Implementation would send payment confirmation email
    console.log(`Sending payment confirmation for invoice ${invoice.invoice_number}`);
  }

  private async sendLateFeeNotification(invoice: InvoiceSchema): Promise<void> {
    // Implementation would send late fee notification
    console.log(`Sending late fee notification for invoice ${invoice.invoice_number}`);
  }

  private async sendInvoiceReminder(invoice: InvoiceSchema): Promise<void> {
    // Implementation would send reminder email
    console.log(`Sending reminder for invoice ${invoice.invoice_number}`);
  }

  private async getOverdueInvoices(): Promise<InvoiceSchema[]> {
    // Implementation would get overdue invoices from database
    return [];
  }

  private async getInvoicesDueForReminder(): Promise<InvoiceSchema[]> {
    // Implementation would get invoices due for reminder
    return [];
  }

  private groupInvoicesByMonth(invoices: any[]): any[] {
    // Implementation would group invoices by month
    return [];
  }

  private getTopClients(invoices: any[]): any[] {
    // Implementation would calculate top clients
    return [];
  }

  private calculateAveragePaymentTime(invoices: any[]): number {
    // Implementation would calculate average payment time
    return 0;
  }
}
