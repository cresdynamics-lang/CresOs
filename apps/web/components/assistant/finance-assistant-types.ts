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

export type FinanceProposedAction = {
  id: string;
  kind: "create_expense" | "create_payment";
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

export type FinanceAssistantResponse = {
  mode: "execute" | "intelligence";
  reply: string;
  aiGenerated: boolean;
  transcript?: string;
  sessionId?: string;
  proposedActions?: FinanceProposedAction[];
};

export type FinanceExecutedAction = {
  actionId: string;
  kind: FinanceProposedAction["kind"];
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

export type FinanceAssistantSessionRow = {
  id: string;
  mode: string;
  message: string;
  reply: string | null;
  aiGenerated: boolean;
  createdAt: string;
  user?: { id: string; name: string | null; email: string };
};

export const FINANCE_EXECUTE_PROMPTS = [
  "Record 5000 KES transport for Wilson yesterday",
  "Client paid 120000 KES via M-Pesa for invoice 1042 today",
  "Log 15000 developer payment to Wilson for Acme project"
];

export const FINANCE_INTELLIGENCE_PROMPTS = [
  "Summarize expenses this month",
  "Which invoices are still unpaid?",
  "Total payments received in the last 30 days"
];

function fmtKes(n: number | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString()} KES`;
}

export function formatFinanceImpactPreview(preview: FinanceActionImpactPreview): string[] {
  const lines: string[] = [];
  if (preview.invoiceNumber) {
    lines.push(
      `Invoice ${preview.invoiceNumber}: paid ${fmtKes(preview.invoicePaidBefore)} → ${fmtKes(preview.invoicePaidAfter)} of ${fmtKes(preview.invoiceTotal)}`
    );
    if (preview.invoiceRemainingAfter != null) {
      lines.push(`Remaining after record: ${fmtKes(preview.invoiceRemainingAfter)}`);
    }
  }
  if (preview.projectName) {
    lines.push(
      `Project ${preview.projectName}: received ${fmtKes(preview.projectReceivedBefore)} → ${fmtKes(preview.projectReceivedAfter)}`
    );
  }
  return lines;
}
