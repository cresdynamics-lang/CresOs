"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../data-refresh";
import { formatMoney } from "../format-money";
import { PageHeader } from "../page-header";

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalAmount: number;
  projectId: string | null;
  project: { id: string; name: string } | null;
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
  invoice?: { projectId: string | null; project: { id: string; name: string } | null } | null;
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

const EXPENSE_CATEGORIES = [
  "salaries",
  "apis",
  "hostings",
  "domains",
  "renewals",
  "apis_per_project",
  "other"
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
  period: { startOfMonth: string; endOfMonth: string };
  revenue: { thisMonth: number; allTime: number };
  invoices: {
    outstandingAmount: number;
    overdueCount: number;
    byStatus: { status: string; count: number }[];
  };
  expenses: { thisMonth: number; allTime: number };
  payouts: { pendingAmount: number };
  cashFlow: {
    revenueThisMonth: number;
    expensesThisMonth: number;
    netThisMonth: number;
  };
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

export default function FinancePage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const canAccessFinance = auth.roleKeys.some((r) => ["admin", "finance", "analyst"].includes(r));

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
  }>({
    category: "other",
    description: "",
    notes: "",
    amount: "",
    spentAt: new Date().toISOString().slice(0, 10),
    source: "",
    transactionCode: "",
    account: "",
    paymentMethod: "bank"
  });
  const [paymentForm, setPaymentForm] = useState<{ projectId: string; method: string; amount: string; receivedAt: string; notes: string; source: string; invoiceId: string }>({
    projectId: "",
    method: "mpesa",
    amount: "",
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: "",
    source: "",
    invoiceId: ""
  });
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState<{ source: string; account: string; reference: string; howToProceed: string }>({
    source: "",
    account: "",
    reference: "",
    howToProceed: ""
  });
  const [reminderDayEdit, setReminderDayEdit] = useState<{ clientId: string; day: number | null } | null>(null);
  /** Expense/payout entity ids that have a pending Approval row (from DB). */
  const [pendingApprovalIds, setPendingApprovalIds] = useState<Set<string>>(new Set());
  /** Count of pending expense/payout approval rows — matches DB & header. */
  const [pendingFinanceApprovalCount, setPendingFinanceApprovalCount] = useState(0);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [invoiceForm, setInvoiceForm] = useState<{
    clientId: string;
    projectId: string;
    number: string;
    issueDate: string;
    dueDate: string;
    description: string;
    quantity: string;
    unitPrice: string;
  }>({
    clientId: "",
    projectId: "",
    number: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    description: "",
    quantity: "1",
    unitPrice: ""
  });

  const canSeeReport = auth.roleKeys.some((r) =>
    ["finance", "director_admin", "admin"].includes(r)
  );
  // Only Finance role can perform actions; Director/Admin see read-only
  const isFinance = auth.roleKeys.includes("finance");
  const isAdmin = auth.roleKeys.includes("admin");

  const fetchReport = useCallback(async () => {
    if (!canAccessFinance || !canSeeReport) return;
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
  }, [canSeeReport, apiFetch, canAccessFinance]);

  const loadData = useCallback(async () => {
    if (!canAccessFinance) return;
    try {
      const [invRes, payRes, expRes, dueRes] = await Promise.all([
        apiFetch("/finance/invoices"),
        apiFetch("/finance/payments"),
        apiFetch("/finance/expenses"),
        canSeeReport ? apiFetch("/finance/clients/due") : Promise.resolve(null)
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
              project: inv.project ?? null
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
            invoice: p.invoice ?? null
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
            status: exp.status ?? "pending"
          }))
        );
      }
      if (dueRes?.ok) {
        const data = (await dueRes.json()) as ClientDue[];
        setClientsDue(data);
      }
      if (canSeeReport) {
        const projRes = await apiFetch("/finance/projects");
        if (projRes.ok) {
          const projData = (await projRes.json()) as ProjectFinancial[];
          setProjectFinancials(projData);
        }
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
      if (isFinance) {
        const [clientsRes, projectsRes] = await Promise.all([
          apiFetch("/crm/clients"),
          apiFetch("/projects")
        ]);
        if (clientsRes.ok) {
          const clientsData = (await clientsRes.json()) as { id: string; name: string }[];
          setClients(clientsData);
        }
        if (projectsRes.ok) {
          const projectsData = (await projectsRes.json()) as { id: string; name: string }[];
          setProjects(projectsData);
        }
      }
    } catch {
      // ignore
    }
  }, [apiFetch, canSeeReport, isFinance, canAccessFinance]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canSeeReport) return;
    void fetchReport();
  }, [canSeeReport, fetchReport]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadData();
        if (canSeeReport) void fetchReport();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => {
      void loadData();
      if (canSeeReport) void fetchReport();
    });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [loadData, fetchReport, canSeeReport]);

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
          paymentMethod: expenseForm.paymentMethod || undefined
        })
      });
      if (res.ok) {
        setExpenseForm((f) => ({ ...f, description: "", notes: "", amount: "", source: "", transactionCode: "", account: "" }));
        loadData();
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
    if (!paymentForm.amount || !paymentForm.receivedAt) return;
    try {
      const res = await apiFetch("/finance/payments", {
        method: "POST",
        body: JSON.stringify({
          method: paymentForm.method,
          amount: paymentForm.amount,
          receivedAt: paymentForm.receivedAt,
          notes: paymentForm.notes || undefined,
          source: paymentForm.source || undefined,
          invoiceId: paymentForm.invoiceId || undefined
        })
      });
      if (res.ok) {
        setPaymentForm((f) => ({ ...f, amount: "", notes: "", source: "" }));
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const openConfirmPayment = (p: Payment) => {
    setConfirmPaymentId(p.id);
    setConfirmForm({
      source: p.source ?? "",
      account: p.account ?? "",
      reference: p.reference ?? "",
      howToProceed: p.howToProceed ?? ""
    });
  };

  const submitConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPaymentId) return;
    const { source, account, reference, howToProceed } = confirmForm;
    if (!source.trim() || !account.trim() || !reference.trim()) return;
    try {
      const res = await apiFetch(`/finance/payments/${confirmPaymentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ source: source.trim(), account: account.trim(), reference: reference.trim(), howToProceed: howToProceed.trim() || undefined })
      });
      if (res.ok) {
        setConfirmPaymentId(null);
        setConfirmForm({ source: "", account: "", reference: "", howToProceed: "" });
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const submitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.clientId || !invoiceForm.number || !invoiceForm.issueDate || !invoiceForm.description.trim() || !invoiceForm.unitPrice) return;
    const qty = parseInt(invoiceForm.quantity, 10) || 1;
    try {
      const res = await apiFetch("/finance/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientId: invoiceForm.clientId,
          projectId: invoiceForm.projectId || undefined,
          number: invoiceForm.number.trim(),
          issueDate: invoiceForm.issueDate,
          dueDate: invoiceForm.dueDate || undefined,
          currency: "KES",
          items: [{ description: invoiceForm.description.trim(), quantity: qty, unitPrice: invoiceForm.unitPrice }]
        })
      });
      if (res.ok) {
        setInvoiceForm((f) => ({ ...f, number: "", description: "", quantity: "1", unitPrice: "" }));
        loadData();
      }
    } catch {
      // ignore
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
        if (canSeeReport) await fetchReport();
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

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="Finance overview"
        description="Invoices, payments, expenses, and payouts in one place. All amounts in Kenyan Shillings (KES). Numbers load from your workspace database via the API; expense lines count in period totals after Admin approval."
      />

      {canSeeReport && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="shell">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Revenue (period)</p>
            <p className="mt-1 text-xl font-semibold text-emerald-400">
              {report ? formatMoney(report.revenue.thisMonth) : reportLoading ? "…" : "—"}
            </p>
          </div>
          <div className="shell">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outstanding</p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {report ? formatMoney(report.invoices.outstandingAmount) : reportLoading ? "…" : "—"}
            </p>
          </div>
          <div className="shell">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net flow</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                !report ? "text-slate-500" : report.cashFlow.netThisMonth >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {report ? formatMoney(report.cashFlow.netThisMonth) : reportLoading ? "…" : "—"}
            </p>
          </div>
          <div className="shell">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pending requests</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">{pendingFinanceApprovalCount}</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="shell border border-slate-600/80 bg-slate-900/50">
          <h3 className="text-sm font-semibold text-slate-200">Admin&apos;s finance access rules</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-800/40 bg-slate-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Can see</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Approved and declined transaction history · Pending request amounts and stated purposes · Cash flow summary ·
                Outstanding invoice totals against active projects
              </p>
            </div>
            <div className="rounded-lg border-l-4 border-rose-500/70 bg-slate-950/40 p-3 pl-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Cannot do</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Admin cannot initiate, edit, or execute a transaction. Admin cannot see raw client pricing or invoice line items — only
                aggregate totals visible here. That detail lives in Finance and Sales.
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

      {canSeeReport && projectFinancials.length > 0 && (
        <div className="shell border-sky-800/50">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Project financials (platform) — deduction &amp; what is there
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Allocated vs received per project; when on management: expected per month and for how long (to plan upgrades).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-2 pr-2">Project</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2 text-right">Allocated</th>
                  <th className="pb-2 pr-2 text-right">Received</th>
                  <th className="pb-2 pr-2 text-right">Remaining</th>
                  <th className="pb-2 pr-2">Management</th>
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
                      {p.allocated != null ? formatMoney(p.allocated) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right text-emerald-400">{formatMoney(p.received)}</td>
                    <td className="py-2 pr-2 text-right text-amber-400">
                      {p.remaining != null ? formatMoney(p.remaining) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-slate-300">
                      {p.managementMonthlyAmount != null && p.managementMonths != null ? (
                        <span>
                          {formatMoney(p.managementMonthlyAmount)}/month for {p.managementMonths} month{p.managementMonths !== 1 ? "s" : ""}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canSeeReport && (
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
                <p className="text-xs text-slate-400">Invoices</p>
                <p className="text-amber-400">Outstanding: {formatMoney(report.invoices.outstandingAmount)}</p>
                <p className="text-xs text-slate-400">Overdue: {report.invoices.overdueCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Expenses</p>
                <p className="text-slate-200">This month: {formatMoney(report.expenses.thisMonth)}</p>
                <p className="text-xs text-slate-400">All time: {formatMoney(report.expenses.allTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cash flow (month)</p>
                <p className="text-slate-200">In: {formatMoney(report.cashFlow.revenueThisMonth)}</p>
                <p className="text-slate-200">Out: {formatMoney(report.cashFlow.expensesThisMonth)}</p>
                <p className={report.cashFlow.netThisMonth >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  Net: {formatMoney(report.cashFlow.netThisMonth)}
                </p>
              </div>
            </div>
          )}
          {report && (
            <p className="mt-3 text-xs text-slate-500">
              Generated {new Date(report.generatedAt).toLocaleString()} · Pending payouts: {formatMoney(report.payouts.pendingAmount)}
            </p>
          )}
        </div>
      )}

      {canSeeReport && clientsDue.length > 0 && (
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Invoices (for work done — link to project for clarity)
          </p>
          <ul className="space-y-2 text-sm">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div>
                  <p className="text-slate-100">{inv.number}</p>
                  <p className="text-xs text-slate-400 capitalize">{inv.status}</p>
                  {inv.project && (
                    <p className="text-xs text-sky-400">For project: {inv.project.name}</p>
                  )}
                </div>
                <span className="text-emerald-400">{formatMoney(inv.totalAmount)}</span>
              </li>
            ))}
            {invoices.length === 0 && (
              <li className="text-sm text-slate-400">No invoices yet.</li>
            )}
          </ul>
          {isFinance && clients.length > 0 && (
            <form onSubmit={submitInvoice} className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
              <p className="text-xs font-medium text-slate-400">Create invoice (for work done — link to project)</p>
              <select
                value={invoiceForm.clientId}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, clientId: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                required
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={invoiceForm.projectId}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, projectId: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Invoice number"
                value={invoiceForm.number}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, number: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                required
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={invoiceForm.issueDate}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, issueDate: e.target.value }))}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                />
                <input
                  type="date"
                  placeholder="Due date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                />
              </div>
              <input
                type="text"
                placeholder="Line: description"
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={invoiceForm.quantity}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Unit price (KES)"
                  value={invoiceForm.unitPrice}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                />
              </div>
              <button type="submit" className="rounded bg-sky-600 px-2 py-1.5 text-sm text-white hover:bg-sky-500">
                Create invoice
              </button>
            </form>
          )}
        </div>
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Payments received — confirm with: where from, transaction code, which account, how to proceed
          </p>
          <ul className="space-y-2 text-sm">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="capitalize text-slate-100">{p.method} · {formatMoney(p.amount)}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(p.receivedAt).toLocaleDateString()} · {p.status}
                  </p>
                  {p.invoice?.project && (
                    <p className="text-xs text-sky-400">For project: {p.invoice.project.name}</p>
                  )}
                  {(p.source || p.status === "confirmed") && (
                    <>
                      {p.source && <p className="text-xs text-slate-300">Source: {p.source}</p>}
                      {p.status === "confirmed" && (
                        <>
                          {p.reference && <p className="text-xs text-slate-300">Tx code: {p.reference}</p>}
                          {p.account && <p className="text-xs text-slate-300">Account: {p.account}</p>}
                          {p.howToProceed && <p className="text-xs text-slate-400">Proceed: {p.howToProceed}</p>}
                        </>
                      )}
                    </>
                  )}
                  {p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-emerald-400">{formatMoney(p.amount)}</span>
                  {p.status === "pending" && isFinance && (
                    confirmPaymentId === p.id ? (
                      <form onSubmit={submitConfirmPayment} className="mt-2 flex flex-col gap-1 rounded border border-slate-600 bg-slate-800/80 p-2">
                        <input
                          type="text"
                          placeholder="Where from (source)"
                          value={confirmForm.source}
                          onChange={(e) => setConfirmForm((f) => ({ ...f, source: e.target.value }))}
                          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Transaction code / receipt ref"
                          value={confirmForm.reference}
                          onChange={(e) => setConfirmForm((f) => ({ ...f, reference: e.target.value }))}
                          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Which account it landed in"
                          value={confirmForm.account}
                          onChange={(e) => setConfirmForm((f) => ({ ...f, account: e.target.value }))}
                          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          required
                        />
                        <input
                          type="text"
                          placeholder="How to proceed (e.g. allocate to INV-001)"
                          value={confirmForm.howToProceed}
                          onChange={(e) => setConfirmForm((f) => ({ ...f, howToProceed: e.target.value }))}
                          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                        />
                        <div className="flex gap-1">
                          <button type="submit" className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Confirm</button>
                          <button type="button" onClick={() => setConfirmPaymentId(null)} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConfirmPayment(p)}
                        className="rounded border border-amber-600 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30"
                      >
                        Confirm (add source, tx code, account)
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
            {payments.length === 0 && (
              <li className="text-sm text-slate-400">No payments yet.</li>
            )}
          </ul>
          {isFinance && (
            <form onSubmit={submitPayment} className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
              <p className="text-xs text-slate-400">Record payment — choose project, then invoice (deducts from project)</p>
              <select
                value={paymentForm.projectId}
                onChange={(e) => setPaymentForm((f) => ({ ...f, projectId: e.target.value, invoiceId: "" }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200"
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={paymentForm.invoiceId}
                onChange={(e) => setPaymentForm((f) => ({ ...f, invoiceId: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200"
              >
                <option value="">No invoice</option>
                {(paymentForm.projectId
                  ? invoices.filter((inv) => inv.projectId === paymentForm.projectId)
                  : invoices
                ).map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} {inv.project ? `— ${inv.project.name}` : ""}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Payment source (where from)"
                value={paymentForm.source}
                onChange={(e) => setPaymentForm((f) => ({ ...f, source: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200"
              >
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
              </select>
              <input
                type="number"
                placeholder="Amount (KES)"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200"
              />
              <input
                type="date"
                value={paymentForm.receivedAt}
                onChange={(e) => setPaymentForm((f) => ({ ...f, receivedAt: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200"
              />
              <input
                type="text"
                placeholder="Notes (e.g. ref, comment)"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="rounded bg-emerald-600 px-2 py-1 text-sm text-white hover:bg-emerald-500"
              >
                Record payment
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="shell">
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
            Total {expenseCategoryFilter === "all" ? "" : `(${expenseCategoryFilter}) `}: {formatMoney(expensesTotal)}
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
                  <p className="text-xs text-slate-500">
                    {new Date(exp.spentAt).toLocaleDateString()} · {exp.status}
                    {exp.status === "pending" && " — needs admin approval"}
                  </p>
                  {isFinance && exp.status === "pending" && (
                    pendingApprovalIds.has(exp.id) ? (
                      <p className="text-xs text-amber-400">Pending admin approval</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => submitForApproval("expense", exp.id)}
                        className="mt-1 rounded border border-amber-600 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-900/30"
                      >
                        Submit for admin approval
                      </button>
                    )
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
          </div>
        )}
      </div>
    </section>
  );
}

