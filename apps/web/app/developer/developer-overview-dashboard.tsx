"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import { DevStatInline, DevStatRow } from "../../components/developer/developer-ui";
import { devNeu } from "../../components/developer/developer-theme";
import type { DeveloperProgressReminder } from "../../components/developer-dashboard";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import {
  dedupeAiHint,
  dedupeFocusTips,
  type WorkspacePriorityItem
} from "../../components/workspace/workspace-dashboard-primitives";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";

export type DevProjectRow = {
  id: string;
  name: string;
  progressPercent: number;
  overdueTasks: number;
  blockedTasks: number;
  doneTasks: number;
  taskCount: number;
  status: string;
  milestoneTotal?: number;
  milestoneCompleted?: number;
};

export type DevQueueStats = {
  assignedProjects: number;
  activeProjects: number;
  overdueTasks: number;
  blockedTasks: number;
  avgProgress: number;
  milestoneSuccessPercent: number;
  reportStreakDays: number;
  workProgressPercent: number;
  unreadNotifications: number;
};

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
  focusTips: string[];
  aiHint: string | null;
  loading: boolean;
  loadError?: string | null;
  onRefresh: () => void;
  onAckPayment: (id: string) => void;
  onDismissReminder: (key: string) => void;
  dismissedReminderKeys: Set<string>;
};

const QUICK_LINKS = [
  { href: "/schedule", label: "Tasks" },
  { href: "/developer-reports", label: "Reports" },
  { href: "/projects", label: "Projects" },
  { href: "/community", label: "Community" },
  { href: "/settings/account", label: "Settings" }
] as const;

