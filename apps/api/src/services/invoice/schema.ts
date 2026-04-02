export interface InvoiceSchema {
  // Invoice Metadata
  id?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  currency: string;
  
  // Client Information
  client: {
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
  };
  
  // Company Information (Your SaaS)
  company: {
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
  };
  
  // Project Information
  project?: {
    id: string;
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  };
  
  // Invoice Items
  items: InvoiceItem[];
  
  // Financial Summary
  summary: {
    subtotal: number;
    tax_rate?: number;
    tax_amount?: number;
    discount_amount?: number;
    total_amount: number;
    amount_paid?: number;
    balance_due: number;
  };
  
  // Payment Terms
  payment_terms: {
    due_in_days: number;
    late_fee_percentage?: number;
    payment_methods?: string[];
    bank_details?: {
      bank_name?: string;
      account_name?: string;
      account_number?: string;
      routing_number?: string;
      swift_code?: string;
    };
  };
  
  // Notes and Messages
  notes?: {
    internal?: string;
    client_message?: string;
    terms_and_conditions?: string;
  };
  
  // Automation & Tracking
  automation: {
    auto_reminders_enabled: boolean;
    reminder_schedule?: number[]; // days before due date
    late_fee_enabled: boolean;
    auto_charge_enabled?: boolean;
  };
  
  // System Fields
  created_at: string;
  updated_at: string;
  created_by: string;
  organization_id: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  type: 'service' | 'product' | 'milestone' | 'retainer' | 'expense';
  category?: string;
  tax_rate?: number;
  discount_rate?: number;
  
  // For milestone-based items
  milestone?: {
    id: string;
    title: string;
    due_date?: string;
    completed_at?: string;
  };
  
  // For retainer items
  retainer_period?: {
    start_date: string;
    end_date: string;
    hours_included?: number;
  };
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'standard' | 'milestone' | 'retainer' | 'custom';
  schema: Partial<InvoiceSchema>;
  default_settings: {
    currency: string;
    payment_terms_days: number;
    tax_rate?: number;
    auto_reminders: boolean;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceGenerationConfig {
  // Invoice Number Generation
  invoice_number: {
    prefix: string;
    format: string; // e.g., "CD-INV-{seq:3}/{year:2}"
    separator: string;
    reset_frequency: 'monthly' | 'yearly' | 'never';
  };
  
  // Due Date Calculation
  due_date: {
    default_days: number;
    business_days_only: boolean;
    custom_rules?: {
      client_type?: string;
      project_type?: string;
      days: number;
    }[];
  };
  
  // Tax Calculation
  tax: {
    default_rate?: number;
    tax_rules?: {
      client_location?: string;
      service_type?: string;
      rate: number;
    }[];
  };
  
  // Automation Settings
  automation: {
    auto_generate_on_project_create: boolean;
    auto_generate_on_milestone_complete: boolean;
    auto_send_invoice: boolean;
    auto_reminders: {
      enabled: boolean;
      schedule: number[]; // days before due
    };
  };
}

export interface InvoiceAnalytics {
  total_invoices: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  overdue_amount: number;
  average_payment_time: number; // days
  invoices_by_status: Record<string, number>;
  invoices_by_month: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
  top_clients: Array<{
    client_id: string;
    client_name: string;
    total_invoices: number;
    total_amount: number;
  }>;
}
