"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";
import { WorkspaceLiveAnalytics } from "../../components/analytics/workspace-live-analytics";
import {
  DashboardSectionLabel,
  DashboardWelcomeBanner
} from "../../components/dashboard-welcome-banner";
import { FinanceNeuPanel, FinanceStatCard, FinanceStatGrid } from "../../components/finance/finance-ui";
import { financeNeu } from "../../components/finance/finance-theme";
import { buildWelcomeHeadline, getDisplayFirstName } from "../../lib/personalized-greeting";

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
  const { auth } = useAuth();
  const firstName = useMemo(
    () => getDisplayFirstName(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-4">
      {/* Single header — welcome + context, no duplicate page title */}
      <header className="space-y-4">
        <DashboardWelcomeBanner
          firstName={firstName}
          roleLabel={roleLabel}
          roleKeys={auth.roleKeys}
          showRoleLabel
          headline={welcomeHeadline}
        >
          <p className="font-body text-sm leading-relaxed text-slate-400">
            Client payments in, salaries &amp; ops out — all amounts in{" "}
            <span className="font-medium text-slate-300">Kenyan Shillings (KES)</span>. Pick a section
            from the sidebar or use quick links below.
          </p>
        </DashboardWelcomeBanner>
      </header>

      {/* Primary KPIs — equal card grid */}
      <section aria-label="Key metrics">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>This month (UTC)</DashboardSectionLabel>
        <div className="mt-3">
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
        </div>
      </section>

      {/* Quick navigation */}
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

      {/* Live analytics — balanced 2-column layout */}
      <WorkspaceLiveAnalytics variant={analyticsVariant} compact className="border-0 pb-0" />

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
