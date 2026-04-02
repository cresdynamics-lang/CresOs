import { InvoiceTemplate, InvoicePlaceholder } from './types';

export const DEFAULT_INVOICE_PLACEHOLDERS: InvoicePlaceholder[] = [
  // Invoice Details
  { key: 'invoiceNumber', label: 'Invoice Number', type: 'text', required: true },
  { key: 'issueDate', label: 'Issue Date', type: 'date', required: true },
  { key: 'dueDate', label: 'Due Date', type: 'date', required: false },
  { key: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'KES' },
  
  // Client Information
  { key: 'clientName', label: 'Client Name', type: 'text', required: true },
  { key: 'clientEmail', label: 'Client Email', type: 'text', required: false },
  { key: 'clientPhone', label: 'Client Phone', type: 'text', required: false },
  { key: 'clientAddress', label: 'Client Address', type: 'text', required: false },
  
  // Company Information
  { key: 'companyName', label: 'Company Name', type: 'text', required: true },
  { key: 'companyAddress', label: 'Company Address', type: 'text', required: false },
  { key: 'companyPhone', label: 'Company Phone', type: 'text', required: false },
  { key: 'companyEmail', label: 'Company Email', type: 'text', required: false },
  
  // Project Information
  { key: 'projectTitle', label: 'Project Title', type: 'text', required: false },
  { key: 'projectDescription', label: 'Project Description', type: 'text', required: false },
  
  // Financial Details
  { key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
  { key: 'taxRate', label: 'Tax Rate (%)', type: 'number', required: false },
  { key: 'taxAmount', label: 'Tax Amount', type: 'currency', required: false },
  { key: 'totalAmount', label: 'Total Amount', type: 'currency', required: true },
  
  // Additional Information
  { key: 'notes', label: 'Notes', type: 'text', required: false },
  { key: 'paymentTerms', label: 'Payment Terms', type: 'text', required: false },
];

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplate = {
  id: 'default',
  name: 'Standard Invoice Template',
  description: 'Default invoice template with all standard fields',
  filePath: '/templates/invoice-default.docx',
  placeholders: DEFAULT_INVOICE_PLACEHOLDERS,
  createdAt: new Date(),
  updatedAt: new Date(),
};
