"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";
import { WorkspaceLiveAnalytics } from "../../components/analytics/workspace-live-analytics";
import { WorkforceAnalyticsPanel } from "../../components/analytics/workforce-analytics-panel";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { FinanceNeuPanel, FinanceStatCard, FinanceStatGrid } from "../../components/finance/finance-ui";
import { financeNeu } from "../../components/finance/finance-theme";
import {
  WorkspaceAlignedTips,
  WorkspaceDashboardSection,
  WorkspacePriorityGrid,
  dedupeAiHint,
  dedupeFocusTips,
  type WorkspacePriorityItem
} from "../../components/workspace/workspace-dashboard-primitives";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";

type FinancialReport = {
  generatedAt: string;
  revenue: { thisMonth: number; allTime: number };
  invoices: { outstandingAmount: number; openInvoiceRemaining?: number; overdueCount: number };
  projects?: {
    approvedCount: number;
    totalContractValue: number;
    totalReceived: number;
  };
  expenses: { thisMonth: number; allTime: number };
  payouts: { pendingAmount: number; paidThisMonth?: number };
  cashFlow: {
    revenueThisMonth: number;
    expensesThisMonth: number;
    netThisMonth: number;
  };
  derived?: { netCashMovementAllTime: number };
  pending?: { approvalQueue: number; paymentsPending: number; total: number };
};

