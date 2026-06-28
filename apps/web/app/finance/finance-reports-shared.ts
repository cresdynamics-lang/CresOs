export type ReportPreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_6_months"
  | "this_year"
  | "last_year"
  | "all_time"
  | "custom";

export const REPORT_PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom range" }
];

/** Maps every finance workspace feature to its role in the money flow. */
export const FINANCE_FEATURE_MAP = [
  {
    area: "Payments",
    route: "/finance/payments",
    direction: "In",
    handledBy: "Finance",
    description: "Client revenue — confirmed invoice payments. Auto receipt email to client with project progress."
  },
  {
    area: "Expenses — Salaries",
    route: "/finance/expenses",
    direction: "Out",
    handledBy: "HR / Finance",
    description: "Payroll and staff salaries recorded as expense category salaries. Receipt to beneficiary; admin approval."
  },
  {
    area: "Expenses — Developer payments",
    route: "/finance/expenses",
    direction: "Out",
    handledBy: "Finance / Projects",
    description: "Project delivery payments to developers. Category developer_payment; tied to project ops."
  },
  {
    area: "Expenses — Ops & tools",
    route: "/finance/expenses",
    direction: "Out",
    handledBy: "Finance",
    description: "Transport, tools, APIs, hosting, domains, renewals — general business outflows."
  },
  {
    area: "Invoices",
    route: "/finance/invoices",
    direction: "AR",
    handledBy: "Finance / Sales",
    description: "Bill clients; links to projects. Drives expected revenue before payment is confirmed."
  },
  {
    area: "All transactions",
    route: "/finance/ledger",
    direction: "Both",
    handledBy: "Finance",
    description: "Unified ledger — every payment in, expense out, and payout in one chronological feed."
  },
  {
    area: "Projects status",
    route: "/finance/projects",
    direction: "Tracking",
    handledBy: "Finance",
    description: "Allocated vs received per approved project; reconcile with bank reality."
  },
  {
    area: "Clients due",
    route: "/finance/clients-due",
    direction: "AR",
    handledBy: "Finance",
    description: "Outstanding balances and reminder schedule per client."
  },
  {
    area: "Approvals",
    route: "/approvals",
    direction: "Governance",
    handledBy: "Admin / Finance",
    description: "Pending expenses, payouts, and finance items awaiting sign-off."
  },
  {
    area: "Finance mail",
    route: "/finance/messages",
    direction: "Comms",
    handledBy: "Finance",
    description: "Outbound finance emails to clients and internal recipients; audit trail."
  },
  {
    area: "Reports",
    route: "/finance/reports",
    direction: "Insights",
    handledBy: "Finance → Admin",
    description: "Period summaries (weekly, monthly, 6 months, yearly, custom). Download PDF/CSV or email admins."
  }
] as const;

export type FinancialReportResponse = {
  generatedAt: string;
  period: {
    startOfMonth: string;
    endOfMonth: string;
    monthEndExclusive?: string;
    preset?: string;
    label?: string;
  };
  revenue: { thisMonth: number; allTime: number };
  expenses: { thisMonth: number; allTime: number };
  salaries?: { inPeriod: number; count: number };
  developerPayments?: { inPeriod: number; count: number };
  expensesByCategory?: { category: string; amount: number; count: number }[];
  invoices: {
    outstandingAmount: number;
    openInvoiceRemaining?: number;
    overdueCount: number;
    byStatus: { status: string; count: number }[];
  };
  projects?: {
    approvedCount: number;
    totalContractValue: number;
    totalReceived: number;
    totalRemaining: number;
  };
  payouts: { pendingAmount: number; paidThisMonth?: number; paidAllTime?: number };
  cashFlow: {
    revenueThisMonth: number;
    expensesThisMonth: number;
    payoutsThisMonth?: number;
    totalOutflowsThisMonth?: number;
    netThisMonth: number;
  };
  derived?: {
    netCashMovementThisMonth: number;
    netCashMovementAllTime: number;
  };
  pending?: {
    approvalQueue: number;
    paymentsPending: number;
    total: number;
  };
};

export function reportQueryString(preset: ReportPreset, from?: string, to?: string): string {
  const params = new URLSearchParams({ period: preset });
  if (preset === "custom" && from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  return params.toString();
}

export function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    salaries: "Salaries (HR / payroll)",
    developer_payment: "Developer payment (project delivery)",
    apis_per_project: "APIs per project"
  };
  return map[c] ?? c.replace(/_/g, " ");
}
