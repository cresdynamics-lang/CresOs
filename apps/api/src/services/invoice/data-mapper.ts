import { InvoiceData, InvoiceItemData } from './types';

export class InvoiceDataMapper {
  static mapFromFinanceRequest(financeRequest: any, organization: any, client: any, project?: any): InvoiceData {
    const items: InvoiceItemData[] = this.extractItems(financeRequest, project);
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 0; // Default tax rate since it's not in the approval schema
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    return {
      invoiceNumber: this.generateInvoiceNumber(financeRequest),
      clientName: client.name,
      clientEmail: client.email || undefined,
      clientPhone: client.phone || undefined,
      clientAddress: undefined, // Not available in schema
      issueDate: new Date(),
      dueDate: this.calculateDueDate(), // Default 30 days
      currency: 'KES', // Default currency
      items,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      notes: financeRequest.reason || undefined,
      paymentTerms: undefined, // Not available in schema
      companyName: organization.name,
      companyAddress: undefined, // Not available in schema
      companyPhone: undefined, // Not available in schema
      companyEmail: undefined, // Not available in schema
      projectTitle: project?.name,
      projectDescription: project?.projectDetails || undefined,
    };
  }

  private static extractItems(financeRequest: any, project?: any): InvoiceItemData[] {
    const items: InvoiceItemData[] = [];

    // If finance request has explicit items
    if (financeRequest.items && Array.isArray(financeRequest.items)) {
      return financeRequest.items.map((item: any) => ({
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: Number(item.unitPrice),
        total: Number(item.unitPrice) * (item.quantity || 1),
      }));
    }

    // Extract from project milestones/tasks if available
    if (project?.milestones) {
      project.milestones.forEach((milestone: any) => {
        items.push({
          description: milestone.name || milestone.acceptanceCriteria,
          quantity: 1,
          unitPrice: 0, // Budget not available in milestone schema
          total: 0,
        });
      });
    }

    // If no items found, create a default item from the total amount
    if (items.length === 0) {
      const amount = Number(financeRequest.amount || 0);
      items.push({
        description: financeRequest.description || 'Services rendered',
        quantity: 1,
        unitPrice: amount,
        total: amount,
      });
    }

    return items;
  }

  private static generateInvoiceNumber(financeRequest: any): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  private static calculateDueDate(paymentTerms?: string): Date {
    const dueDate = new Date();
    
    if (!paymentTerms) {
      // Default to 30 days
      dueDate.setDate(dueDate.getDate() + 30);
      return dueDate;
    }

    // Parse common payment term patterns
    const daysMatch = paymentTerms.match(/(\d+)\s*days?/i);
    const netMatch = paymentTerms.match(/net\s*(\d+)/i);
    
    if (daysMatch) {
      dueDate.setDate(dueDate.getDate() + parseInt(daysMatch[1]));
    } else if (netMatch) {
      dueDate.setDate(dueDate.getDate() + parseInt(netMatch[1]));
    } else {
      // Default to 30 days if pattern not recognized
      dueDate.setDate(dueDate.getDate() + 30);
    }

    return dueDate;
  }

  static mapFromDatabaseRecord(invoice: any, client: any, organization: any, project?: any): InvoiceData {
    const items = invoice.items?.map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.unitPrice) * item.quantity,
    })) || [];

    return {
      invoiceNumber: invoice.number,
      clientName: client.name,
      clientEmail: client.email || undefined,
      clientPhone: client.phone || undefined,
      clientAddress: undefined, // Not available in schema
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate || undefined,
      currency: invoice.currency,
      items,
      subtotal: items.reduce((sum: number, item: InvoiceItemData) => sum + item.total, 0),
      taxRate: undefined, // Not stored in current schema
      taxAmount: undefined, // Not stored in current schema
      totalAmount: Number(invoice.totalAmount),
      notes: undefined, // Not stored in current schema
      paymentTerms: undefined, // Not stored in current schema
      companyName: organization.name,
      companyAddress: undefined, // Not available in schema
      companyPhone: undefined, // Not available in schema
      companyEmail: undefined, // Not available in schema
      projectTitle: project?.name,
      projectDescription: project?.projectDetails,
    };
  }
}