const CHART_COLORS = ["bg-[#005CAB]", "bg-[#5C2D91]", "bg-[#0B6A0B]", "bg-[#C19C00]", "bg-[#C50F1F]"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[#8A8886]">{children}</p>;
}

export function DeveloperOverviewDashboard({
  queue,
  projects,
  scheduleKpis,
  reportReminderDue,
  progressReminders,
  pendingPayments,
  focusTips,
  aiHint,
  loading,
  loadError,
  onRefresh,
  onAckPayment,
  onDismissReminder,
  dismissedReminderKeys
}: DeveloperOverviewDashboardProps) {
  const { auth } = useAuth();
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  const visibleReminders = progressReminders.filter((r) => !dismissedReminderKeys.has(r.reminderKey));

  const alertItems = useMemo((): WorkspacePriorityItem[] => {
    const items: WorkspacePriorityItem[] = [];
    if (reportReminderDue) {
      items.push({
        id: "report-due",
        tone: "danger",
        title: "Submit today's report",
        detail: "File your developer report for leadership.",
        href: "/developer-reports",
        action: "Submit"
      });
    }
    if (queue.overdueTasks > 0) {
      items.push({
        id: "overdue-tasks",
        tone: "danger",
        title: `${queue.overdueTasks} overdue task${queue.overdueTasks === 1 ? "" : "s"}`,
        detail: "Clear past-due work.",
        href: "/schedule",
        action: "Tasks"
      });
    }
    if (queue.blockedTasks > 0) {
      items.push({
        id: "blocked-tasks",
        tone: "warning",
        title: `${queue.blockedTasks} blocked`,
        detail: "Unblock or escalate.",
        href: "/projects",
        action: "Projects"
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

  const alignedTips = useMemo(
    () =>
      dedupeFocusTips(focusTips, {
        reportReminderDue,
        hasUnreadAlert: queue.unreadNotifications > 0,
        hasOverdueTasksAlert: queue.overdueTasks > 0,
        priorityTitles: alertItems.map((a) => a.title)
      }).slice(0, 3),
    [focusTips, reportReminderDue, queue.unreadNotifications, alertItems]
  );

  const alignedHint = useMemo(
    () => dedupeAiHint(aiHint, alignedTips, { reportReminderDue }),
    [aiHint, alignedTips, reportReminderDue]
  );

  const projectBars = projects
    .filter((p) => p.status === "active" || p.status === "planned")
    .slice(0, 6)
    .map((p, idx) => {
      const name = p.name?.trim() || "Project";
      return {
        label: name.length > 18 ? `${name.slice(0, 18)}…` : name,
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
          { label: "done", value: scheduleKpis.completed, color: "bg-[#0B6A0B]" },
          { label: "pending", value: scheduleKpis.pending, color: "bg-[#005CAB]" }
        ].filter((t) => t.value > 0)
      : [];

  const attentionProjects = projects.filter((p) => p.overdueTasks > 0 || p.blockedTasks > 0).slice(0, 5);

  const panelForTone = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return devNeu.alertDanger;
    if (tone === "warning") return devNeu.alertWarning;
    return devNeu.alertInfo;
  };

  const actionColor = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return "bg-[#C50F1F] hover:bg-[#A50D1A]";
    if (tone === "warning") return "bg-[#C19C00] hover:bg-[#A68500]";
    return "bg-[#005CAB] hover:bg-[#004A8C]";
  };

  return (
    <div className={`${devNeu.workspace} flex w-full min-w-0 flex-1 flex-col gap-3 bg-white pb-4`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1DFDD] pb-3">
        <div className="min-w-0">
          <p className={devNeu.eyebrow}>Developer</p>
          <h1 className={`mt-0.5 ${devNeu.title}`}>{welcomeHeadline}</h1>
          <p className={`mt-0.5 max-w-xl ${devNeu.body}`}>Queue, milestones, and reports.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${devNeu.btnGhost} shrink-0 disabled:opacity-50`}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </header>

      {loadError ? (
        <div className={`${devNeu.alertWarning} px-2.5 py-2`}>
          <p className="text-[12px] text-[#8A7000]">{loadError}</p>
        </div>
      ) : null}

      {pendingPayments.length > 0 ? (
        <section>
          <SectionLabel>Payments to confirm</SectionLabel>
          <ul className="grid gap-1.5">
            {pendingPayments.map((row) => (
              <li key={row.id} className={`${devNeu.alertWarning} px-2.5 py-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#242424]">Payment recorded</p>
                    <p className="text-[11px] text-[#605E5C]">
                      {formatMoney(Number(row.amount))}
                      {row.currency && row.currency !== "KES" ? ` ${row.currency}` : ""} ·{" "}
                      {row.description?.trim() || "Dev payment"} · {new Date(row.spentAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button type="button" onClick={() => onAckPayment(row.id)} className={devNeu.btnPrimary}>
                    Confirm
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
                    {visibleReminders.some((r) => r.reminderKey === item.id) ? (
                      <button
                        type="button"
                        onClick={() => onDismissReminder(item.id)}
                        className="mt-1 text-[10px] font-medium text-[#8A8886] hover:text-[#242424]"
                      >
                        Dismiss
                      </button>
                    ) : null}
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

      {alignedTips.length > 0 || alignedHint ? (
        <section className={devNeu.panelInset}>
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
              className={`text-[11px] leading-snug text-[#5C2D91] ${alignedTips.length ? "mt-1.5 border-t border-[#E1DFDD] pt-1.5" : ""}`}
            >
              {alignedHint}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <SectionLabel>Your queue</SectionLabel>
        <DevStatRow>
          <Link href="/projects" className="min-w-0">
            <DevStatInline
              label="Active projects"
              value={loading ? "…" : queue.activeProjects}
              hint="In flight"
              tone="violet"
            />
          </Link>
          <Link href="/schedule" className="min-w-0">
            <DevStatInline
              label="Overdue"
              value={loading ? "…" : queue.overdueTasks}
              hint="Past due"
              tone={queue.overdueTasks > 0 ? "rose" : "sky"}
            />
          </Link>
          <DevStatInline
            label="Milestone avg"
            value={loading ? "…" : `${queue.avgProgress}%`}
            hint="Active projects"
            tone="emerald"
          />
          <DevStatInline
            label="Report streak"
            value={loading ? "…" : queue.reportStreakDays}
            hint="Days"
            tone="amber"
          />
        </DevStatRow>
        <DevStatRow className="mt-2">
          <DevStatInline
            label="Blocked"
            value={loading ? "…" : queue.blockedTasks}
            hint="Needs action"
            tone="amber"
          />
          <DevStatInline
            label="Work progress"
            value={loading ? "…" : `${queue.workProgressPercent}%`}
            hint="Org signal"
            tone="sky"
          />
          <Link href="/community" className="min-w-0">
            <DevStatInline
              label="Notifications"
              value={loading ? "…" : queue.unreadNotifications}
              hint="Unread"
              tone={queue.unreadNotifications > 0 ? "rose" : "sky"}
            />
          </Link>
          <Link href="/developer-reports" className="min-w-0">
            <DevStatInline label="Reports" value="File" hint="Daily" tone="violet" />
          </Link>
        </DevStatRow>
      </section>

      <nav aria-label="Developer quick links" className="flex flex-wrap gap-1.5 border-b border-[#E1DFDD] pb-3">
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
            <p className={devNeu.muted}>
              Week: {scheduleKpis.completed} done · {scheduleKpis.pending} pending
            </p>
          ) : null}
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2">
          <ChartPanel title="Milestones">
            <HorizontalBarChart
              items={projectBars}
              valueSuffix="%"
              emptyLabel={loading ? "Loading…" : "No active projects"}
            />
          </ChartPanel>

          <ChartPanel title="Task mix">
            <PieChart items={taskMix} size={140} emptyLabel={loading ? "Loading…" : "No tasks yet"} />
          </ChartPanel>

          <ChartPanel title="This week">
            {taskBars.length > 0 ? (
              <VerticalBarChart items={taskBars} />
            ) : (
              <p className="text-[11px] text-[#605E5C]">
                {loading ? "Loading…" : "No tasks this week"}
              </p>
            )}
          </ChartPanel>

          <ChartPanel title="Needs attention">
            {attentionProjects.length > 0 ? (
              <ul className="w-full space-y-1">
                {attentionProjects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded border border-[#E1DFDD] bg-white px-2 py-1.5"
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="truncate text-[11px] font-semibold text-[#005CAB] hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-[10px] text-[#605E5C]">
                      {p.overdueTasks > 0 ? `${p.overdueTasks} late` : ""}
                      {p.overdueTasks > 0 && p.blockedTasks > 0 ? " · " : ""}
                      {p.blockedTasks > 0 ? `${p.blockedTasks} blocked` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[#605E5C]">{loading ? "Loading…" : "All clear"}</p>
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
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[#005CAB]" aria-hidden />
      <h3 className="text-[10px] font-semibold tracking-wide text-[#005CAB]">{title}</h3>
      <div className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}
