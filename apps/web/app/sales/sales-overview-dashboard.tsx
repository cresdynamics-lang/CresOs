"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import { SalesStatInline, SalesStatRow } from "../../components/sales/sales-ui";
import { salesNeu } from "../../components/sales/sales-theme";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import {
  WorkspaceAlignedTips,
  WorkspaceDashboardSection,
  WorkspacePriorityGrid,
  dedupeAiHint,
  dedupeFocusTips,
  type WorkspacePriorityItem
} from "../../components/workspace/workspace-dashboard-primitives";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";

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

export type SalesQueueStats = {
  unreadNotifications: number;
  messagesToReply: number;
  dueToday: number;
  visibleProjects: number;
  reportStreakDays: number;
  workProgressPercent: number;
};

const QUICK_LINKS = [
  { href: "/sales/messages", label: "Mail" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/leads", label: "Leads" },
  { href: "/crm", label: "CRM" },
  { href: "/reports", label: "Reports" },
  { href: "/reports/new", label: "Submit report" },
  { href: "/projects", label: "Projects" },
  { href: "/schedule", label: "Tasks" },
  { href: "/community", label: "Community" }
] as const;

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
  queue: SalesQueueStats | null;
  reportReminderDue: boolean;
  focusTips: string[];
  aiHint: string | null;
  isSalesRep: boolean;
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
  queue,
  reportReminderDue,
  focusTips,
  aiHint,
  isSalesRep,
  onRefresh
}: SalesOverviewDashboardProps) {
  const { auth } = useAuth();
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  const alertItems = useMemo((): WorkspacePriorityItem[] => {
    const items: WorkspacePriorityItem[] = [];

    if (reportReminderDue) {
      items.push({
        id: "report-due",
        tone: "danger",
        title: "Submit your sales report",
        detail: "It's been 12+ hours since your last report. Leadership uses this for pipeline alignment.",
        href: "/reports/new",
        action: "Submit now"
      });
    }

    if ((queue?.unreadNotifications ?? 0) > 0) {
      items.push({
        id: "unread-notifs",
        tone: "warning",
        title: `${queue!.unreadNotifications} unread notification${queue!.unreadNotifications === 1 ? "" : "s"}`,
        detail: "Clear the bell and Community so messages don't pile up.",
        href: "/community",
        action: "Open Community"
      });
    }

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
        detail: "Answer director questions on your reports.",
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
  }, [alerts, overdueReportQuestions, queue, reportReminderDue, scheduleKpis]);

  const alignedTips = useMemo(
    () =>
      dedupeFocusTips(focusTips, {
        reportReminderDue,
        overdueReportQuestions,
        hasUnreadAlert: (queue?.unreadNotifications ?? 0) > 0,
        hasOutstandingInvoiceAlert: alerts.outstandingInvoices > 0 && alerts.overdueInvoices === 0,
        hasOverdueInvoiceAlert: alerts.overdueInvoices > 0,
        priorityTitles: alertItems.map((a) => a.title)
      }),
    [focusTips, reportReminderDue, overdueReportQuestions, queue, alerts, alertItems]
  );

  const alignedHint = useMemo(
    () => dedupeAiHint(aiHint, alignedTips, { reportReminderDue }),
    [aiHint, alignedTips, reportReminderDue]
  );

  const taskBars = charts.tasks.map((t, idx) => ({
    label: t.label,
    value: t.value,
    color: CHART_COLORS[idx % CHART_COLORS.length]
  }));

  const messageHref = (queue?.messagesToReply ?? 0) > 0 ? "/reports" : "/community";

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            Sales
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {welcomeHeadline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Your pipeline queue and charts — use the sidebar to jump between CRM, reports, invoices, and tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${salesNeu.navIdle} shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {alertItems.length > 0 ? (
        <WorkspaceDashboardSection label="Today's priorities" roleKeys={auth.roleKeys}>
          <WorkspacePriorityGrid
            items={alertItems}
            panelClass={(tone) => (tone === "danger" ? salesNeu.alertDanger : salesNeu.alertWarning)}
          />
        </WorkspaceDashboardSection>
      ) : null}

      {isSalesRep ? (
        <WorkspaceAlignedTips
          tips={alignedTips}
          aiHint={alignedHint}
          panelClass={`${salesNeu.panelInset} p-4 sm:p-5`}
          roleKeys={auth.roleKeys}
        />
      ) : null}

      <WorkspaceDashboardSection label="Your queue" roleKeys={auth.roleKeys}>
        <div className={`mt-3 ${salesNeu.kpiStrip}`}>
          <SalesStatRow>
            <Link href="/community" className="min-w-0 hover:opacity-90">
              <SalesStatInline
                label="Notifications"
                value={loading ? "…" : (queue?.unreadNotifications ?? 0)}
                hint="Unread in-app"
                tone={(queue?.unreadNotifications ?? 0) > 0 ? "rose" : "sky"}
              />
            </Link>
            <Link href={messageHref} className="min-w-0 hover:opacity-90">
              <SalesStatInline
                label="Messages"
                value={loading ? "…" : (queue?.messagesToReply ?? 0)}
                hint="Need reply"
                tone={(queue?.messagesToReply ?? 0) > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/leads" className="min-w-0 hover:opacity-90">
              <SalesStatInline
                label="Due today"
                value={loading ? "…" : (queue?.dueToday ?? 0)}
                hint="Follow-ups"
                tone={(queue?.dueToday ?? 0) > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/projects" className="min-w-0 hover:opacity-90">
              <SalesStatInline
                label="Projects"
                value={loading ? "…" : (queue?.visibleProjects ?? 0)}
                hint="Active / in-flight"
                tone="violet"
              />
            </Link>
          </SalesStatRow>
          {isSalesRep ? (
            <SalesStatRow className="mt-6 border-t border-white/[0.06] pt-6">
              <SalesStatInline
                label="Report streak"
                value={loading ? "…" : (queue?.reportStreakDays ?? 0)}
                hint="Consecutive days"
                tone="amber"
              />
              <SalesStatInline
                label="Work progress"
                value={loading ? "…" : `${queue?.workProgressPercent ?? 0}%`}
                hint="Delivery"
                tone="emerald"
              />
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
            </SalesStatRow>
          ) : null}
        </div>
      </WorkspaceDashboardSection>

      {!isSalesRep && (
        <WorkspaceDashboardSection label="Pipeline snapshot" roleKeys={auth.roleKeys}>
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
        </WorkspaceDashboardSection>
      )}

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

      {isSalesRep && (
        <section aria-label="Work history" className={`w-full ${salesNeu.panelInset}`}>
          <h3 className="text-sm font-semibold text-slate-200">Your work history (read-only)</h3>
          <p className="mt-2 text-sm text-slate-400">
            Past report submissions stay on record. File new daily reports anytime — they won&apos;t overwrite locked
            entries.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/reports" className={`${salesNeu.navIdle} rounded-lg px-3 py-2 text-sm font-medium`}>
              Sales reports →
            </Link>
            <Link href="/reports/new" className={`${salesNeu.btnPrimary} inline-flex rounded-lg px-3 py-2 text-sm`}>
              Submit report
            </Link>
          </div>
        </section>
      )}
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