const QUICK_LINKS = [
  { href: "/finance/messages", label: "Mail" },
  { href: "/finance/payments", label: "Payments" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/reports", label: "Reports" },
  { href: "/approvals", label: "Approvals" },
  { href: "/schedule", label: "Tasks" },
  { href: "/community", label: "Community" },
  { href: "/settings/account", label: "Settings" }
] as const;

type FinanceOverviewDashboardProps = {
  report: FinancialReport | null;
  reportLoading: boolean;
  pendingFallback: number;
  isAdmin: boolean;
  analyticsVariant: "finance" | "admin" | "director";
};

export function FinanceOverviewDashboard({
  report,
  reportLoading,
  pendingFallback,
  isAdmin,
  analyticsVariant
}: FinanceOverviewDashboardProps) {
  const { apiFetch, auth } = useAuth();
  const [focusTips, setFocusTips] = useState<string[]>([]);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );
  const roleLabel = auth.roleKeys.includes("finance")
    ? "Finance"
    : auth.roleKeys.includes("admin")
      ? "Admin"
      : "Finance workspace";

  const pendingTotal = report?.pending?.total ?? pendingFallback;

  const loadCoach = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const res = await apiFetch("/dashboard/focus-coach");
      if (!res.ok) return;
      const coach = (await res.json()) as {
        deterministicTips?: string[];
        aiHint?: string | null;
      };
      setFocusTips(coach.deterministicTips ?? []);
      setAiHint(coach.aiHint ?? null);
    } catch {
      // optional coaching layer
    }
  }, [apiFetch, auth.accessToken]);

  useEffect(() => {
    void loadCoach();
  }, [loadCoach]);

  const alertItems = useMemo((): WorkspacePriorityItem[] => {
    if (!report) return [];
    const items: WorkspacePriorityItem[] = [];
    const overdue = report.invoices.overdueCount;
    const pendingApprovals = report.pending?.approvalQueue ?? 0;
    const pendingPayments = report.pending?.paymentsPending ?? 0;

    if (overdue > 0) {
      items.push({
        id: "overdue-invoices",
        tone: "danger",
        title: `${overdue} overdue invoice${overdue === 1 ? "" : "s"}`,
        detail: "Follow up on unpaid invoices before collection escalates.",
        href: "/finance/invoices",
        action: "Review invoices"
      });
    }

    if (pendingPayments > 0) {
      items.push({
        id: "pending-payments",
        tone: "warning",
        title: `${pendingPayments} payment${pendingPayments === 1 ? "" : "s"} awaiting confirmation`,
        detail: "Confirm bank receipts so project balances stay accurate.",
        href: "/finance/payments",
        action: "Open payments"
      });
    }

    if (pendingApprovals > 0) {
      items.push({
        id: "pending-approvals",
        tone: "warning",
        title: `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} in queue`,
        detail: "Clear the queue so salaries, expenses, and payouts can move.",
        href: "/approvals",
        action: "Open approvals"
      });
    }

    if (report.cashFlow.netThisMonth < 0 && overdue === 0) {
      items.push({
        id: "negative-flow",
        tone: "warning",
        title: "Net cash flow is negative this month",
        detail: "Review outflows and outstanding receivables in reports.",
        href: "/finance/reports",
        action: "View reports"
      });
    }

    return items;
  }, [report]);

  const alignedTips = useMemo(
    () =>
      dedupeFocusTips(focusTips, {
        hasOverdueInvoiceAlert: (report?.invoices.overdueCount ?? 0) > 0,
        hasPendingApprovalsAlert: (report?.pending?.approvalQueue ?? 0) > 0,
        hasPendingPaymentsAlert: (report?.pending?.paymentsPending ?? 0) > 0,
        priorityTitles: alertItems.map((a) => a.title)
      }),
    [focusTips, report, alertItems]
  );

  const alignedHint = useMemo(() => dedupeAiHint(aiHint, alignedTips, {}), [aiHint, alignedTips]);

  const alertClass = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return financeNeu.alertDanger;
    if (tone === "warning") return financeNeu.alertWarning;
    return financeNeu.alertInfo;
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
            {roleLabel}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {welcomeHeadline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Client payments in, salaries and ops out — all amounts in{" "}
            <span className="font-medium text-slate-300">Kenyan Shillings (KES)</span>. Use the sidebar or quick links
            below.
          </p>
        </div>
      </header>

      {alertItems.length > 0 ? (
        <WorkspaceDashboardSection label="Today's priorities" roleKeys={auth.roleKeys}>
          <WorkspacePriorityGrid items={alertItems} panelClass={alertClass} />
        </WorkspaceDashboardSection>
      ) : null}

      <WorkspaceAlignedTips
        tips={alignedTips}
        aiHint={alignedHint}
        panelClass={`${financeNeu.panelInset} p-4 sm:p-5`}
        roleKeys={auth.roleKeys}
      />

      <WorkspaceDashboardSection label="Your queue" roleKeys={auth.roleKeys}>
        <p className="-mt-1 mb-3 text-xs text-slate-500">This month (UTC)</p>
          <FinanceStatGrid>
            <FinanceStatCard
              label="Revenue in"
              value={report ? formatMoney(report.revenue.thisMonth) : reportLoading ? "…" : "—"}
              hint="Confirmed client payments"
              tone="emerald"
            />
            <FinanceStatCard
              label="Outstanding"
              value={report ? formatMoney(report.invoices.outstandingAmount) : reportLoading ? "…" : "—"}
              hint="Unpaid on projects / invoices"
              tone="amber"
            />
            <FinanceStatCard
              label="Net flow"
              value={report ? formatMoney(report.cashFlow.netThisMonth) : reportLoading ? "…" : "—"}
              hint="In minus approved outflows"
              tone={!report ? "brand" : report.cashFlow.netThisMonth >= 0 ? "emerald" : "rose"}
            />
            <FinanceStatCard
              label="Pending"
              value={reportLoading ? "…" : pendingTotal}
              hint={
                report?.pending
                  ? `${report.pending.approvalQueue} approvals · ${report.pending.paymentsPending} payments`
                  : "Awaiting action"
              }
              tone="violet"
            />
          </FinanceStatGrid>
      </WorkspaceDashboardSection>

      <nav
        aria-label="Finance quick links"
        className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-6"
      >
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${financeNeu.navIdle} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Live data mapping — how sources feed the dashboard */}
      <section aria-label="Data mapping">
        <FinanceNeuPanel inset className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-200">How numbers stay in sync</h2>
          <p className="mt-1 text-xs text-slate-500">
            All figures come from the database — no manual totals. Confirming a payment updates everything below
            automatically.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DataFlowStep
              source="Sales & projects"
              detail="Approved project contract value and amount received on each project."
              feeds="Outstanding KPI · Projects collected"
            />
            <DataFlowStep
              source="Finance · payments"
              detail="Confirmed payment on an invoice increments project received and invoice status."
              feeds="Revenue in · Cash flow In · Remaining ↓"
            />
            <DataFlowStep
              source="Finance · expenses"
              detail="Approved salaries, ops, and payouts count as outflows when spent."
              feeds="Net flow · Cash flow Out"
            />
            <DataFlowStep
              source="Computed cash flow"
              detail="In minus out by week and month — same rules as full reports."
              feeds="8-week chart · Net flow card"
            />
          </ol>
          {report?.projects != null && (
            <p className="mt-4 rounded-lg border border-emerald-500/15 bg-emerald-950/15 px-3 py-2 text-xs text-emerald-200/90">
              Projects: {formatMoney(report.projects.totalReceived)} collected of{" "}
              {formatMoney(report.projects.totalContractValue)} contract ·{" "}
              {formatMoney(report.invoices.outstandingAmount)} still outstanding
            </p>
          )}
        </FinanceNeuPanel>
      </section>

      <section aria-label="Progress charts" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys} tone="dashboard">
          Progress charts
        </DashboardSectionLabel>
        <WorkspaceLiveAnalytics variant={analyticsVariant} compact className="mt-3 border-0 pb-0" />
      </section>

      <WorkforceAnalyticsPanel variant="finance" accent="finance" showHeader />

      {/* Secondary period summary — replaces duplicate “Financial report” block */}
      {report && (
        <section aria-label="Period summary">
          <FinanceNeuPanel inset className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Period summary</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Updated {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
              <Link
                href="/finance/reports"
                className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-950/50"
              >
                Full reports →
              </Link>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label="All-time revenue" value={formatMoney(report.revenue.allTime)} />
              <SummaryItem
                label="Open invoice balance"
                value={formatMoney(report.invoices.openInvoiceRemaining ?? 0)}
              />
              <SummaryItem label="Expenses (month)" value={formatMoney(report.expenses.thisMonth)} />
              <SummaryItem label="Expenses (all time)" value={formatMoney(report.expenses.allTime)} />
              {report.projects != null && (
                <SummaryItem
                  label="Projects collected"
                  value={formatMoney(report.projects.totalReceived)}
                  hint={`${report.projects.approvedCount} approved · ${formatMoney(report.projects.totalContractValue)} contract`}
                />
              )}
              <SummaryItem
                label="All-time net movement"
                value={formatMoney(report.derived?.netCashMovementAllTime ?? 0)}
              />
              <SummaryItem label="Overdue invoices" value={String(report.invoices.overdueCount)} />
              <SummaryItem label="Pending payouts" value={formatMoney(report.payouts.pendingAmount)} />
            </dl>
          </FinanceNeuPanel>
        </section>
      )}

      {isAdmin && <AdminFinanceRulesCollapsible />}
    </div>
  );
}

