"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import { DevStatInline, DevStatRow } from "../../components/developer/developer-ui";
import { devNeu } from "../../components/developer/developer-theme";
import type { DeveloperProgressReminder } from "../../components/developer-dashboard";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import { buildWelcomeHeadline, getDisplayFirstName } from "../../lib/personalized-greeting";

export type DevProjectRow = {
  id: string;
  name: string;
  progressPercent: number;
  overdueTasks: number;
  blockedTasks: number;
  doneTasks: number;
  taskCount: number;
  status: string;
};

export type DevQueueStats = {
  assignedProjects: number;
  overdueTasks: number;
  blockedTasks: number;
  avgProgress: number;
  reportStreakDays: number;
  workProgressPercent: number;
  unreadNotifications: number;
};

type DevAlert = {
  id: string;
  tone: "warning" | "danger" | "info";
  title: string;
  detail: string;
  href: string;
  action: string;
};

const QUICK_LINKS = [
  { href: "/schedule", label: "Tasks" },
  { href: "/developer-reports", label: "Reports" },
  { href: "/projects", label: "Projects" },
  { href: "/community", label: "Community" },
  { href: "/settings/account", label: "Settings" }
] as const;

const CHART_COLORS = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

type DeveloperOverviewDashboardProps = {
  queue: DevQueueStats;
  projects: DevProjectRow[];
  scheduleKpis: ScheduleKpiStats | null;
  reportReminderDue: boolean;
  progressReminders: DeveloperProgressReminder[];
  pendingPayments: {
    id: string;
    amount: string | number;
    spentAt: string;
    description: string | null;
    currency?: string;
  }[];
  loading: boolean;
  loadError?: string | null;
  onRefresh: () => void;
  onAckPayment: (id: string) => void;
  onDismissReminder: (key: string) => void;
  dismissedReminderKeys: Set<string>;
};

