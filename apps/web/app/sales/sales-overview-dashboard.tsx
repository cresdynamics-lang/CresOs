"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import { SalesStatInline, SalesStatRow } from "../../components/sales/sales-ui";
import { salesNeu } from "../../components/sales/sales-theme";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import {
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

const CHART_COLORS = ["bg-[#005CAB]", "bg-[#5C2D91]", "bg-[#0B6A0B]", "bg-[#C19C00]", "bg-[#C50F1F]"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[#8A8886]">{children}</p>;
}

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
        title: "Submit today's report",
        detail: "File your sales report for leadership.",
        href: "/reports/new",
        action: "Submit"
      });
    }

    if ((queue?.unreadNotifications ?? 0) > 0) {
      items.push({
        id: "unread-notifs",
        tone: "warning",
        title: `${queue!.unreadNotifications} unread`,
        detail: "Clear notifications.",
        href: "/community",
        action: "Open"
      });
    }

    if (alerts.overdueInvoices > 0) {
      items.push({
        id: "overdue-invoices",
        tone: "danger",
        title: `${alerts.overdueInvoices} overdue invoice${alerts.overdueInvoices === 1 ? "" : "s"}`,
        detail: "Follow up before collection escalates.",
        href: "/sales/invoices",
        action: "Invoices"
      });
    } else if (alerts.outstandingInvoices > 0) {
      items.push({
        id: "outstanding-invoices",
        tone: "warning",
        title: `${alerts.outstandingInvoices} open invoice${alerts.outstandingInvoices === 1 ? "" : "s"}`,
        detail: "Awaiting payment.",
        href: "/sales/invoices",
        action: "Review"
      });
    }

    if (alerts.leadsPendingApproval > 0) {
      items.push({
        id: "leads-pending",
        tone: "warning",
        title: `${alerts.leadsPendingApproval} lead${alerts.leadsPendingApproval === 1 ? "" : "s"} need approval`,
        detail: "Blocked until leadership approves.",
        href: "/leads",
        action: "Leads"
      });
    }

    if (alerts.dealsInProspect > 3) {
      items.push({
        id: "deals-prospect",
        tone: "warning",
        title: `${alerts.dealsInProspect} deals in prospect`,
        detail: "Advance or qualify pipeline.",
        href: "/crm",
        action: "CRM"
      });
    }

    if (overdueReportQuestions > 0) {
      items.push({
        id: "report-questions",
        tone: "danger",
        title: `${overdueReportQuestions} report Q overdue`,
        detail: "Answer director questions.",
        href: "/reports",
        action: "Answer"
      });
    }

    if (scheduleKpis && scheduleKpis.pending > 0 && scheduleKpis.completed === 0) {
      items.push({
        id: "tasks-pending",
        tone: "warning",
        title: `${scheduleKpis.pending} open task${scheduleKpis.pending === 1 ? "" : "s"}`,
        detail: "This week's schedule.",
        href: "/schedule",
        action: "Tasks"
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
      }).slice(0, 3),
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

  const panelForTone = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return salesNeu.alertDanger;
    if (tone === "warning") return salesNeu.alertWarning;
    return salesNeu.alertInfo;
  };

  const actionColor = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return "bg-[#C50F1F] hover:bg-[#A50D1A]";
    if (tone === "warning") return "bg-[#C19C00] hover:bg-[#A68500]";
    return "bg-[#005CAB] hover:bg-[#004A8C]";
  };

  return (
    <div className={`${salesNeu.workspace} flex w-full min-w-0 flex-1 flex-col gap-3 bg-white pb-4`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1DFDD] pb-3">
        <div className="min-w-0">
          <p className={salesNeu.eyebrow}>Sales</p>
          <h1 className={`mt-0.5 ${salesNeu.title}`}>{welcomeHeadline}</h1>
          <p className={`mt-0.5 max-w-xl ${salesNeu.body}`}>Pipeline, invoices, and reports.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${salesNeu.btnGhost} shrink-0 disabled:opacity-50`}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </header>

      {alertItems.length > 0 ? (
        <section>
          <SectionLabel>Today</SectionLabel>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {alertItems.map((item) => (
              <li key={item.id} className={`${panelForTone(item.tone)} px-2.5 py-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold leading-snug text-[#242424]">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#605E5C]">{item.detail}</p>
                  </div>
                  <Link
                    href={item.href}
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-white ${actionColor(item.tone)}`}
                  >
                    {item.action}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isSalesRep && (alignedTips.length > 0 || alignedHint) ? (
        <section className={salesNeu.panelInset}>
          <SectionLabel>Stay aligned</SectionLabel>
          {alignedTips.length > 0 ? (
            <ul className="space-y-1">
              {alignedTips.map((tip) => (
                <li key={tip} className="flex gap-1.5 text-[11px] leading-snug text-[#605E5C]">
                  <span className="text-[#005CAB]" aria-hidden>
                    ·
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {alignedHint ? (
            <p
              className={`text-[11px] leading-snug text-[#5C2D91] ${
                alignedTips.length ? "mt-1.5 border-t border-[#E1DFDD] pt-1.5" : ""
              }`}
            >
              {alignedHint}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <SectionLabel>Your queue</SectionLabel>
        <SalesStatRow>
          <Link href="/community" className="min-w-0">
            <SalesStatInline
              label="Notifications"
              value={loading ? "…" : (queue?.unreadNotifications ?? 0)}
              hint="Unread"
              tone={(queue?.unreadNotifications ?? 0) > 0 ? "rose" : "sky"}
            />
          </Link>
          <Link href={messageHref} className="min-w-0">
            <SalesStatInline
              label="Messages"
              value={loading ? "…" : (queue?.messagesToReply ?? 0)}
              hint="Need reply"
              tone={(queue?.messagesToReply ?? 0) > 0 ? "amber" : "sky"}
            />
          </Link>
          <Link href="/leads" className="min-w-0">
            <SalesStatInline
              label="Due today"
              value={loading ? "…" : (queue?.dueToday ?? 0)}
              hint="Follow-ups"
              tone={(queue?.dueToday ?? 0) > 0 ? "amber" : "sky"}
            />
          </Link>
          <Link href="/projects" className="min-w-0">
            <SalesStatInline
              label="Projects"
              value={loading ? "…" : (queue?.visibleProjects ?? 0)}
              hint="In flight"
              tone="violet"
            />
          </Link>
        </SalesStatRow>
        {isSalesRep ? (
          <SalesStatRow className="mt-2">
            <SalesStatInline
              label="Report streak"
              value={loading ? "…" : (queue?.reportStreakDays ?? 0)}
              hint="Days"
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
              hint="New"
              tone="sky"
            />
            <SalesStatInline
              label="Active deals"
              value={loading ? "…" : (kpis?.activeDeals ?? 0)}
              hint="Pipeline"
              tone="amber"
            />
          </SalesStatRow>
        ) : null}
      </section>

      {!isSalesRep ? (
        <section>
          <SectionLabel>Pipeline snapshot</SectionLabel>
          <SalesStatRow>
            <SalesStatInline
              label="Leads this week"
              value={loading ? "…" : (kpis?.leadsThisWeek ?? 0)}
              hint="New"
              tone="sky"
            />
            <SalesStatInline
              label="Active deals"
              value={loading ? "…" : (kpis?.activeDeals ?? 0)}
              hint="Pipeline"
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
              hint={`${kpis?.paidInvoices ?? 0} paid · ${kpis?.overdueInvoices ?? 0} late`}
              tone="violet"
            />
          </SalesStatRow>
        </section>
      ) : null}

      <nav aria-label="Sales quick links" className="flex flex-wrap gap-1.5 border-b border-[#E1DFDD] pb-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-[#E1DFDD] bg-white px-2 py-1 text-[11px] font-semibold text-[#605E5C] hover:border-[#005CAB]/40 hover:text-[#005CAB]"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section>
        <div className="mb-1.5 flex flex-wrap items-end justify-between gap-1">
          <SectionLabel>Progress</SectionLabel>
          {scheduleKpis ? (
            <p className={salesNeu.muted}>
              Week: {scheduleKpis.completed} done · {scheduleKpis.pending} pending
            </p>
          ) : null}
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2">
          <ChartPanel title="Invoices">
            <PieChart
              items={charts.invoices}
              size={140}
              emptyLabel={loading ? "Loading…" : "No invoices yet"}
            />
          </ChartPanel>

          <ChartPanel title="Deal stages">
            <PieChart items={charts.deals} size={140} emptyLabel={loading ? "Loading…" : "No deals yet"} />
          </ChartPanel>

          <ChartPanel title="Projects">
            <HorizontalBarChart
              items={charts.projects.map((p, idx) => ({
                label: p.label.replace(/_/g, " "),
                value: p.value,
                color: CHART_COLORS[idx % CHART_COLORS.length]
              }))}
              emptyLabel={loading ? "Loading…" : "No projects yet"}
            />
          </ChartPanel>

          <ChartPanel title="This week">
            {taskBars.length > 0 ? (
              <VerticalBarChart items={taskBars} />
            ) : (
              <p className="text-[11px] text-[#605E5C]">{loading ? "Loading…" : "No tasks this week"}</p>
            )}
          </ChartPanel>
        </div>
      </section>

      {isSalesRep ? (
        <section className={salesNeu.panelInset}>
          <p className="text-[12px] font-semibold text-[#242424]">Work history</p>
          <p className="mt-1 text-[11px] leading-snug text-[#605E5C]">
            Past reports stay on record. New daily entries don&apos;t overwrite locked ones.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              href="/reports"
              className="rounded-md border border-[#E1DFDD] px-2 py-1 text-[11px] font-semibold text-[#605E5C] hover:border-[#005CAB]/40 hover:text-[#005CAB]"
            >
              Reports →
            </Link>
            <Link href="/reports/new" className={salesNeu.btnPrimary}>
              Submit report
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={salesNeu.chartPanel}>
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[#005CAB]" aria-hidden />
      <h3 className="text-[10px] font-semibold tracking-wide text-[#005CAB]">{title}</h3>
      <div className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}
