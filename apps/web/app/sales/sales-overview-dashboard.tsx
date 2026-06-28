"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import {
  DashboardSectionLabel,
  DashboardWelcomeBanner
} from "../../components/dashboard-welcome-banner";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import { SalesNeuPanel, SalesStatCard, SalesStatGrid } from "../../components/sales/sales-ui";
import { salesNeu } from "../../components/sales/sales-theme";
import { ScheduleKpiStrip, type ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import { buildWelcomeHeadline, getDisplayFirstName } from "../../lib/personalized-greeting";

export type SalesDashboardData = {
  stats: {
    total: number;
    outstanding: number;
    paid: number;
    cancelled: number;
    overdue?: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  kpis?: {
    leadsThisWeek: number;
    activeDeals: number;
    wonDeals: number;
    activeProjects: number;
  };
  charts?: {
    invoicesByStatus: { label: string; value: number }[];
    dealsByStage: { label: string; value: number }[];
    projectsByStatus: { label: string; value: number }[];
  };
  alerts?: {
    outstandingInvoices: number;
    overdueInvoices: number;
    leadsPendingApproval: number;
    dealsInProspect: number;
  };
};

const QUICK_LINKS = [
  { href: "/sales/messages", label: "Mail" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/leads", label: "Leads" },
  { href: "/crm", label: "CRM" },
  { href: "/reports", label: "Reports" },
  { href: "/projects", label: "Projects" },
  { href: "/schedule", label: "Tasks" },
  { href: "/community", label: "Community" },
  { href: "/settings/account", label: "Settings" }
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
  dashboard: SalesDashboardData | null;
  loading: boolean;
  scheduleKpis: ScheduleKpiStats | null;
  overdueReportQuestions: number;
};

export function SalesOverviewDashboard({
  dashboard,
  loading,
  scheduleKpis,
  overdueReportQuestions
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

  const alerts = useMemo((): SalesAlert[] => {
    if (!dashboard?.alerts) return [];
    const a = dashboard.alerts;
    const items: SalesAlert[] = [];
    if (a.overdueInvoices > 0) {
      items.push({
        id: "overdue-invoices",
        tone: "danger",
        title: `${a.overdueInvoices} overdue invoice${a.overdueInvoices === 1 ? "" : "s"}`,
        detail: "Follow up with clients before finance escalates collection.",
        href: "/sales/invoices",
        action: "Open invoices"
      });
    } else if (a.outstandingInvoices > 0) {
      items.push({
        id: "outstanding-invoices",
        tone: "warning",
        title: `${a.outstandingInvoices} invoice${a.outstandingInvoices === 1 ? "" : "s"} awaiting payment`,
        detail: "Draft, sent, or partial invoices still open in the pipeline.",
        href: "/sales/invoices",
        action: "Review invoices"
      });
    }
    if (a.leadsPendingApproval > 0) {
      items.push({
        id: "leads-pending",
        tone: "warning",
        title: `${a.leadsPendingApproval} lead${a.leadsPendingApproval === 1 ? "" : "s"} need director approval`,
        detail: "New leads stay blocked until leadership approves them.",
        href: "/leads",
        action: "View leads"
      });
    }
    if (a.dealsInProspect > 3) {
      items.push({
        id: "deals-prospect",
        tone: "warning",
        title: `${a.dealsInProspect} deals still in prospect`,
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
        detail: "Answer director questions within 24 hours to stay aligned.",
        href: "/reports",
        action: "Answer now"
      });
    }
    if (scheduleKpis && scheduleKpis.pending > 0 && scheduleKpis.completed === 0) {
      items.push({
        id: "tasks-pending",
        tone: "warning",
        title: `${scheduleKpis.pending} task${scheduleKpis.pending === 1 ? "" : "s"} still open this week`,
        detail: "Complete scheduled tasks to keep delivery on track.",
        href: "/schedule",
        action: "Open tasks"
      });
    }
    return items;
  }, [dashboard?.alerts, overdueReportQuestions, scheduleKpis]);

  const taskProgressItems = scheduleKpis
    ? [
        { label: "Done", value: scheduleKpis.completed, color: "bg-emerald-500" },
        { label: "Pending", value: scheduleKpis.pending, color: "bg-amber-500" }
      ].filter((i) => i.value > 0)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-4">
      <header className="space-y-4">
        <DashboardWelcomeBanner
          firstName={firstName}
          roleLabel="Sales"
          roleKeys={auth.roleKeys}
          showRoleLabel
          headline={welcomeHeadline}
        >
          <p className="font-body text-sm leading-relaxed text-slate-400">
            Pipeline, invoices, delivery handoffs, and daily reports in one workspace. Pick a section from the
            sidebar or use quick links below.
          </p>
        </DashboardWelcomeBanner>
      </header>

      {alerts.length > 0 && (
        <section aria-label="Alerts">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Needs attention</DashboardSectionLabel>
          <ul className="mt-3 space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={alert.tone === "danger" ? salesNeu.alertDanger : salesNeu.alertWarning}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
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
                        ? "bg-rose-600/80 text-white hover:bg-rose-500"
                        : "bg-amber-600/80 text-white hover:bg-amber-500"
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

      <section aria-label="Key metrics">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Pipeline snapshot</DashboardSectionLabel>
        <div className="mt-3">
          <SalesStatGrid>
            <SalesStatCard
              label="Leads this week"
              value={loading ? "…" : (dashboard?.kpis?.leadsThisWeek ?? "—")}
              hint="New leads captured"
              tone="sky"
            />
            <SalesStatCard
              label="Active deals"
              value={loading ? "…" : (dashboard?.kpis?.activeDeals ?? "—")}
              hint="Prospect & proposal"
              tone="amber"
            />
            <SalesStatCard
              label="Won deals"
              value={loading ? "…" : (dashboard?.kpis?.wonDeals ?? "—")}
              hint="Closed successfully"
              tone="emerald"
            />
            <SalesStatCard
              label="Open invoices"
              value={loading ? "…" : (dashboard?.stats.outstanding ?? "—")}
              hint={`${dashboard?.stats.paid ?? 0} paid · ${dashboard?.stats.overdue ?? 0} overdue`}
              tone="violet"
            />
          </SalesStatGrid>
        </div>
      </section>

      <nav
        aria-label="Sales quick links"
        className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-6"
      >
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

      {scheduleKpis && (
        <section aria-label="Weekly tasks">
          <SalesNeuPanel inset className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">This week — tasks & schedule</h2>
              <Link href="/schedule" className={`${salesNeu.btnPrimary} text-xs`}>
                Open tasks →
              </Link>
            </div>
            <ScheduleKpiStrip stats={scheduleKpis} />
          </SalesNeuPanel>
        </section>
      )}

      <section aria-label="Progress charts">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Progress charts</DashboardSectionLabel>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <SalesNeuPanel inset className="p-4 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Invoice status mix
            </h3>
            <div className="mt-4">
              <PieChart
                items={dashboard?.charts?.invoicesByStatus ?? []}
                emptyLabel={loading ? "Loading…" : "No invoices yet"}
              />
            </div>
          </SalesNeuPanel>

          <SalesNeuPanel inset className="p-4 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Deal pipeline by stage
            </h3>
            <div className="mt-4">
              <PieChart
                items={dashboard?.charts?.dealsByStage ?? []}
                emptyLabel={loading ? "Loading…" : "No deals yet — add from CRM"}
              />
            </div>
          </SalesNeuPanel>

          <SalesNeuPanel inset className="p-4 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Projects by status
            </h3>
            <div className="mt-4">
              <HorizontalBarChart
                items={(dashboard?.charts?.projectsByStatus ?? []).map((p, idx) => ({
                  label: p.label.replace(/_/g, " "),
                  value: p.value,
                  color: ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-violet-500"][idx % 4]
                }))}
                emptyLabel={loading ? "Loading…" : "No projects yet"}
              />
            </div>
          </SalesNeuPanel>

          <SalesNeuPanel inset className="p-4 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Weekly task progress
            </h3>
            <div className="mt-4">
              {taskProgressItems.length > 0 ? (
                <VerticalBarChart items={taskProgressItems} />
              ) : (
                <p className="text-xs text-slate-500">
                  {scheduleKpis ? "No tasks logged this week" : "Loading schedule…"}
                </p>
              )}
            </div>
          </SalesNeuPanel>
        </div>
      </section>

      <section aria-label="How data stays in sync">
        <SalesNeuPanel inset className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-200">How your numbers stay in sync</h2>
          <p className="mt-1 text-xs text-slate-500">
            Charts pull live data from invoices, CRM deals, projects, and your task schedule.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FlowStep
              source="Leads & CRM"
              detail="New leads and deal stages feed the pipeline charts."
              feeds="Leads KPI · Deal pie chart"
            />
            <FlowStep
              source="Sales invoices"
              detail="Draft through paid status on invoices you create."
              feeds="Invoice pie · Open invoices KPI"
            />
            <FlowStep
              source="Projects"
              detail="Delivery status across active client work."
              feeds="Projects bar chart · Active projects KPI"
            />
            <FlowStep
              source="Tasks"
              detail="Your weekly schedule completion and overdue counts."
              feeds="Task bar chart · Overdue alerts"
            />
          </ol>
        </SalesNeuPanel>
      </section>
    </div>
  );
}

function FlowStep({ source, detail, feeds }: { source: string; detail: string; feeds: string }) {
  return (
    <li className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">{source}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        → <span className="text-slate-300">{feeds}</span>
      </p>
    </li>
  );
}