function DataFlowStep({
  source,
  detail,
  feeds
}: {
  source: string;
  detail: string;
  feeds: string;
}) {
  return (
    <li className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">{source}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        → <span className="text-slate-300">{feeds}</span>
      </p>
    </li>
  );
}

function SummaryItem({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 tabular-nums text-slate-200">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11px] text-slate-500">{hint}</dd> : null}
    </div>
  );
}

function AdminFinanceRulesCollapsible() {
  return (
    <details className={`${financeNeu.panel} rounded-2xl border border-slate-700/60 p-4 sm:p-5`}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-slate-100">
        Admin finance access rules
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <RuleCard tone="emerald" title="Can see">
          Approved and declined history · Pending amounts · Cash flow · Ledger · Outstanding totals
        </RuleCard>
        <RuleCard tone="rose" title="Limited">
          Admin can confirm bank payments and view the ledger. Expenses and invoice line edits stay with Finance
          and Sales.
        </RuleCard>
        <RuleCard tone="sky" title="Project pricing">
          When Sales activates a project, its value feeds the pipeline. Admin sees aggregates — not client
          breakdowns.
        </RuleCard>
      </div>
    </details>
  );
}

function RuleCard({
  tone,
  title,
  children
}: {
  tone: "emerald" | "rose" | "sky";
  title: string;
  children: ReactNode;
}) {
  const border =
    tone === "emerald"
      ? "border-emerald-800/40"
      : tone === "rose"
        ? "border-l-4 border-rose-500/70 pl-4"
        : "border-sky-800/40";
  const label =
    tone === "emerald" ? "text-emerald-400/90" : tone === "rose" ? "text-rose-300" : "text-sky-300";
  return (
    <div className={`rounded-lg border bg-slate-950/40 p-3 ${border}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${label}`}>{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}