export function DeveloperOverviewDashboard({
  queue,
  projects,
  scheduleKpis,
  reportReminderDue,
  progressReminders,
  pendingPayments,
  loading,
  loadError,
  onRefresh,
  onAckPayment,
  onDismissReminder,
  dismissedReminderKeys
}: DeveloperOverviewDashboardProps) {
  const { auth } = useAuth();
  const firstName = useMemo(
    () => getDisplayFirstName(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  const visibleReminders = progressReminders.filter((r) => !dismissedReminderKeys.has(r.reminderKey));

  const alertItems = useMemo((): DevAlert[] => {
    const items: DevAlert[] = [];
    if (reportReminderDue) {
      items.push({
        id: "report-due",
        tone: "danger",
        title: "Submit your developer report",
        detail: "File today's report so leadership stays aligned on delivery.",
        href: "/developer-reports",
        action: "Submit now"
      });
    }
    if (queue.overdueTasks > 0) {
      items.push({
        id: "overdue-tasks",
        tone: "danger",
        title: `${queue.overdueTasks} overdue task${queue.overdueTasks === 1 ? "" : "s"}`,
        detail: "Clear overdue work on your assigned projects.",
        href: "/schedule",
        action: "Open tasks"
      });
    }
    if (queue.blockedTasks > 0) {
      items.push({
        id: "blocked-tasks",
        tone: "warning",
        title: `${queue.blockedTasks} blocked task${queue.blockedTasks === 1 ? "" : "s"}`,
        detail: "Unblock or escalate so delivery keeps moving.",
        href: "/projects",
        action: "View projects"
      });
    }
    for (const r of visibleReminders.slice(0, 2)) {
      items.push({
        id: r.reminderKey,
        tone: r.severity === "warning" ? "warning" : "info",
        title: r.subject,
        detail: r.body,
        href: r.projectId ? `/projects/${r.projectId}` : "/projects",
        action: "Open"
      });
    }
    return items;
  }, [queue, reportReminderDue, visibleReminders]);

  const projectBars = projects
    .slice(0, 8)
    .map((p, idx) => {
      const name = p.name?.trim() || "Project";
      return {
        label: name.length > 22 ? `${name.slice(0, 22)}…` : name,
        value: p.progressPercent ?? 0,
        color: CHART_COLORS[idx % CHART_COLORS.length]
      };
    });

  const taskMix = useMemo(() => {
    const done = projects.reduce((s, p) => s + p.doneTasks, 0);
    const total = projects.reduce((s, p) => s + p.taskCount, 0);
    const overdue = projects.reduce((s, p) => s + p.overdueTasks, 0);
    const blocked = projects.reduce((s, p) => s + p.blockedTasks, 0);
    const pending = Math.max(0, total - done - overdue - blocked);
    return [
      { label: "done", value: done },
      { label: "pending", value: pending },
      { label: "overdue", value: overdue },
      { label: "blocked", value: blocked }
    ].filter((s) => s.value > 0);
  }, [projects]);

  const taskBars =
    scheduleKpis != null
      ? [
          { label: "done", value: scheduleKpis.completed, color: "bg-emerald-500" },
          { label: "pending", value: scheduleKpis.pending, color: "bg-violet-500" }
        ].filter((t) => t.value > 0)
      : [];

  const alertClass = (tone: DevAlert["tone"]) => {
    if (tone === "danger") return devNeu.alertDanger;
    if (tone === "warning") return devNeu.alertWarning;
    return devNeu.alertInfo;
  };

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/90">
            Developer
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {welcomeHeadline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            {firstName}, your delivery queue and project progress — use the sidebar for tasks, reports, and
            projects.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${devNeu.navIdle} shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {loadError ? (
        <div className={`${devNeu.alertWarning} px-4 py-3 sm:px-5`}>
          <p className="text-sm text-amber-200">{loadError}</p>
        </div>
      ) : null}

      {pendingPayments.length > 0 && (
        <section aria-label="Payment confirmations" className="w-full">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Confirm payments</DashboardSectionLabel>
          <ul className="mt-3 grid w-full gap-3">
            {pendingPayments.map((row) => (
              <li key={row.id} className={devNeu.alertWarning}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-200">Finance payment recorded</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatMoney(Number(row.amount))}
                      {row.currency && row.currency !== "KES" ? ` ${row.currency}` : ""} ·{" "}
                      {row.description?.trim() || "Developer payment"} ·{" "}
                      {new Date(row.spentAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAckPayment(row.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${devNeu.btnPrimary}`}
                  >
                    Confirm receipt
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {alertItems.length > 0 && (
        <section aria-label="Today's priorities" className="w-full">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Today&apos;s priorities</DashboardSectionLabel>
          <ul className="mt-3 grid w-full gap-3 lg:grid-cols-2">
            {alertItems.map((alert) => (
              <li key={alert.id} className={alertClass(alert.tone)}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${
                        alert.tone === "danger"
                          ? "text-rose-200"
                          : alert.tone === "warning"
                            ? "text-amber-200"
                            : "text-violet-200"
                      }`}
                    >
                      {alert.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{alert.detail}</p>
                    {visibleReminders.some((r) => r.reminderKey === alert.id) ? (
                      <button
                        type="button"
                        onClick={() => onDismissReminder(alert.id)}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-300"
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                  <Link
                    href={alert.href}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                      alert.tone === "danger"
                        ? "bg-rose-600/90 hover:bg-rose-500"
                        : alert.tone === "warning"
                          ? "bg-amber-600/90 hover:bg-amber-500"
                          : "bg-violet-600/90 hover:bg-violet-500"
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

      <section aria-label="Delivery snapshot" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Delivery snapshot</DashboardSectionLabel>
        <div className={`mt-3 ${devNeu.kpiStrip}`}>
          <DevStatRow>
            <Link href="/projects" className="min-w-0 hover:opacity-90">
              <DevStatInline
                label="Projects"
                value={loading ? "…" : queue.assignedProjects}
                hint="Assigned to you"
                tone="violet"
              />
            </Link>
            <Link href="/schedule" className="min-w-0 hover:opacity-90">
              <DevStatInline
                label="Overdue tasks"
                value={loading ? "…" : queue.overdueTasks}
                hint="Past due date"
                tone={queue.overdueTasks > 0 ? "rose" : "sky"}
              />
            </Link>
            <DevStatInline
              label="Avg progress"
              value={loading ? "…" : `${queue.avgProgress}%`}
              hint="Across your tasks"
              tone="emerald"
            />
            <DevStatInline
              label="Report streak"
              value={loading ? "…" : queue.reportStreakDays}
              hint="Consecutive days"
              tone="amber"
            />
          </DevStatRow>
          <DevStatRow className="mt-6 border-t border-white/[0.06] pt-6">
            <DevStatInline
              label="Blocked"
              value={loading ? "…" : queue.blockedTasks}
              hint="Needs unblock"
              tone="amber"
            />
            <DevStatInline
              label="Work progress"
              value={loading ? "…" : `${queue.workProgressPercent}%`}
              hint="Org delivery signal"
              tone="sky"
            />
            <Link href="/community" className="min-w-0 hover:opacity-90">
              <DevStatInline
                label="Notifications"
                value={loading ? "…" : queue.unreadNotifications}
                hint="Unread in-app"
                tone={queue.unreadNotifications > 0 ? "rose" : "sky"}
              />
            </Link>
            <Link href="/developer-reports" className="min-w-0 hover:opacity-90">
              <DevStatInline label="Reports" value="File" hint="Daily developer report" tone="violet" />
            </Link>
          </DevStatRow>
        </div>
      </section>

      <nav aria-label="Developer quick links" className="flex w-full flex-wrap gap-2 border-b border-white/[0.06] pb-5">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${devNeu.navIdle} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
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
              Tasks this week: {scheduleKpis.completed} done · {scheduleKpis.pending} pending
            </p>
          ) : null}
        </div>

        <div className="grid w-full gap-4 xl:grid-cols-2">
          <ChartPanel title="Project progress">
            <HorizontalBarChart
              items={projectBars}
              valueSuffix="%"
              emptyLabel={loading ? "Loading projects…" : "No assigned projects yet"}
            />
          </ChartPanel>

          <ChartPanel title="Your task mix">
            <PieChart
              items={taskMix}
              size={220}
              emptyLabel={loading ? "Loading tasks…" : "No tasks assigned yet"}
            />
          </ChartPanel>

          <ChartPanel title="Weekly schedule">
            {taskBars.length > 0 ? (
              <VerticalBarChart items={taskBars} />
            ) : (
              <p className="text-sm text-slate-500">
                {loading ? "Loading schedule…" : "No tasks scheduled this week — plan in Tasks"}
              </p>
            )}
          </ChartPanel>

          <ChartPanel title="Projects needing attention">
            {projects.filter((p) => p.overdueTasks > 0 || p.blockedTasks > 0).length > 0 ? (
              <ul className="w-full space-y-2 text-sm">
                {projects
                  .filter((p) => p.overdueTasks > 0 || p.blockedTasks > 0)
                  .slice(0, 6)
                  .map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                      <Link href={`/projects/${p.id}`} className="truncate text-violet-300 hover:underline">
                        {p.name}
                      </Link>
                      <span className="shrink-0 text-xs text-slate-500">
                        {p.overdueTasks > 0 ? `${p.overdueTasks} overdue` : ""}
                        {p.overdueTasks > 0 && p.blockedTasks > 0 ? " · " : ""}
                        {p.blockedTasks > 0 ? `${p.blockedTasks} blocked` : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{loading ? "Loading…" : "All clear on assigned projects"}</p>
            )}
          </ChartPanel>
        </div>
      </section>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={devNeu.chartPanel}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400/80">{title}</h3>
      <div className="mt-5 flex flex-1 flex-col items-center justify-center w-full">{children}</div>
    </div>
  );
}
