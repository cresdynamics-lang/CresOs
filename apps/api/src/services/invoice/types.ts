export interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  filePath: string;
  placeholders: InvoicePlaceholder[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoicePlaceholder {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  issueDate: Date;
  dueDate?: Date;
  currency: string;
  items: InvoiceItemData[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  notes?: string;
  paymentTerms?: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  projectTitle?: string;
  projectDescription?: string;
}

export interface InvoiceItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface GeneratedInvoice {
  id: string;
  templateId: string;
  data: InvoiceData;
  generatedFilePath: string;
  generatedAt: Date;
  status: 'draft' | 'generated' | 'sent';
}
