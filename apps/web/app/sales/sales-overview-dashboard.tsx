"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import { SalesStatInline, SalesStatRow } from "../../components/sales/sales-ui";
import { salesNeu } from "../../components/sales/sales-theme";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import { buildWelcomeHeadline, getDisplayFirstName } from "../../lib/personalized-greeting";

export type SalesChartSlice = { label: string; value: number };

export type SalesOverviewKpis = {
  leadsThisWeek: number;
  activeDeals: number;
  wonDeals: number;
  activeProjects: number;
  openInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
};

const QUICK_LINKS = [
  { href: "/sales/messages", label: "Mail" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/leads", label: "Leads" },
  { href: "/crm", label: "CRM" },
  { href: "/reports", label: "Reports" },
  { href: "/projects", label: "Projects" },
  { href: "/schedule", label: "Tasks" },
  { href: "/community", label: "Community" }
] as const;

type SalesAlert = {
  id: string;
  tone: "warning" | "danger";
  title: string;
  detail: string;
  href: string;
  action: string;
};

type SalesOverviewDashboardProps = {
  kpis: SalesOverviewKpis | null;
  charts: {
    invoices: SalesChartSlice[];
    deals: SalesChartSlice[];
    projects: SalesChartSlice[];
    tasks: SalesChartSlice[];
  };
  alerts: {
    outstandingInvoices: number;
    overdueInvoices: number;
    leadsPendingApproval: number;
    dealsInProspect: number;
  };
  loading: boolean;
  scheduleKpis: ScheduleKpiStats | null;
  overdueReportQuestions: number;
  onRefresh: () => void;
};

const CHART_COLORS = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

export function SalesOverviewDashboard({
  kpis,
  charts,
  alerts,
  loading,
  scheduleKpis,
  overdueReportQuestions,
  onRefresh
}: SalesOverviewDashboardProps) {
  const { auth } = useAuth();
  const firstName = useMemo(
    () => getDisplayFirstName(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  const alertItems = useMemo((): SalesAlert[] => {
    const items: SalesAlert[] = [];
    if (alerts.overdueInvoices > 0) {
      items.push({
        id: "overdue-invoices",
        tone: "danger",
        title: `${alerts.overdueInvoices} overdue invoice${alerts.overdueInvoices === 1 ? "" : "s"}`,
        detail: "Follow up with clients before finance escalates collection.",
        href: "/sales/invoices",
        action: "Open invoices"
      });
    } else if (alerts.outstandingInvoices > 0) {
      items.push({
        id: "outstanding-invoices",
        tone: "warning",
        title: `${alerts.outstandingInvoices} open invoice${alerts.outstandingInvoices === 1 ? "" : "s"}`,
        detail: "Draft, sent, or partial invoices still awaiting payment.",
        href: "/sales/invoices",
        action: "Review invoices"
      });
    }
    if (alerts.leadsPendingApproval > 0) {
      items.push({
        id: "leads-pending",
        tone: "warning",
        title: `${alerts.leadsPendingApproval} lead${alerts.leadsPendingApproval === 1 ? "" : "s"} need approval`,
        detail: "New leads stay blocked until leadership approves them.",
        href: "/leads",
        action: "View leads"
      });
    }
    if (alerts.dealsInProspect > 3) {
      items.push({
        id: "deals-prospect",
        tone: "warning",
        title: `${alerts.dealsInProspect} deals in prospect`,
        detail: "Move qualified deals to proposal or won to keep pipeline velocity.",
        href: "/crm",
        action: "Open CRM"
      });
    }
    if (overdueReportQuestions > 0) {
      items.push({
        id: "report-questions",
        tone: "danger",
        title: `${overdueReportQuestions} report question${overdueReportQuestions === 1 ? "" : "s"} overdue`,
        detail: "Answer director questions within 24 hours.",
        href: "/reports",
        action: "Answer now"
      });
    }
    if (scheduleKpis && scheduleKpis.pending > 0 && scheduleKpis.completed === 0) {
      items.push({
        id: "tasks-pending",
        tone: "warning",
        title: `${scheduleKpis.pending} open task${scheduleKpis.pending === 1 ? "" : "s"} this week`,
        detail: "Complete scheduled tasks to keep delivery on track.",
        href: "/schedule",
        action: "Open tasks"
      });
    }
    return items;
  }, [alerts, overdueReportQuestions, scheduleKpis]);

  const taskBars = charts.tasks.map((t, idx) => ({
    label: t.label,
    value: t.value,
    color: CHART_COLORS[idx % CHART_COLORS.length]
  }));

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            Sales workspace
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {welcomeHeadline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Full-screen pipeline view for {firstName} — live charts from CRM, invoices, projects, and your weekly
            schedule.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${salesNeu.navIdle} shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh data"}
        </button>
      </header>

      {alertItems.length > 0 && (
        <section aria-label="Alerts" className="w-full">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Needs attention</DashboardSectionLabel>
          <ul className="mt-3 grid w-full gap-3 lg:grid-cols-2">
            {alertItems.map((alert) => (
              <li
                key={alert.id}
                className={alert.tone === "danger" ? salesNeu.alertDanger : salesNeu.alertWarning}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p
                      className={`font-semibold ${alert.tone === "danger" ? "text-rose-200" : "text-amber-200"}`}
                    >
                      {alert.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{alert.detail}</p>
                  </div>
                  <Link
                    href={alert.href}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      alert.tone === "danger"
                        ? "bg-rose-600/90 text-white hover:bg-rose-500"
                        : "bg-amber-600/90 text-white hover:bg-amber-500"
                    }`}
                  >
                    {alert.action} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Key metrics" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Pipeline snapshot</DashboardSectionLabel>
        <div className={`mt-3 ${salesNeu.kpiStrip}`}>
          <SalesStatRow>
            <SalesStatInline
              label="Leads this week"
              value={loading ? "…" : (kpis?.leadsThisWeek ?? 0)}
              hint="New captures"
              tone="sky"
            />
            <SalesStatInline
              label="Active deals"
              value={loading ? "…" : (kpis?.activeDeals ?? 0)}
              hint="Prospect & proposal"
              tone="amber"
            />
            <SalesStatInline
              label="Won deals"
              value={loading ? "…" : (kpis?.wonDeals ?? 0)}
              hint="Closed"
              tone="emerald"
            />
            <SalesStatInline
              label="Open invoices"
              value={loading ? "…" : (kpis?.openInvoices ?? 0)}
              hint={`${kpis?.paidInvoices ?? 0} paid · ${kpis?.overdueInvoices ?? 0} overdue`}
              tone="violet"
            />
          </SalesStatRow>
        </div>
      </section>

      <nav aria-label="Sales quick links" className="flex w-full flex-wrap gap-2 border-b border-white/[0.06] pb-5">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${salesNeu.navIdle} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section aria-label="Progress charts" className="w-full flex-1">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Progress charts</DashboardSectionLabel>
          {scheduleKpis ? (
            <p className="text-xs text-slate-500">
              Tasks this week: {scheduleKpis.completed} done · {scheduleKpis.pending} pending · {scheduleKpis.total}{" "}
              total
            </p>
          ) : null}
        </div>

        <div className="grid w-full gap-4 xl:grid-cols-2">
          <ChartPanel title="Invoice status mix">
            <PieChart
              items={charts.invoices}
              size={220}
              emptyLabel={loading ? "Loading invoice data…" : "No invoices yet — create one under Invoices"}
            />
          </ChartPanel>

          <ChartPanel title="Deal pipeline by stage">
            <PieChart
              items={charts.deals}
              size={220}
              emptyLabel={loading ? "Loading deals…" : "No deals yet — add from CRM"}
            />
          </ChartPanel>

          <ChartPanel title="Projects by status">
            <HorizontalBarChart
              items={charts.projects.map((p, idx) => ({
                label: p.label.replace(/_/g, " "),
                value: p.value,
                color: CHART_COLORS[idx % CHART_COLORS.length]
              }))}
              emptyLabel={loading ? "Loading projects…" : "No projects in org yet"}
            />
          </ChartPanel>

          <ChartPanel title="Weekly task progress">
            {taskBars.length > 0 ? (
              <VerticalBarChart items={taskBars} />
            ) : (
              <p className="text-sm text-slate-500">
                {loading ? "Loading schedule…" : "No tasks scheduled this week — open Tasks to plan your week"}
              </p>
            )}
          </ChartPanel>
        </div>
      </section>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={salesNeu.chartPanel}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">{title}</h3>
      <div className="mt-5 flex flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}
