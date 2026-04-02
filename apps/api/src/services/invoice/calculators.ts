import { InvoiceSchema, InvoiceGenerationConfig } from './schema';

export class InvoiceNumberGenerator {
  private static sequence: Map<string, number> = new Map();

  static generateInvoiceNumber(
    config: InvoiceGenerationConfig['invoice_number'],
    orgId: string,
    date: Date = new Date()
  ): string {
    const { prefix, format, separator, reset_frequency } = config;
    
    // Get sequence key based on reset frequency
    const sequenceKey = this.getSequenceKey(reset_frequency, orgId, date);
    
    // Get and increment sequence
    const currentSequence = this.sequence.get(sequenceKey) || 0;
    const nextSequence = currentSequence + 1;
    this.sequence.set(sequenceKey, nextSequence);
    
    // Replace placeholders in format
    const formatted = format
      .replace(/{seq:(\d+)}/g, (_, digits) => 
        nextSequence.toString().padStart(parseInt(digits), '0')
      )
      .replace(/{year:(\d+)}/g, (_, digits) => 
        date.getFullYear().toString().slice(-parseInt(digits))
      )
      .replace(/{month:(\d+)}/g, (_, digits) => 
        (date.getMonth() + 1).toString().padStart(parseInt(digits), '0')
      )
      .replace(/{day:(\d+)}/g, (_, digits) => 
        date.getDate().toString().padStart(parseInt(digits), '0')
      );
    
    return `${prefix}${separator}${formatted}`;
  }

  private static getSequenceKey(frequency: string, orgId: string, date: Date): string {
    switch (frequency) {
      case 'monthly':
        return `${orgId}-${date.getFullYear()}-${date.getMonth() + 1}`;
      case 'yearly':
        return `${orgId}-${date.getFullYear()}`;
      default:
        return orgId;
    }
  }

  static async loadSequenceFromDatabase(prisma: any, orgId: string): Promise<void> {
    try {
      // Load the last invoice number for this organization
      const lastInvoice = await prisma.invoice.findFirst({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        select: { number: true, createdAt: true }
      });

      if (lastInvoice) {
        // Extract sequence from last invoice number
        const sequence = this.extractSequenceFromNumber(lastInvoice.number);
        const date = lastInvoice.createdAt;
        const sequenceKey = this.getSequenceKey('yearly', orgId, date);
        this.sequence.set(sequenceKey, sequence);
      }
    } catch (error) {
      console.error('Error loading invoice sequence:', error);
    }
  }

  private static extractSequenceFromNumber(invoiceNumber: string): number {
    // Extract sequence number from invoice number
    // This is a simplified implementation - adjust based on your format
    const match = invoiceNumber.match(/(\d+)(?!.*\d)/);
    return match ? parseInt(match[1]) : 0;
  }
}

export class DueDateCalculator {
  static calculateDueDate(
    config: InvoiceGenerationConfig['due_date'],
    invoiceDate: Date = new Date(),
    clientType?: string,
    projectType?: string
  ): Date {
    const { default_days, business_days_only, custom_rules } = config;
    
    // Check for custom rules
    let days = default_days;
    
    if (custom_rules) {
      const customRule = custom_rules.find(rule => 
        (!rule.client_type || rule.client_type === clientType) &&
        (!rule.project_type || rule.project_type === projectType)
      );
      
      if (customRule) {
        days = customRule.days;
      }
    }
    
    const dueDate = new Date(invoiceDate);
    
    if (business_days_only) {
      return this.addBusinessDays(dueDate, days);
    } else {
      dueDate.setDate(dueDate.getDate() + days);
      return dueDate;
    }
  }

  private static addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let businessDays = 0;
    
    while (businessDays < days) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
    }
    
    return result;
  }
}

export class TaxCalculator {
  static calculateTax(
    amount: number,
    config: InvoiceGenerationConfig['tax'],
    clientLocation?: string,
    serviceType?: string
  ): { tax_rate: number; tax_amount: number } {
    const { default_rate, tax_rules } = config;
    
    let taxRate = default_rate || 0;
    
    // Check for specific tax rules
    if (tax_rules) {
      const applicableRule = tax_rules.find(rule => 
        (!rule.client_location || rule.client_location === clientLocation) &&
        (!rule.service_type || rule.service_type === serviceType)
      );
      
      if (applicableRule) {
        taxRate = applicableRule.rate;
      }
    }
    
    const taxAmount = amount * (taxRate / 100);
    
    return {
      tax_rate: taxRate,
      tax_amount: taxAmount
    };
  }
}

export class InvoiceCalculator {
  static calculateTotals(items: any[], taxRate: number = 0, discountAmount: number = 0) {
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    
    const tax_amount = subtotal * (taxRate / 100);
    const total_amount = subtotal + tax_amount - discountAmount;
    
    return {
      subtotal,
      tax_amount,
      total_amount,
      balance_due: total_amount
    };
  }

  static calculateItemTotals(items: any[]): any[] {
    return items.map(item => ({
      ...item,
      total_price: (item.unit_price || 0) * (item.quantity || 1)
    }));
  }
}
