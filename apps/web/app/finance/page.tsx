"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../data-refresh";
import { formatMoney } from "../format-money";
import { DashboardCardRow, DashboardScrollCard } from "../../components/dashboard-card-row";
import { FinanceStatInline, FinanceStatRow, FinanceFlatTable, FinanceFlatTableHead, FinanceFlatTableBody, FinanceFlatTableRow, FinanceFlatTh, FinanceFlatTd, FinanceStatusLabel, FinanceTextAction } from "../../components/finance/finance-ui";
import { financeNeu } from "../../components/finance/finance-theme";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { FINANCE_PAGE_TITLES, type FinanceSection } from "./finance-nav";
import { InvoiceCreateModal } from "./invoice-create-modal";
import { PaymentCreateModal, type PaymentFormState } from "./payment-create-modal";
import { WorkspaceLiveAnalytics } from "../../components/analytics/workspace-live-analytics";

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalAmount: number;
  projectId: string | null;
  clientId?: string;
  project: { id: string; name: string } | null;
  client?: { id: string; name: string; email?: string | null } | null;
};

type Expense = {
  id: string;
  category: string;
  description: string | null;
  notes: string | null;
  source: string | null;
  transactionCode: string | null;
  account: string | null;
  paymentMethod: string | null;
  amount: number;
  spentAt: string;
  status: string;
  beneficiaryUserId?: string | null;
  beneficiary?: { id: string; name: string | null; email: string } | null;
  expenseSubtype?: string | null;
  purposeCode?: string | null;
  purposeDetail?: string | null;
  toolOrServiceName?: string | null;
  subscriptionValidUntil?: string | null;
  developerAcknowledgedAt?: string | null;
  developerAcknowledgedById?: string | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  notes: string | null;
  source: string | null;
  account: string | null;
  reference: string | null;
  howToProceed: string | null;
  receivedAt: string;
  status: string;
  invoiceId: string | null;
  invoice?: {
    number?: string;
    projectId?: string | null;
    project: { id: string; name: string } | null;
    client?: { id: string; name: string; email?: string | null } | null;
  } | null;
};

type ClientDue = {
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  amountDue: number;
  reminderDayOfMonth: number | null;
  lastReminderAt: string | null;
};

function localDatetimeValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inferPaymentMethod(account: string, source: string): string {
  const text = `${account} ${source}`.toLowerCase();
  if (text.includes("mpesa") || text.includes("m-pesa")) return "mpesa";
  if (text.includes("cash")) return "cash";
  if (text.includes("card")) return "card";
  return "bank";
}

function defaultPaymentForm(): PaymentFormState {
  return {
    projectId: "",
    clientId: "",
    invoiceId: "",
    amount: "",
    source: "",
    account: "",
    reference: "",
    receivedAt: localDatetimeValue()
  };
}

