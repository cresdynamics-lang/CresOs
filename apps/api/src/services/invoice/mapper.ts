import { InvoiceSchema, InvoiceItem } from './schema';
import { InvoiceNumberGenerator, DueDateCalculator, TaxCalculator, InvoiceCalculator } from './calculators';

export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  client_id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  services: Array<{
    name: string;
    price: number;
    description?: string;
    type?: 'service' | 'milestone' | 'retainer';
  }>;
  total_price: number;
  start_date?: string;
  end_date?: string;
  milestones?: Array<{
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    budget?: number;
    completed_at?: string;
  }>;
}

export interface OrganizationData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    postal_code?: string;
  };
  logo_url?: string;
  tax_id?: string;
  website?: string;
}

export interface InvoiceGenerationConfig {
  invoice_number: {
    prefix: string;
    format: string;
    separator: string;
    reset_frequency: 'monthly' | 'yearly' | 'never';
  };
  due_date: {
    default_days: number;
    business_days_only: boolean;
    custom_rules?: Array<{
      client_type?: string;
      project_type?: string;
      days: number;
    }>;
  };
  tax: {
    default_rate?: number;
    tax_rules?: Array<{
      client_location?: string;
      service_type?: string;
      rate: number;
    }>;
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

export class InvoiceDataMapper {
  static mapProjectToInvoice(
    project: ProjectData,
    organization: OrganizationData,
    config: InvoiceGenerationConfig,
    invoiceType: 'standard' | 'milestone' | 'retainer' = 'standard',
    specificMilestoneId?: string
  ): InvoiceSchema {
    const now = new Date();
    const invoiceDate = now.toISOString().split('T')[0];
    
    // Generate invoice number
    const invoiceNumber = InvoiceNumberGenerator.generateInvoiceNumber(
      config.invoice_number,
      organization.id,
      now
    );
    
    // Calculate due date
    const dueDate = DueDateCalculator.calculateDueDate(
      config.due_date,
      now
    ).toISOString().split('T')[0];
    
    // Map items based on invoice type
    let items: InvoiceItem[];
    
    switch (invoiceType) {
      case 'milestone':
        items = this.mapMilestoneItems(project, specificMilestoneId);
        break;
      case 'retainer':
        items = this.mapRetainerItems(project);
        break;
      default:
        items = this.mapStandardItems(project);
    }
    
    // Calculate totals
    const itemsWithTotals = InvoiceCalculator.calculateItemTotals(items);
    const taxInfo = TaxCalculator.calculateTax(
      itemsWithTotals.reduce((sum, item) => sum + item.total_price, 0),
      config.tax
    );
    const totals = InvoiceCalculator.calculateTotals(
      itemsWithTotals,
      taxInfo.tax_rate
    );
    
    return {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: 'draft',
      currency: 'KES', // Default currency - make configurable
      client: {
        id: project.client_id,
        name: project.client_name,
        email: project.client_email,
        phone: project.client_phone,
      },
      company: {
        name: organization.name,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        logo_url: organization.logo_url,
        tax_id: organization.tax_id,
        website: organization.website,
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        start_date: project.start_date,
        end_date: project.end_date,
      },
      items: itemsWithTotals,
      summary: {
        subtotal: totals.subtotal,
        tax_rate: taxInfo.tax_rate,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount,
        balance_due: totals.balance_due,
      },
      payment_terms: {
        due_in_days: config.due_date.default_days,
        payment_methods: ['bank_transfer', 'credit_card', 'paypal'],
      },
      automation: {
        auto_reminders_enabled: config.automation.auto_reminders.enabled,
        reminder_schedule: config.automation.auto_reminders.schedule,
        late_fee_enabled: false,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      created_by: 'system', // Replace with actual user ID
      organization_id: organization.id,
    };
  }

  private static mapStandardItems(project: ProjectData): InvoiceItem[] {
    return project.services.map((service, index) => ({
      id: `item-${index + 1}`,
      name: service.name,
      description: service.description,
      quantity: 1,
      unit_price: service.price,
      total_price: service.price,
      type: service.type || 'service',
      category: 'professional_services',
    }));
  }

  private static mapMilestoneItems(project: ProjectData, milestoneId?: string): InvoiceItem[] {
    if (!project.milestones || project.milestones.length === 0) {
      return this.mapStandardItems(project);
    }

    const milestonesToInvoice = milestoneId
      ? project.milestones.filter(m => m.id === milestoneId)
      : project.milestones.filter(m => m.completed_at);

    return milestonesToInvoice.map((milestone, index) => ({
      id: `milestone-${milestone.id}`,
      name: milestone.title,
      description: milestone.description,
      quantity: 1,
      unit_price: milestone.budget || 0,
      total_price: milestone.budget || 0,
      type: 'milestone' as const,
      category: 'milestone_completion',
      milestone: {
        id: milestone.id,
        title: milestone.title,
        due_date: milestone.due_date,
        completed_at: milestone.completed_at,
      },
    }));
  }

  private static mapRetainerItems(project: ProjectData): InvoiceItem[] {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    return [{
      id: 'retainer-1',
      name: `Monthly Retainer - ${project.name}`,
      description: `Retainer services for ${currentMonth}`,
      quantity: 1,
      unit_price: project.total_price,
      total_price: project.total_price,
      type: 'retainer' as const,
      category: 'retainer_fee',
      retainer_period: {
        start_date: `${currentMonth}-01`,
        end_date: `${currentMonth}-31`,
        hours_included: 40, // Default hours - make configurable
      },
    }];
  }

  static updateInvoiceForPayment(invoice: InvoiceSchema, paymentAmount: number): InvoiceSchema {
    const amountPaid = (invoice.summary.amount_paid || 0) + paymentAmount;
    const balanceDue = invoice.summary.total_amount - amountPaid;
    
    return {
      ...invoice,
      summary: {
        ...invoice.summary,
        amount_paid: amountPaid,
        balance_due: Math.max(0, balanceDue),
      },
      status: balanceDue <= 0 ? 'paid' : 'sent',
      updated_at: new Date().toISOString(),
    };
  }

  static addLateFee(invoice: InvoiceSchema, lateFeePercentage: number): InvoiceSchema {
    const lateFeeAmount = invoice.summary.balance_due * (lateFeePercentage / 100);
    
    return {
      ...invoice,
      summary: {
        ...invoice.summary,
        total_amount: invoice.summary.total_amount + lateFeeAmount,
        balance_due: invoice.summary.balance_due + lateFeeAmount,
      },
      notes: {
        ...invoice.notes,
        internal: `Late fee of ${lateFeePercentage}% (${lateFeeAmount.toFixed(2)}) applied`,
      },
      updated_at: new Date().toISOString(),
    };
  }
}
