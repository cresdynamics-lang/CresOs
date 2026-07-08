export type FinanceAssistantMode = "execute" | "intelligence";

export type FinanceProposedActionKind = "create_expense" | "create_payment";

export type FinanceProposedAction = {
  id: string;
  kind: FinanceProposedActionKind;
  title: string;
  amount?: number | null;
  currency?: string | null;
  category?: string | null;
  method?: string | null;
  beneficiaryHint?: string | null;
  projectHint?: string | null;
  invoiceHint?: string | null;
  spentAt?: string | null;
  receivedAt?: string | null;
  source?: string | null;
  transactionCode?: string | null;
  account?: string | null;
  notes?: string | null;
  impactPreview?: FinanceActionImpactPreview;
};

export type FinanceActionImpactPreview = {
  projectName?: string;
  projectReceivedBefore?: number;
  projectReceivedAfter?: number;
  invoiceNumber?: string;
  invoiceTotal?: number;
  invoicePaidBefore?: number;
  invoicePaidAfter?: number;
  invoiceRemainingBefore?: number;
  invoiceRemainingAfter?: number;
};

export type FinanceAssistantResponse = {
  mode: FinanceAssistantMode;
  reply: string;
  aiGenerated: boolean;
  transcript?: string;
  sessionId?: string;
  proposedActions?: FinanceProposedAction[];
};

export type FinanceExecutedAction = {
  actionId: string;
  kind: FinanceProposedActionKind;
  success: boolean;
  error?: string;
  candidates?: { id: string; label: string }[];
  expenseId?: string;
  paymentId?: string;
  resolvedBeneficiary?: string;
  resolvedProject?: string;
};

export type FinanceExecuteResponse = {
  results: FinanceExecutedAction[];
  succeeded: number;
  failed: number;
  sessionId?: string;
};

export const EXPENSE_CATEGORIES = [
  "salaries",
  "transport",
  "tools",
  "developer_payment",
  "apis",
  "hostings",
  "domains",
  "renewals",
  "apis_per_project",
  "other"
] as const;

export const PAYMENT_METHODS = ["bank", "card", "mpesa", "cash"] as const;