const EXPENSE_CATEGORIES = [
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

const PURPOSE_CODES = [
  { value: "meeting_client", label: "Client meeting" },
  { value: "internal_team", label: "Internal / team" },
  { value: "developer_work", label: "Developer / delivery work" },
  { value: "sales_visit", label: "Sales visit" },
  { value: "other", label: "Other" }
] as const;

type ProjectFinancial = {
  id: string;
  name: string;
  status: string;
  allocated: number | null;
  received: number;
  remaining: number | null;
  managementMonthlyAmount: number | null;
  managementMonths: number | null;
};

type FinancialReport = {
  generatedAt: string;
  period: { startOfMonth: string; endOfMonth: string; monthEndExclusive?: string };
  revenue: { thisMonth: number; allTime: number };
  invoices: {
    outstandingAmount: number;
    /** Unpaid balance on open invoices (sent / partial / overdue), net of confirmed payments. */
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
  expenses: { thisMonth: number; allTime: number };
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

type LedgerRow = {
  kind: string;
  id: string;
  at: string;
  amount: number;
  currency: string;
  direction: "in" | "out";
  status: string;
  label: string;
  detail: string | null;
};

const FINANCE_ALIGNMENT_RULES = [
  {
    title: "Business bank account only",
    subtitle: "No mixing with personal money.",
    body: "Use a separate business bank account for every client payment and every business expense. This creates a clean audit trail so directors, investors, and accountants can see exactly what happened."
  },
  {
    title: "Monthly bank reconciliation",
    subtitle: "Thirty minutes that protects the business.",
    body: "At the end of each month, match your bank statement against CresOS records (money in, money out). You should be able to tick off every line with an invoice or receipt attached."
  },
  {
    title: "Monthly income statement",
    subtitle: "Revenue – expenses = profit.",
    body: "Once a month, summarise total money in vs total money out. Directors and Finance should always know whether the business is actually profitable or just moving cash."
  },
  {
    title: "Simple balance sheet",
    subtitle: "What you own minus what you owe.",
    body: "Keep a running list of assets (cash, receivables, equipment) and liabilities (loans, vendor debt). Review net worth trend monthly so you’re always bank- and investor-ready."
  },
  {
    title: "Complete tax records",
    subtitle: "Every invoice, every receipt, stored.",
    body: "Keep digital copies of all invoices sent and receipts for expenses. When tax time or an audit comes, you can prove every shilling and move fast without panic."
  }
] as const;


function pathnameToSection(pathname: string): FinanceSection {
  if (pathname === "/finance" || pathname === "/finance/") return "overview";
  if (pathname.startsWith("/finance/invoices")) return "invoices";
  if (pathname.startsWith("/finance/payments")) return "payments";
  if (pathname.startsWith("/finance/expenses")) return "expenses";
  if (pathname.startsWith("/finance/ledger")) return "ledger";
  if (pathname.startsWith("/finance/projects/analysis")) return "project_analysis";
  if (pathname.startsWith("/finance/projects")) return "projects";
  if (pathname.startsWith("/finance/clients-due")) return "clients_due";
  return "overview";
}

export default function FinancePage() {
  const router = useRouter();
  const pathname = usePathname();
  const section = pathnameToSection(pathname);
  const { apiFetch, auth, hydrated } = useAuth();
  const canAccessFinance = auth.roleKeys.some((r) =>
    ["admin", "finance", "analyst", "director_admin"].includes(r)
  );

  const downloadWithAuth = useCallback(
    async (path: string, fallbackFilename: string) => {
      try {
        const res = await apiFetch(path, { method: "GET" });
        if (!res.ok) return;

        const cd = res.headers.get("content-disposition") ?? "";
        const match = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)"?/i);
        const filename = (match?.[1] ? decodeURIComponent(match[1]) : fallbackFilename) || fallbackFilename;

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessFinance) {
      router.replace("/dashboard");
    }
  }, [hydrated, auth.accessToken, canAccessFinance, router]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clientsDue, setClientsDue] = useState<ClientDue[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancial[]>([]);
  const [expenseOrgUsers, setExpenseOrgUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectMoneyDraft, setProjectMoneyDraft] = useState<{
    allocated: string;
    received: string;
    managementMonthlyAmount: string;
    managementMonths: string;
  }>({ allocated: "", received: "", managementMonthlyAmount: "", managementMonths: "" });
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [expenseForm, setExpenseForm] = useState<{
    category: string;
    description: string;
    notes: string;
    amount: string;
    spentAt: string;
    source: string;
    transactionCode: string;
    account: string;
    paymentMethod: string;
    beneficiaryUserId: string;
    expenseSubtype: string;
    purposeCode: string;
    purposeDetail: string;
    toolOrServiceName: string;
    subscriptionValidUntil: string;
  }>({
    category: "other",
    description: "",
    notes: "",
    amount: "",
    spentAt: new Date().toISOString().slice(0, 10),
    source: "",
    transactionCode: "",
    account: "",
    paymentMethod: "bank",
    beneficiaryUserId: "",
    expenseSubtype: "",
    purposeCode: "",
    purposeDetail: "",
    toolOrServiceName: "",
    subscriptionValidUntil: ""
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState<{
    category: string;
    description: string;
    notes: string;
    amount: string;
    spentAt: string;
    source: string;
    transactionCode: string;
    account: string;
    paymentMethod: string;
    beneficiaryUserId: string;
    expenseSubtype: string;
    purposeCode: string;
    purposeDetail: string;
    toolOrServiceName: string;
    subscriptionValidUntil: string;
  } | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(defaultPaymentForm);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalMode, setPaymentModalMode] = useState<"create" | "edit">("create");
  const [reminderDayEdit, setReminderDayEdit] = useState<{ clientId: string; day: number | null } | null>(null);
  /** Expense/payout entity ids that have a pending Approval row (from DB). */
  const [pendingApprovalIds, setPendingApprovalIds] = useState<Set<string>>(new Set());
  /** Count of pending expense/payout approval rows — matches DB & header. */
  const [pendingFinanceApprovalCount, setPendingFinanceApprovalCount] = useState(0);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<
    { id: string; name: string; clientId?: string | null; client?: { id: string; name: string } | null }[]
  >([]);
  type InvoiceLineForm = { id: string; description: string; quantity: string; unitPrice: string };

  const emptyInvoiceLine = (): InvoiceLineForm => ({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `l-${Date.now()}-${Math.random()}`,
    description: "",
    quantity: "1",
    unitPrice: ""
  });

  const [invoiceForm, setInvoiceForm] = useState<{
    clientId: string;
    projectId: string;
    issueDate: string;
    dueDate: string;
    lines: InvoiceLineForm[];
    notes: string;
  }>({
    clientId: "",
    projectId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    lines: [emptyInvoiceLine()],
    notes: ""
  });
  const [invoiceSubmitError, setInvoiceSubmitError] = useState<string | null>(null);

  /** Aggregate money KPIs & reports — Finance and Admin only (not Director). */
  const canSeeMoneyStats =
    auth.canSeeFinance === true ||
    auth.roleKeys.some((r) => ["finance", "admin"].includes(r));
  // Only Finance role can perform actions; Director/Admin see read-only
  const isFinance = auth.roleKeys.includes("finance");
  const isAdmin = auth.roleKeys.includes("admin");
  const canRecordPayments = isFinance || isAdmin;
  const isDirector = auth.roleKeys.includes("director_admin");
  const canCreateInvoice = isFinance || isAdmin;
  const canEditProjectMoney = isFinance || isAdmin || isDirector;
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const projectFinanceAnalysis = useMemo(() => {
    const allocated = projectFinancials.reduce((s, p) => s + (p.allocated ?? 0), 0);
    const received = projectFinancials.reduce((s, p) => s + (p.received ?? 0), 0);
    const remaining = projectFinancials.reduce((s, p) => s + (p.remaining ?? 0), 0);
    const mgmtTotal = projectFinancials.reduce((s, p) => {
      if (p.managementMonthlyAmount == null || p.managementMonths == null) return s;
      return s + p.managementMonthlyAmount * p.managementMonths;
    }, 0);
    return {
      allocated,
      received,
      remaining,
      managementExpectedTotal: mgmtTotal,
      activeApprovedProjects: projectFinancials.length
    };
  }, [projectFinancials]);

  const fetchReport = useCallback(async () => {
    if (!canAccessFinance || !canSeeMoneyStats) return;
    setReportLoading(true);
    try {
      const res = await apiFetch("/finance/report");
      if (res.ok) {
        const data = (await res.json()) as FinancialReport;
        setReport(data);
      }
    } catch {
      // ignore
    } finally {
      setReportLoading(false);
    }
  }, [canSeeMoneyStats, apiFetch, canAccessFinance]);

  const loadLedger = useCallback(async () => {
    if (!canAccessFinance || !canSeeMoneyStats) return;
    setLedgerLoading(true);
    try {
      const res = await apiFetch("/finance/ledger?limit=250");
      if (res.ok) {
        const data = (await res.json()) as { rows?: LedgerRow[] };
        setLedgerRows(Array.isArray(data.rows) ? data.rows : []);
      }
    } catch {
      setLedgerRows([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [canAccessFinance, canSeeMoneyStats, apiFetch]);

  const loadData = useCallback(async () => {
    if (!canAccessFinance) return;
    try {
      const [invRes, payRes, expRes, dueRes] = await Promise.all([
        apiFetch("/finance/invoices"),
        apiFetch("/finance/payments"),
        apiFetch("/finance/expenses"),
        canSeeMoneyStats ? apiFetch("/finance/clients/due") : Promise.resolve(null)
      ]);
      if (invRes.ok) {
        const data = (await invRes.json()) as any[];
          setInvoices(
            data.map((inv) => ({
              id: inv.id,
              number: inv.number,
              status: inv.status,
              totalAmount: inv.totalAmount ? Number(inv.totalAmount) : 0,
              projectId: inv.projectId ?? null,
              project: inv.project ?? null,
              clientId: inv.clientId ?? inv.client?.id,
              client: inv.client ?? null
            }))
          );
      }
      if (payRes.ok) {
        const data = (await payRes.json()) as any[];
        setPayments(
          data.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method ?? "",
            notes: p.notes ?? null,
            source: p.source ?? null,
            account: p.account ?? null,
            reference: p.reference ?? null,
            howToProceed: p.howToProceed ?? null,
            receivedAt: p.receivedAt,
            status: p.status ?? "pending",
            invoiceId: p.invoiceId ?? null,
            invoice: p.invoice
              ? {
                  number: p.invoice.number ?? undefined,
                  projectId: p.invoice.projectId ?? p.invoice.project?.id ?? null,
                  project: p.invoice.project ?? null,
                  client: p.invoice.client ?? p.invoice.project?.client ?? null
                }
              : null
          }))
        );
      }
      if (expRes.ok) {
        const data = (await expRes.json()) as any[];
        setExpenses(
          data.map((exp) => ({
            id: exp.id,
            category: exp.category,
            description: exp.description ?? null,
            notes: exp.notes ?? null,
            source: exp.source ?? null,
            transactionCode: exp.transactionCode ?? null,
            account: exp.account ?? null,
            paymentMethod: exp.paymentMethod ?? null,
            amount: Number(exp.amount),
            spentAt: exp.spentAt,
            status: exp.status ?? "pending",
            beneficiaryUserId: exp.beneficiaryUserId ?? null,
            beneficiary: exp.beneficiary ?? null,
            expenseSubtype: exp.expenseSubtype ?? null,
            purposeCode: exp.purposeCode ?? null,
            purposeDetail: exp.purposeDetail ?? null,
            toolOrServiceName: exp.toolOrServiceName ?? null,
            subscriptionValidUntil: exp.subscriptionValidUntil ?? null,
            developerAcknowledgedAt: exp.developerAcknowledgedAt ?? null,
            developerAcknowledgedById: exp.developerAcknowledgedById ?? null
          }))
        );
      }
      if (isFinance || isAdmin || isDirector) {
        const ctxRes = await apiFetch("/finance/expense-context");
        if (ctxRes.ok) {
          const ctx = (await ctxRes.json()) as { users?: { id: string; name: string | null; email: string }[] };
          setExpenseOrgUsers(ctx.users ?? []);
        }
      }
      if (dueRes?.ok) {
        const data = (await dueRes.json()) as ClientDue[];
        setClientsDue(data);
      }
      const projRes = await apiFetch("/finance/projects");
      if (projRes.ok) {
        const projData = (await projRes.json()) as ProjectFinancial[];
        setProjectFinancials(projData);
      }
      const appRes = await apiFetch("/finance/approvals");
      if (appRes.ok) {
        const appData = (await appRes.json()) as { entityType: string; entityId: string; status: string }[];
        const pendingRows = appData.filter(
          (a) => a.status === "pending" && (a.entityType === "expense" || a.entityType === "payout")
        );
        setPendingFinanceApprovalCount(pendingRows.length);
        setPendingApprovalIds(new Set(pendingRows.map((a) => a.entityId)));
      }
      if (canCreateInvoice || canRecordPayments) {
        const [clientsRes, projectsRes] = await Promise.all([
          apiFetch("/crm/clients"),
          apiFetch("/projects")
        ]);
        if (clientsRes.ok) {
          const clientsData = (await clientsRes.json()) as { id: string; name: string }[];
          setClients(clientsData);
        }
        if (projectsRes.ok) {
          const projectsData = (await projectsRes.json()) as {
            id: string;
            name: string;
            clientId?: string | null;
            client?: { id: string; name: string } | null;
          }[];
          setProjects(projectsData);
        }
      }
    } catch {
      // ignore
    }
  }, [apiFetch, canSeeMoneyStats, canCreateInvoice, canRecordPayments, canAccessFinance, isFinance, isAdmin, isDirector]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canSeeMoneyStats) return;
    void fetchReport();
  }, [canSeeMoneyStats, fetchReport]);

  useEffect(() => {
    const onLedger =
      section === "ledger";
    if (!onLedger || !canSeeMoneyStats) return;
    void loadLedger();
  }, [section, canSeeMoneyStats, loadLedger]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadData();
        if (canSeeMoneyStats) void fetchReport();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => {
      void loadData();
      if (canSeeMoneyStats) void fetchReport();
      if (
        canSeeMoneyStats &&
        (section === "ledger")
      ) {
        void loadLedger();
      }
    });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [
    loadData,
    fetchReport,
    canSeeMoneyStats,
    loadLedger,
    section
  ]);

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.spentAt) return;
    try {
      const res = await apiFetch("/finance/expenses", {
        method: "POST",
        body: JSON.stringify({
          category: expenseForm.category,
          description: expenseForm.description || undefined,
          notes: expenseForm.notes || undefined,
          amount: expenseForm.amount,
          spentAt: expenseForm.spentAt,
          source: expenseForm.source || undefined,
          transactionCode: expenseForm.transactionCode || undefined,
          account: expenseForm.account || undefined,
          paymentMethod: expenseForm.paymentMethod || undefined,
          beneficiaryUserId: expenseForm.beneficiaryUserId || undefined,
          expenseSubtype: expenseForm.expenseSubtype || undefined,
          purposeCode: expenseForm.purposeCode || undefined,
          purposeDetail: expenseForm.purposeDetail || undefined,
          toolOrServiceName: expenseForm.toolOrServiceName || undefined,
          subscriptionValidUntil: expenseForm.subscriptionValidUntil || undefined
        })
      });
      if (res.ok) {
        setExpenseForm((f) => ({
          ...f,
          description: "",
          notes: "",
          amount: "",
          source: "",
          transactionCode: "",
          account: "",
          beneficiaryUserId: "",
          expenseSubtype: "",
          purposeCode: "",
          purposeDetail: "",
          toolOrServiceName: "",
          subscriptionValidUntil: ""
        }));
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const startEditExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setEditExpenseForm({
      category: exp.category ?? "other",
      description: exp.description ?? "",
      notes: exp.notes ?? "",
      amount: String(exp.amount ?? ""),
      spentAt: exp.spentAt ? String(exp.spentAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
      source: exp.source ?? "",
      transactionCode: exp.transactionCode ?? "",
      account: exp.account ?? "",
      paymentMethod: exp.paymentMethod ?? "bank",
      beneficiaryUserId: exp.beneficiaryUserId ?? "",
      expenseSubtype: exp.expenseSubtype ?? "",
      purposeCode: exp.purposeCode ?? "",
      purposeDetail: exp.purposeDetail ?? "",
      toolOrServiceName: exp.toolOrServiceName ?? "",
      subscriptionValidUntil: exp.subscriptionValidUntil
        ? String(exp.subscriptionValidUntil).slice(0, 10)
        : ""
    });
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);
    setEditExpenseForm(null);
  };

  const saveEditExpense = async () => {
    if (!editingExpenseId || !editExpenseForm) return;
    try {
      const res = await apiFetch(`/finance/expenses/${editingExpenseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          category: editExpenseForm.category,
          description: editExpenseForm.description || undefined,
          notes: editExpenseForm.notes || undefined,
          amount: editExpenseForm.amount,
          spentAt: editExpenseForm.spentAt,
          source: editExpenseForm.source || undefined,
          transactionCode: editExpenseForm.transactionCode || undefined,
          account: editExpenseForm.account || undefined,
          paymentMethod: editExpenseForm.paymentMethod || undefined,
          currency: "KES",
          beneficiaryUserId: editExpenseForm.beneficiaryUserId || null,
          expenseSubtype: editExpenseForm.expenseSubtype || undefined,
          purposeCode: editExpenseForm.purposeCode || undefined,
          purposeDetail: editExpenseForm.purposeDetail || undefined,
          toolOrServiceName: editExpenseForm.toolOrServiceName || undefined,
          subscriptionValidUntil: editExpenseForm.subscriptionValidUntil || undefined
        })
      });
      if (res.ok) {
        cancelEditExpense();
        await loadData();
        if (canSeeMoneyStats) await fetchReport();
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm("Delete this pending expense?")) return;
    try {
      const res = await apiFetch(`/finance/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
        if (canSeeMoneyStats) await fetchReport();
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  };

  const startEditProjectMoney = (p: ProjectFinancial) => {
    setEditingProjectId(p.id);
    setProjectMoneyDraft({
      allocated: p.allocated != null ? String(p.allocated) : "",
      received: String(p.received ?? ""),
      managementMonthlyAmount: p.managementMonthlyAmount != null ? String(p.managementMonthlyAmount) : "",
      managementMonths: p.managementMonths != null ? String(p.managementMonths) : ""
    });
  };

  const cancelEditProjectMoney = () => {
    setEditingProjectId(null);
  };

  const saveProjectMoney = async () => {
    if (!editingProjectId) return;
    try {
      const body: Record<string, string | number | null> = {};
      if (projectMoneyDraft.allocated.trim() !== "") {
        body.price = Number(projectMoneyDraft.allocated);
      } else {
        body.price = null;
      }
      if (projectMoneyDraft.received.trim() !== "") {
        body.amountReceived = Number(projectMoneyDraft.received);
      }
      if (projectMoneyDraft.managementMonthlyAmount.trim() !== "") {
        body.managementMonthlyAmount = Number(projectMoneyDraft.managementMonthlyAmount);
      } else {
        body.managementMonthlyAmount = null;
      }
      if (projectMoneyDraft.managementMonths.trim() !== "") {
        body.managementMonths = Number(projectMoneyDraft.managementMonths);
      } else {
        body.managementMonths = null;
      }
      const res = await apiFetch(`/finance/projects/${editingProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        cancelEditProjectMoney();
        await loadData();
        if (canSeeMoneyStats) await fetchReport();
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  };

  const saveReminderDay = async (clientId: string, day: number | null) => {
    try {
      const res = await apiFetch(`/finance/clients/${clientId}/reminder`, {
        method: "PATCH",
        body: JSON.stringify({ reminderDayOfMonth: day })
      });
      if (res.ok) {
        setReminderDayEdit(null);
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const sendRemindersToday = async () => {
    try {
      await apiFetch("/finance/reminders/send", { method: "POST" });
      loadData();
    } catch {
      // ignore
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSubmitError(null);
    setPaymentNotice(null);
    const source = paymentForm.source.trim();
    const account = paymentForm.account.trim();
    const reference = paymentForm.reference.trim();
    if (!paymentForm.amount || !paymentForm.receivedAt || !paymentForm.invoiceId || !paymentForm.clientId) return;
    if (!source || !account || !reference) {
      setPaymentSubmitError("Received from, account, and transaction reference are required.");
      return;
    }
    const method = inferPaymentMethod(account, source);
    const payload = {
      method,
      amount: paymentForm.amount,
      currency: "KES",
      receivedAt: paymentForm.receivedAt,
      source,
      account,
      reference,
      invoiceId: paymentForm.invoiceId,
      projectId: paymentForm.projectId,
      mpesaRef: method === "mpesa" ? reference : undefined,
      confirm: true
    };
    try {
      const res = paymentForm.paymentId
        ? await apiFetch(`/finance/payments/${paymentForm.paymentId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          })
        : await apiFetch("/finance/payments", {
            method: "POST",
            body: JSON.stringify(payload)
          });
      const raw = (await res.json().catch(() => null)) as {
        payment?: { id: string; status?: string };
        receiptEmail?: { sent?: boolean; to?: string; skipped?: boolean; reason?: string; error?: string };
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setPaymentSubmitError(raw?.message || raw?.error || `Could not save payment (${res.status}).`);
        return;
      }
      const isCreate = !paymentForm.paymentId;
      if (isCreate && raw?.receiptEmail?.sent && raw.receiptEmail.to) {
        setPaymentNotice(`Payment recorded. Receipt emailed to ${raw.receiptEmail.to}.`);
      } else if (isCreate && raw?.message) {
        setPaymentNotice(raw.message);
      }
      setPaymentForm(defaultPaymentForm());
      setShowPaymentModal(false);
      setPaymentModalMode("create");
      await loadData();
      if (canSeeMoneyStats) await fetchReport();
      emitDataRefresh();
    } catch {
      setPaymentSubmitError("Network error — payment may not have been saved.");
    }
  };

  const openEditPayment = (p: Payment) => {
    const projectId = p.invoice?.projectId ?? p.invoice?.project?.id ?? "";
    const clientId = p.invoice?.client?.id ?? "";
    setPaymentForm({
      paymentId: p.id,
      projectId,
      clientId,
      invoiceId: p.invoiceId ?? "",
      amount: String(p.amount),
      source: p.source ?? "",
      account: p.account ?? "",
      reference: p.reference ?? "",
      receivedAt: localDatetimeValue(new Date(p.receivedAt))
    });
    setPaymentSubmitError(null);
    setPaymentNotice(null);
    setPaymentModalMode("edit");
    setShowPaymentModal(true);
  };

  const deleteInvoice = async (id: string) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      const res = await apiFetch(`/finance/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
        if (canSeeMoneyStats) await fetchReport();
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  };

  const deletePayment = async (id: string) => {
    if (!window.confirm("Delete this pending payment?")) return;
    try {
      const res = await apiFetch(`/finance/payments/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
        if (canSeeMoneyStats) await fetchReport();
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  };

  const submitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceSubmitError(null);
    const items = invoiceForm.lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Math.max(1, parseInt(l.quantity, 10) || 1),
        unitPrice: l.unitPrice.trim()
      }))
      .filter((l) => l.description && l.unitPrice);
    if (!invoiceForm.clientId || !invoiceForm.projectId || !invoiceForm.issueDate) {
      setInvoiceSubmitError("Select client, project, and issue date.");
      return;
    }
    if (items.length === 0) {
      setInvoiceSubmitError("Add at least one line with description and unit price.");
      return;
    }
    try {
      const res = await apiFetch("/finance/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientId: invoiceForm.clientId,
          projectId: invoiceForm.projectId || undefined,
          issueDate: invoiceForm.issueDate,
          dueDate: invoiceForm.dueDate || undefined,
          currency: "KES",
          notes: invoiceForm.notes.trim() || undefined,
          items
        })
      });
      const j = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            message?: string;
            data?: { invoice?: { id?: string }; downloadUrl?: string };
          }
        | null;
      if (!res.ok) {
        setInvoiceSubmitError(
          j?.message || j?.error || `Could not create invoice (${res.status}).`
        );
        return;
      }
      const createdId = j?.data?.invoice?.id;
      const downloadUrl = j?.data?.downloadUrl ? String(j.data.downloadUrl) : null;
      if (downloadUrl) await downloadWithAuth(downloadUrl, `invoice-${createdId ?? "download"}.pdf`);
      else if (createdId) await downloadWithAuth(`/finance/invoices/${createdId}/pdf`, `invoice-${createdId}.pdf`);
      setInvoiceForm((f) => ({ ...f, lines: [emptyInvoiceLine()], notes: "" }));
      setInvoiceSubmitError(null);
      setShowInvoiceModal(false);
      loadData();
    } catch (err) {
      setInvoiceSubmitError(err instanceof Error ? err.message : "Network error creating invoice.");
    }
  };

  const submitForApproval = async (entityType: "expense" | "payout", entityId: string) => {
    try {
      const res = await apiFetch("/finance/approvals", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, reason: "Submitted for admin approval" })
      });
      if (res.ok) {
        await loadData();
        if (canSeeMoneyStats) await fetchReport();
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  };

  const categories = Array.from(
    new Set(expenses.map((e) => e.category).filter(Boolean))
  ).sort();
  const filteredExpenses =
    expenseCategoryFilter === "all"
      ? expenses
      : expenses.filter((e) => e.category === expenseCategoryFilter);
  const expensesTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const expensesApprovedInFilter = useMemo(
    () =>
      filteredExpenses
        .filter((e) => e.status === "approved" || e.status === "paid")
        .reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  const pageMeta = FINANCE_PAGE_TITLES[section];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-6">
      {section === "overview" ? (
        <WorkspaceDashboardIntro
          title={pageMeta.title}
          description={pageMeta.description}
          eyebrow="Finance"
          showWelcomeBanner
          welcomeChildren={
            <>
              <DashboardSectionLabel roleKeys={auth.roleKeys}>
                Today&apos;s priorities (your queue)
              </DashboardSectionLabel>
              <p className="font-body text-sm leading-relaxed text-slate-400">
                Use <span className="font-medium text-emerald-400/90">Finance mail</span> and the sections below for
                live data.
              </p>
            </>
          }
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="min-w-0">
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500/80">Finance</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">{pageMeta.title}</h1>
            {pageMeta.description ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{pageMeta.description}</p>
            ) : null}
          </div>
          {section === "invoices" && canCreateInvoice && (isFinance || isAdmin) && clients.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className={`${financeNeu.btnPrimary} min-h-[44px] shrink-0 touch-manipulation`}
            >
              New invoice
            </button>
          )}
          {section === "payments" && canRecordPayments && projects.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPaymentSubmitError(null);
    setPaymentNotice(null);
                setPaymentForm(defaultPaymentForm());
                setPaymentModalMode("create");
                setShowPaymentModal(true);
              }}
              className={`${financeNeu.btnPrimary} min-h-[44px] shrink-0 touch-manipulation`}
            >
              New payment
            </button>
          )}
        </div>
      )}


      {paymentNotice && section === "payments" ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {paymentNotice}
        </div>
      ) : null}

      {!canSeeMoneyStats && section === "overview" && (
        <div className="shell border border-slate-600/80 bg-slate-900/50 text-sm text-slate-400">
          Dashboard revenue, outstanding, and net-flow summaries are visible to{" "}
          <span className="font-medium text-slate-200">Finance</span> and{" "}
          <span className="font-medium text-slate-200">Admin</span> only. Other finance workspace features below still apply
          based on your role.
        </div>
      )}

      {canSeeMoneyStats && section === "overview" && (
        <FinanceStatRow>
          <FinanceStatInline
            label="Revenue (period)"
            value={report ? formatMoney(report.revenue.thisMonth) : reportLoading ? "…" : "—"}
            hint="Confirmed payments this month (UTC)"
            tone="emerald"
          />
          <FinanceStatInline
            label="Outstanding"
            value={report ? formatMoney(report.invoices.outstandingAmount) : reportLoading ? "…" : "—"}
            hint="Unpaid invoice / project balance"
            tone="amber"
          />
          <FinanceStatInline
            label="Net flow"
            value={report ? formatMoney(report.cashFlow.netThisMonth) : reportLoading ? "…" : "—"}
            hint="Inflows minus outflows (UTC month)"
            tone={!report ? "brand" : report.cashFlow.netThisMonth >= 0 ? "emerald" : "rose"}
          />
          <FinanceStatInline
            label="Pending requests"
            value={reportLoading ? "…" : report?.pending?.total ?? pendingFinanceApprovalCount}
            hint={
              report?.pending != null
                ? `${report.pending.approvalQueue} approvals · ${report.pending.paymentsPending} payments`
                : "Expense / payout queue"
            }
            tone="violet"
          />
        </FinanceStatRow>
      )}

      {canSeeMoneyStats && section === "overview" && (
        <WorkspaceLiveAnalytics
          variant={isAdmin ? "admin" : isDirector ? "director" : "finance"}
          className="border-b border-white/[0.06] pb-8"
        />
      )}

      {isAdmin && section === "overview" && (
        <div className="shell border border-slate-600/80 bg-slate-900/50">
          <h3 className="text-sm font-semibold text-slate-200">Admin&apos;s finance access rules</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-800/40 bg-slate-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Can see</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Approved and declined transaction history · Pending request amounts · Cash flow summary (including paid payouts) ·
                All-transactions ledger · Outstanding invoice totals against active projects
              </p>
            </div>
            <div className="rounded-lg border-l-4 border-rose-500/70 bg-slate-950/40 p-3 pl-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Limited</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Admin can record and confirm bank payments (with source, account, and transaction reference) and view the unified
                ledger. Admin cannot create or edit expenses, invoices, or invoice line items — that stays with Finance and Sales.
              </p>
            </div>
            <div className="rounded-lg border border-sky-800/40 bg-slate-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">How project pricing flows here</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                When Sales marks a project active or demo, its value feeds the revenue pipeline. Admin sees the aggregate — not the
                client breakdown.
              </p>
            </div>
          </div>
        </div>
      )}


      {canSeeMoneyStats &&
        (section === "ledger") && (
          <div className="shell border-slate-700/70 bg-slate-950/40">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                All transactions (ledger)
              </h3>
              <button
                type="button"
                onClick={() => void loadLedger()}
                disabled={ledgerLoading}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                {ledgerLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Newest first — payments (in), expenses and payouts (out). Pending payments and unapproved expenses appear with their
              current status.
            </p>
            <div className="max-h-[480px] overflow-auto rounded border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-900/95 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Direction</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="border-t border-slate-800/80">
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-400">
                        {new Date(row.at).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-slate-200">{row.label}</td>
                      <td
                        className={
                          row.direction === "in" ? "px-2 py-1.5 text-emerald-400" : "px-2 py-1.5 text-amber-300"
                        }
                      >
                        {row.direction === "in" ? "In" : "Out"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-100">
                        {formatMoney(row.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-400">{row.status}</td>
                      <td className="max-w-[240px] truncate px-2 py-1.5 text-xs text-slate-500" title={row.detail ?? ""}>
                        {row.detail ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ledgerLoading && ledgerRows.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No rows yet.</p>
              )}
            </div>
          </div>
        )}

      {canSeeMoneyStats && section === "overview" && (
        <div className="shell border-emerald-800/40 bg-slate-900/60">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Financial report (real-time)
            </h3>
            <button
              type="button"
              onClick={fetchReport}
              disabled={reportLoading}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {reportLoading ? "Loading…" : report ? "Refresh report" : "Load report"}
            </button>
          </div>
          {report && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Revenue</p>
                <p className="text-slate-200">This month: {formatMoney(report.revenue.thisMonth)}</p>
                <p className="text-xs text-slate-400">All time: {formatMoney(report.revenue.allTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Projects & AR</p>
                <p className="text-amber-400">
                  Remaining on approved projects: {formatMoney(report.invoices.outstandingAmount)}
                </p>
                {report.invoices.openInvoiceRemaining != null && (
                  <p className="text-xs text-slate-300">
                    Open invoice balance (unpaid): {formatMoney(report.invoices.openInvoiceRemaining)}
                  </p>
                )}
                {report.projects != null && (
                  <p className="text-xs text-slate-400">
                    {report.projects.approvedCount} approved · contract total{" "}
                    {formatMoney(report.projects.totalContractValue)} · collected{" "}
                    {formatMoney(report.projects.totalReceived)}
                  </p>
                )}
                <p className="text-xs text-slate-400">Overdue invoices: {report.invoices.overdueCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Expenses</p>
                <p className="text-slate-200">This month: {formatMoney(report.expenses.thisMonth)}</p>
                <p className="text-xs text-slate-400">All time: {formatMoney(report.expenses.allTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cash flow (month)</p>
                <p className="text-slate-200">In: {formatMoney(report.cashFlow.revenueThisMonth)}</p>
                <p className="text-slate-200">
                  Out (expenses): {formatMoney(report.cashFlow.expensesThisMonth)}
                  {report.cashFlow.payoutsThisMonth != null && report.cashFlow.payoutsThisMonth > 0 && (
                    <span className="text-slate-400">
                      {" "}
                      · payouts paid: {formatMoney(report.cashFlow.payoutsThisMonth)}
                    </span>
                  )}
                </p>
                {report.cashFlow.totalOutflowsThisMonth != null && (
                  <p className="text-xs text-slate-400">
                    Total out: {formatMoney(report.cashFlow.totalOutflowsThisMonth)}
                  </p>
                )}
                <p className={report.cashFlow.netThisMonth >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  Net: {formatMoney(report.cashFlow.netThisMonth)}
                </p>
                {report.derived != null && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    All-time movement: {formatMoney(report.derived.netCashMovementAllTime)} (confirmed in − approved expenses − paid
                    payouts)
                  </p>
                )}
              </div>
            </div>
          )}
          {report && (
            <p className="mt-3 text-xs text-slate-500">
              Generated {new Date(report.generatedAt).toLocaleString()} · Pending payouts:{" "}
              {formatMoney(report.payouts.pendingAmount)}
              {report.payouts.paidThisMonth != null ? ` · Paid this month: ${formatMoney(report.payouts.paidThisMonth)}` : ""}
            </p>
          )}
        </div>
      )}

      {canSeeMoneyStats && section === "projects" && projectFinancials.length > 0 && (
        <div className="shell border-sky-800/50">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Projects finance status
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Allocated (contract) vs received (paid so far) and pending (remaining). Finance, Director, and Admin can update
            amounts to match bank reality; confirmed invoice payments also roll into received automatically.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-2 pr-2">Project</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2 text-right">Allocated</th>
                  <th className="pb-2 pr-2 text-right">Received</th>
                  <th className="pb-2 pr-2 text-right">Pending</th>
                  <th className="pb-2 pr-2">Management</th>
                  {canEditProjectMoney && <th className="pb-2 pr-2">Edit</th>}
                </tr>
              </thead>
              <tbody>
                {projectFinancials.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800">
                    <td className="py-2 pr-2">
                      <a href={`/projects/${p.id}`} className="text-sky-400 hover:underline">
                        {p.name}
                      </a>
                    </td>
                    <td className="py-2 pr-2 capitalize text-slate-300">{p.status}</td>
                    <td className="py-2 pr-2 text-right text-slate-200">
                      {editingProjectId === p.id ? (
                        <input
                          type="number"
                          className="w-28 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-slate-100"
                          value={projectMoneyDraft.allocated}
                          onChange={(e) =>
                            setProjectMoneyDraft((d) => ({ ...d, allocated: e.target.value }))
                          }
                        />
                      ) : p.allocated != null ? (
                        formatMoney(p.allocated)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right text-emerald-400">
                      {editingProjectId === p.id ? (
                        <input
                          type="number"
                          className="w-28 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-emerald-200"
                          value={projectMoneyDraft.received}
                          onChange={(e) =>
                            setProjectMoneyDraft((d) => ({ ...d, received: e.target.value }))
                          }
                        />
                      ) : (
                        formatMoney(p.received)
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right text-amber-400">
                      {p.remaining != null ? formatMoney(p.remaining) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-slate-300">
                      {editingProjectId === p.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            placeholder="/ month"
                            className="w-32 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-100"
                            value={projectMoneyDraft.managementMonthlyAmount}
                            onChange={(e) =>
                              setProjectMoneyDraft((d) => ({
                                ...d,
                                managementMonthlyAmount: e.target.value
                              }))
                            }
                          />
                          <input
                            type="number"
                            placeholder="months"
                            className="w-24 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-100"
                            value={projectMoneyDraft.managementMonths}
                            onChange={(e) =>
                              setProjectMoneyDraft((d) => ({ ...d, managementMonths: e.target.value }))
                            }
                          />
                        </div>
                      ) : p.managementMonthlyAmount != null && p.managementMonths != null ? (
                        <span>
                          {formatMoney(p.managementMonthlyAmount)}/month for {p.managementMonths} month
                          {p.managementMonths !== 1 ? "s" : ""}
                          {p.managementMonths > 0 && (
                            <span className="ml-1 text-xs text-slate-500">
                              (total {formatMoney(p.managementMonthlyAmount * p.managementMonths)})
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canEditProjectMoney && (
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {editingProjectId === p.id ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => void saveProjectMoney()}
                              className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white hover:bg-emerald-600"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditProjectMoney}
                              className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditProjectMoney(p)}
                            className="rounded border border-sky-600 px-2 py-0.5 text-xs text-sky-300 hover:bg-sky-950/60"
                          >
                            Update money
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canSeeMoneyStats && section === "project_analysis" && (
        <div className="shell border border-slate-700/70 bg-slate-900/50">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Project finance analysis
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Approved projects tracked</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">{projectFinanceAnalysis.activeApprovedProjects}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Allocated total</p>
              <p className="mt-1 text-xl font-semibold text-slate-200">{formatMoney(projectFinanceAnalysis.allocated)}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Received total</p>
              <p className="mt-1 text-xl font-semibold text-emerald-400">{formatMoney(projectFinanceAnalysis.received)}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Remaining total</p>
              <p className="mt-1 text-xl font-semibold text-amber-300">{formatMoney(projectFinanceAnalysis.remaining)}</p>
            </div>
          </div>
          <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
            Expected management total (across projects):{" "}
            <span className="font-semibold text-slate-100">
              {formatMoney(projectFinanceAnalysis.managementExpectedTotal)}
            </span>
          </div>
        </div>
      )}

      {canSeeMoneyStats && section === "clients_due" && clientsDue.length > 0 && (
        <div className="shell border-amber-800/40">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Amount due per client
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Set reminder day (1–28) to remind each client on that day every month. Every shilling tracked.
          </p>
          <ul className="space-y-2 text-sm">
            {clientsDue.map((c) => (
              <li
                key={c.clientId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div>
                  <p className="text-slate-100">{c.name}</p>
                  {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                  <p className="text-amber-400">{formatMoney(c.amountDue)} due</p>
                </div>
                <div className="flex items-center gap-2">
                  {reminderDayEdit?.clientId === c.clientId ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={reminderDayEdit.day ?? ""}
                        onChange={(e) =>
                          setReminderDayEdit((p) => ({
                            ...p!,
                            day: e.target.value === "" ? null : parseInt(e.target.value, 10)
                          }))
                        }
                        className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => saveReminderDay(c.clientId, reminderDayEdit.day ?? null)}
                        className="rounded bg-sky-600 px-2 py-1 text-xs text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderDayEdit(null)}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setReminderDayEdit({
                          clientId: c.clientId,
                          day: c.reminderDayOfMonth ?? null
                        })
                      }
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Remind day: {c.reminderDayOfMonth ?? "—"}
                    </button>
                  )}
                  {c.lastReminderAt && (
                    <span className="text-xs text-slate-500">
                      Last: {new Date(c.lastReminderAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {isFinance && (
            <button
              type="button"
              onClick={sendRemindersToday}
              className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
            >
              Mark today&apos;s reminders as sent
            </button>
          )}
        </div>
      )}

      {section === "invoices" && (
        <FinanceFlatTable>
          <FinanceFlatTableHead>
            <FinanceFlatTh>Invoice</FinanceFlatTh>
            <FinanceFlatTh>Status</FinanceFlatTh>
            <FinanceFlatTh>Project</FinanceFlatTh>
            <FinanceFlatTh align="right">Amount</FinanceFlatTh>
            <FinanceFlatTh align="right">Actions</FinanceFlatTh>
          </FinanceFlatTableHead>
          <FinanceFlatTableBody>
            {invoices.map((inv) => (
              <FinanceFlatTableRow key={inv.id}>
                <FinanceFlatTd>
                  <span className="font-medium text-slate-100">{inv.number}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <FinanceStatusLabel status={inv.status} />
                </FinanceFlatTd>
                <FinanceFlatTd>
                  {inv.project ? (
                    <span className="text-sky-400/90">{inv.project.name}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </FinanceFlatTd>
                <FinanceFlatTd align="right">
                  <span className="font-medium tabular-nums text-emerald-400">{formatMoney(inv.totalAmount)}</span>
                </FinanceFlatTd>
                <FinanceFlatTd align="right">
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <FinanceTextAction
                      onClick={() => void downloadWithAuth(`/finance/invoices/${inv.id}/pdf`, `${inv.number}.pdf`)}
                    >
                      Download PDF
                    </FinanceTextAction>
                    {isFinance && (
                      <FinanceTextAction tone="danger" onClick={() => void deleteInvoice(inv.id)}>
                        Delete
                      </FinanceTextAction>
                    )}
                  </div>
                </FinanceFlatTd>
              </FinanceFlatTableRow>
            ))}
            {invoices.length === 0 && (
              <FinanceFlatTableRow>
                <FinanceFlatTd className="py-8 text-slate-500" colSpan={5}>
                  No invoices yet.
                </FinanceFlatTd>
              </FinanceFlatTableRow>
            )}
          </FinanceFlatTableBody>
        </FinanceFlatTable>
      )}

      {section === "payments" && (
        <FinanceFlatTable>
          <FinanceFlatTableHead>
            <FinanceFlatTh>When</FinanceFlatTh>
            <FinanceFlatTh>Client</FinanceFlatTh>
            <FinanceFlatTh>Invoice</FinanceFlatTh>
            <FinanceFlatTh>Project</FinanceFlatTh>
            <FinanceFlatTh align="right">Amount</FinanceFlatTh>
            <FinanceFlatTh>Received from</FinanceFlatTh>
            <FinanceFlatTh>Account</FinanceFlatTh>
            <FinanceFlatTh>Reference</FinanceFlatTh>
            <FinanceFlatTh>Status</FinanceFlatTh>
            <FinanceFlatTh align="right">Actions</FinanceFlatTh>
          </FinanceFlatTableHead>
          <FinanceFlatTableBody>
            {payments.map((p) => (
              <FinanceFlatTableRow key={p.id}>
                <FinanceFlatTd>
                  <span className="whitespace-nowrap text-slate-300">
                    {new Date(p.receivedAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short"
                    })}
                  </span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <span className="text-violet-300/90">{p.invoice?.client?.name ?? "—"}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <span className="font-medium text-slate-100">{p.invoice?.number ?? "—"}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  {p.invoice?.project ? (
                    <span className="text-sky-400/90">{p.invoice.project.name}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </FinanceFlatTd>
                <FinanceFlatTd align="right">
                  <span className="font-medium tabular-nums text-emerald-400">{formatMoney(p.amount)}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <span className="text-slate-300">{p.source ?? "—"}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <span className="text-slate-400">{p.account ?? "—"}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <span className="font-mono text-xs text-slate-400">{p.reference ?? "—"}</span>
                </FinanceFlatTd>
                <FinanceFlatTd>
                  <FinanceStatusLabel status={p.status} />
                </FinanceFlatTd>
                <FinanceFlatTd align="right">
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    {canRecordPayments && (
                      <FinanceTextAction onClick={() => openEditPayment(p)}>Edit</FinanceTextAction>
                    )}
                    {p.status === "pending" && canRecordPayments && (
                      <FinanceTextAction tone="danger" onClick={() => void deletePayment(p.id)}>
                        Delete
                      </FinanceTextAction>
                    )}
                  </div>
                </FinanceFlatTd>
              </FinanceFlatTableRow>
            ))}
            {payments.length === 0 && (
              <FinanceFlatTableRow>
                <FinanceFlatTd className="py-8 text-slate-500" colSpan={10}>
                  No payments yet. Use New payment to record one.
                </FinanceFlatTd>
              </FinanceFlatTableRow>
            )}
          </FinanceFlatTableBody>
        </FinanceFlatTable>
      )}

      {section === "expenses" && (
        <>
        <div className="shell flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Expenses (need admin approval) — where from, receipt code, which account, how paid
            </p>
            <select
              value={expenseCategoryFilter}
              onChange={(e) => setExpenseCategoryFilter(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            >
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
              {categories.filter((c) => !EXPENSE_CATEGORIES.includes(c as typeof EXPENSE_CATEGORIES[number])).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Total {expenseCategoryFilter === "all" ? "" : `(${expenseCategoryFilter}) `} (all statuses):{" "}
            {formatMoney(expensesTotal)}
            <span className="block text-slate-400">
              In period-style totals (approved/paid only): {formatMoney(expensesApprovedInFilter)}
            </span>
          </p>
          <ul className="space-y-2 text-sm">
            {filteredExpenses.map((exp) => (
              <li
                key={exp.id}
                className="flex flex-wrap items-center justify-between gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-100">{exp.category.replace(/_/g, " ")}</span>
                  {exp.description && (
                    <p className="truncate text-xs text-slate-400">{exp.description}</p>
                  )}
                  {exp.source && <p className="text-xs text-slate-300">From: {exp.source}</p>}
                  {exp.transactionCode && <p className="text-xs text-slate-300">Receipt/tx: {exp.transactionCode}</p>}
                  {exp.account && <p className="text-xs text-slate-300">Account: {exp.account}</p>}
                  {exp.paymentMethod && <p className="text-xs text-slate-300">Paid via: {exp.paymentMethod}</p>}
                  {exp.notes && (
                    <p className="text-xs text-slate-500">Note: {exp.notes}</p>
                  )}
                  {exp.beneficiary && (
                    <p className="text-xs text-sky-300">
                      Attributed to: {(exp.beneficiary.name || exp.beneficiary.email).trim()}
                    </p>
                  )}
                  {exp.purposeCode && (
                    <p className="text-xs text-slate-400">
                      Purpose:{" "}
                      {PURPOSE_CODES.find((x) => x.value === exp.purposeCode)?.label ?? exp.purposeCode}
                      {exp.purposeDetail ? ` — ${exp.purposeDetail}` : ""}
                    </p>
                  )}
                  {exp.toolOrServiceName && (
                    <p className="text-xs text-slate-400">
                      Tool/service: {exp.toolOrServiceName}
                      {exp.subscriptionValidUntil
                        ? ` · valid until ${new Date(exp.subscriptionValidUntil).toLocaleDateString()}`
                        : ""}
                    </p>
                  )}
                  {exp.category === "developer_payment" && (
                    <p className="text-xs text-amber-300">
                      Developer acknowledgment:{" "}
                      {exp.developerAcknowledgedAt
                        ? `Confirmed ${new Date(exp.developerAcknowledgedAt).toLocaleDateString()}`
                        : "Awaiting developer confirmation"}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {new Date(exp.spentAt).toLocaleDateString()} · {exp.status}
                    {exp.status === "pending" && " — needs admin approval"}
                  </p>
                  {isFinance && exp.status === "pending" && (
                    pendingApprovalIds.has(exp.id) ? (
                      <p className="text-xs text-amber-400">Pending admin approval</p>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void downloadWithAuth(`/finance/expenses/${exp.id}/receipt/pdf`, `expense-${exp.id}.pdf`)}
                          className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Download receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => submitForApproval("expense", exp.id)}
                          className="rounded border border-amber-600 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-900/30"
                        >
                          Submit for admin approval
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditExpense(exp)}
                          className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExpense(exp.id)}
                          className="rounded border border-rose-700 px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    )
                  )}
                  {(!isFinance || exp.status !== "pending") && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void downloadWithAuth(`/finance/expenses/${exp.id}/receipt/pdf`, `expense-${exp.id}.pdf`)}
                        className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Download receipt
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-amber-400">{formatMoney(exp.amount)}</span>
              </li>
            ))}
            {filteredExpenses.length === 0 && (
              <li className="text-sm text-slate-400">
                {expenses.length === 0 ? "No expenses yet." : "No expenses in this category."}
              </li>
            )}
          </ul>
        </div>
        {isFinance && (
          <div className="shell">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Add expense (where from, receipt code, which account, how paid) — needs admin approval
            </p>
            <form onSubmit={submitExpense} className="flex flex-col gap-2">
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Description (e.g. AWS Jan)"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <input
                type="text"
                placeholder="Where from (vendor/supplier)"
                value={expenseForm.source}
                onChange={(e) => setExpenseForm((f) => ({ ...f, source: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <input
                type="text"
                placeholder="Receipt / transaction code"
                value={expenseForm.transactionCode}
                onChange={(e) => setExpenseForm((f) => ({ ...f, transactionCode: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <input
                type="text"
                placeholder="Which account paid from"
                value={expenseForm.account}
                onChange={(e) => setExpenseForm((f) => ({ ...f, account: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
              </select>
              <textarea
                placeholder="Notes / comment"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                className="min-h-[48px] rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-500">
                Transport / tools / paying a developer: attribute who, purpose, and tools subscription where relevant.
              </p>
              <select
                value={expenseForm.beneficiaryUserId}
                onChange={(e) => setExpenseForm((f) => ({ ...f, beneficiaryUserId: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="">Who used / who is paid (optional)</option>
                {expenseOrgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email).trim()}
                  </option>
                ))}
              </select>
              <select
                value={expenseForm.purposeCode}
                onChange={(e) => setExpenseForm((f) => ({ ...f, purposeCode: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="">Purpose / context</option>
                {PURPOSE_CODES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Detail (e.g. client name, meeting notes)"
                value={expenseForm.purposeDetail}
                onChange={(e) => setExpenseForm((f) => ({ ...f, purposeDetail: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
              {(expenseForm.category === "tools" || expenseForm.category === "apis") && (
                <>
                  <input
                    type="text"
                    placeholder="Tool or service name"
                    value={expenseForm.toolOrServiceName}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, toolOrServiceName: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="date"
                    title="Subscription valid until"
                    value={expenseForm.subscriptionValidUntil}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, subscriptionValidUntil: e.target.value }))
                    }
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  />
                </>
              )}
              <input
                type="number"
                placeholder="Amount (KES)"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              />
              <input
                type="date"
                value={expenseForm.spentAt}
                onChange={(e) => setExpenseForm((f) => ({ ...f, spentAt: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              />
              <button
                type="submit"
                className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
              >
                Record expense (then submit for admin approval)
              </button>
            </form>

            {editingExpenseId && editExpenseForm && (
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Edit pending expense
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={editExpenseForm.category}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, category: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount (KES)"
                    value={editExpenseForm.amount}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, amount: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  />
                  <input
                    type="date"
                    value={editExpenseForm.spentAt}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, spentAt: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  />
                  <select
                    value={editExpenseForm.paymentMethod}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, paymentMethod: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  >
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div className="mt-2 grid gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={editExpenseForm.description}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, description: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Where from (vendor/supplier)"
                    value={editExpenseForm.source}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, source: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Receipt / transaction code"
                    value={editExpenseForm.transactionCode}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, transactionCode: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Which account paid from"
                    value={editExpenseForm.account}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, account: e.target.value }))}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <textarea
                    placeholder="Notes / comment"
                    value={editExpenseForm.notes}
                    onChange={(e) => setEditExpenseForm((f) => ({ ...f!, notes: e.target.value }))}
                    className="min-h-[48px] rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <select
                    value={editExpenseForm.beneficiaryUserId}
                    onChange={(e) =>
                      setEditExpenseForm((f) => ({ ...f!, beneficiaryUserId: e.target.value }))
                    }
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  >
                    <option value="">Who used / who is paid</option>
                    {expenseOrgUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.name || u.email).trim()}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editExpenseForm.purposeCode}
                    onChange={(e) =>
                      setEditExpenseForm((f) => ({ ...f!, purposeCode: e.target.value }))
                    }
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                  >
                    <option value="">Purpose</option>
                    {PURPOSE_CODES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Purpose detail"
                    value={editExpenseForm.purposeDetail}
                    onChange={(e) =>
                      setEditExpenseForm((f) => ({ ...f!, purposeDetail: e.target.value }))
                    }
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEditExpense()}
                    className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditExpense}
                    className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </>
      )}
      <InvoiceCreateModal
        open={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setInvoiceSubmitError(null);
        }}
        form={invoiceForm}
        setForm={setInvoiceForm}
        clients={clients}
        projects={projects}
        submitError={invoiceSubmitError}
        onSubmit={submitInvoice}
        emptyLine={emptyInvoiceLine}
      />
      <PaymentCreateModal
        open={showPaymentModal}
        mode={paymentModalMode}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentModalMode("create");
          setPaymentSubmitError(null);
    setPaymentNotice(null);
        }}
        form={paymentForm}
        setForm={setPaymentForm}
        projects={projects}
        clients={clients}
        invoices={invoices}
        submitError={paymentSubmitError}
        onSubmit={submitPayment}
      />
    </section>
  );
}

