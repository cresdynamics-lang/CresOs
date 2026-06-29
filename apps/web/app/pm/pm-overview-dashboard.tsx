"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../auth-context";
import {
  HorizontalBarChart,
  PieChart,
  RadialProgress,
  VerticalBarChart
} from "../../components/analytics/chart-widgets";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { dashboardNeu } from "../../components/dashboard/dashboard-theme";
import {
  DashboardNeuKpiTile,
  DashboardQueueEmpty
} from "../../components/dashboard/dashboard-neu-ui";
import { PmHealthBadge } from "../../components/pm/pm-health-badge";
import { PmSmartBriefPanel, type PmIntelligenceData } from "../../components/pm/pm-smart-brief";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmBanner, PmDataBlock, PmFullscreenPage, PmSection } from "../../components/pm/pm-shell";
import { PmStatInline, PmStatRow } from "../../components/pm/pm-ui";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import {
  WorkspaceDashboardSection,
  WorkspacePriorityGrid,
  type WorkspacePriorityItem
} from "../../components/workspace/workspace-dashboard-primitives";
import {
  InteractiveWelcomeHero,
  usePmWorkspaceCompanion,
  type WorkspaceCompanionData
} from "../../components/workspace/interactive-welcome-hero";

export type PmQueueStats = {
  communityUnread: number;
  unreadNotifications: number;
  messagesToRespond: number;
  dueToday: number;
  visibleProjects: number;
  workProgressPercent: number;
  reportsToday: number;
  openTasks: number;
  atRiskCount: number;
  criticalCount: number;
};

export type PmOverviewKpis = {
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  overdueMilestones: number;
  pendingCheckIns: number;
  reportsToday: number;
  orgHealth: number;
  avgDelivery: number;
  silentDevelopers: number;
};

export type PmProjectChartRow = {
  id: string;
  name: string;
  healthScore: number;
  managementProgressPercent: number;
  status: string;
  milestoneTotal: number;
  milestoneCompleted: number;
  overdueMilestones: number;
};

type Overview = {
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  overdueMilestones: number;
  pendingCheckIns: number;
  reportsToday: number;
};

type PmOverviewDashboardProps = {
  overview: Overview | null;
  intel: PmIntelligenceData | null;
  queue: PmQueueStats;
  kpis: PmOverviewKpis | null;
  projects: PmProjectChartRow[];
  scheduleKpis: ScheduleKpiStats | null;
  loading: boolean;
  intelLoading: boolean;
  error: string | null;
  batchSending: boolean;
  onRefresh: () => void;
  onSendDailyBatch: () => void;
  companion: WorkspaceCompanionData | null;
  companionLoading: boolean;
};

const QUICK_LINKS = [
  { href: "/pm/projects", label: "Projects" },
  { href: "/pm/check-ins", label: "Check-ins" },
  { href: "/pm/team", label: "Team" },
  { href: "/pm/reports", label: "Reports" },
  { href: "/schedule", label: "Tasks" },
  { href: "/community", label: "Community" }
] as const;

const CHART_COLORS = ["bg-teal-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

export function PmOverviewDashboard({
  overview,
  intel,
  queue,
  kpis,
  projects,
  scheduleKpis,
  loading,
  intelLoading,
  error,
  batchSending,
  onRefresh,
  onSendDailyBatch,
  companion,
  companionLoading
}: PmOverviewDashboardProps) {
  const { auth } = useAuth();

  const priorityItems = useMemo((): WorkspacePriorityItem[] => {
    const items: WorkspacePriorityItem[] = [];
    if (queue.criticalCount > 0) {
      items.push({
        id: "critical-projects",
        tone: "danger",
        title: `${queue.criticalCount} project${queue.criticalCount === 1 ? "" : "s"} in critical state`,
        detail: "Open the priority queue and run sprint recovery on the lowest health scores first.",
        href: "/pm/projects",
        action: "Review"
      });
    }
    if (queue.dueToday > 0) {
      items.push({
        id: "overdue-milestones",
        tone: "danger",
        title: `${queue.dueToday} overdue milestone${queue.dueToday === 1 ? "" : "s"}`,
        detail: "Reschedule or close milestones so delivery dates stay credible.",
        href: "/pm/projects",
        action: "Open projects"
      });
    }
    if (queue.messagesToRespond > 0) {
      items.push({
        id: "pending-checkins",
        tone: "warning",
        title: `${queue.messagesToRespond} check-in${queue.messagesToRespond === 1 ? "" : "s"} awaiting answers`,
        detail: "Developers replied in Talks — review responses and unblock delivery.",
        href: "/pm/check-ins",
        action: "Open check-ins"
      });
    }
    if ((kpis?.silentDevelopers ?? 0) > 0) {
      items.push({
        id: "silent-devs",
        tone: "warning",
        title: `${kpis!.silentDevelopers} developer${kpis!.silentDevelopers === 1 ? "" : "s"} quiet this week`,
        detail: "No developer report in the last 7 days — send a structured check-in.",
        href: "/pm/check-ins",
        action: "Send check-in"
      });
    }
    if (queue.atRiskCount > 0 && queue.criticalCount === 0) {
      items.push({
        id: "at-risk",
        tone: "warning",
        title: `${queue.atRiskCount} project${queue.atRiskCount === 1 ? "" : "s"} at risk`,
        detail: "Health scores are slipping — review milestones and task load.",
        href: "/pm/projects",
        action: "View health"
      });
    }
    for (const p of (intel?.priorities ?? []).slice(0, 2)) {
      if (p.riskLevel === "healthy") continue;
      items.push({
        id: `priority-${p.projectId}`,
        tone: p.riskLevel === "critical" ? "danger" : "warning",
        title: p.projectName,
        detail: p.signals[0]?.message ?? p.recommendedActions[0] ?? "Needs PM attention",
        href: `/pm/projects/${p.projectId}`,
        action: "Open"
      });
    }
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [queue, kpis, intel?.priorities]);

  const healthMix = useMemo(() => {
    const healthy = projects.filter((p) => p.healthScore >= 80).length;
    const atRisk = projects.filter((p) => p.healthScore >= 50 && p.healthScore < 80).length;
    const critical = projects.filter((p) => p.healthScore < 50).length;
    return [
      { label: "healthy", value: healthy },
      { label: "at risk", value: atRisk },
      { label: "critical", value: critical }
    ].filter((s) => s.value > 0);
  }, [projects]);

  const statusMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const key = p.status || "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [projects]);

  const deliveryBars = projects
    .filter((p) => p.status === "active" || p.status === "planned")
    .slice(0, 8)
    .map((p, idx) => {
      const name = p.name?.trim() || "Project";
      return {
        label: name.length > 22 ? `${name.slice(0, 22)}…` : name,
        value: p.managementProgressPercent ?? 0,
        color: CHART_COLORS[idx % CHART_COLORS.length]
      };
    });

  const milestoneMix = useMemo(() => {
    const completed = projects.reduce((s, p) => s + p.milestoneCompleted, 0);
    const overdue = projects.reduce((s, p) => s + p.overdueMilestones, 0);
    const total = projects.reduce((s, p) => s + p.milestoneTotal, 0);
    const inFlight = Math.max(0, total - completed - overdue);
    return [
      { label: "completed", value: completed },
      { label: "in flight", value: inFlight },
      { label: "overdue", value: overdue }
    ].filter((s) => s.value > 0);
  }, [projects]);

  const taskBars =
    scheduleKpis != null
      ? [
          { label: "done", value: scheduleKpis.completed, color: "bg-emerald-500" },
          { label: "pending", value: scheduleKpis.pending, color: "bg-teal-500" }
        ].filter((t) => t.value > 0)
      : [];

  const workloadBars = kpis
    ? [
        { label: "open tasks", value: kpis.openTasks, color: "bg-cyan-500" },
        { label: "check-ins", value: kpis.pendingCheckIns, color: "bg-amber-500" },
        { label: "reports today", value: kpis.reportsToday, color: "bg-emerald-500" }
      ].filter((t) => t.value > 0)
    : [];

  const alertClass = (tone: WorkspacePriorityItem["tone"]) =>
    tone === "danger" ? pmNeu.alertDanger : pmNeu.alertWarning;

  const orgHealth = kpis?.orgHealth ?? intel?.orgSummary.averageHealth ?? 0;
  const deliveryPct = kpis?.avgDelivery ?? 0;

  return (
    <PmFullscreenPage>
      <div className="flex w-full flex-col gap-5 px-3 py-4 sm:px-6 sm:py-5">
        <InteractiveWelcomeHero
          roleKeys={auth.roleKeys}
          roleLabel="Project Manager"
          companion={companion}
          loading={companionLoading}
        >
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Today&apos;s priorities</DashboardSectionLabel>
          {priorityItems.length > 0 ? (
            <WorkspacePriorityGrid items={priorityItems.slice(0, 4)} panelClass={alertClass} />
          ) : (
            <DashboardQueueEmpty>
              Your delivery queue is clear — the command center below shows live project health and team signals.
            </DashboardQueueEmpty>
          )}
        </InteractiveWelcomeHero>

        {error ? <PmBanner tone="warning" title={error} /> : null}

        <section className={dashboardNeu.panel}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={dashboardNeu.eyebrow}>Command center</p>
              <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
                Delivery cockpit
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                <span className="font-medium text-teal-300">Operating System for Growth</span> — delivery signals,
                check-ins, and project health without financial noise.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" className={dashboardNeu.btnGhost} onClick={onRefresh} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh alerts"}
              </button>
              <button type="button" className={dashboardNeu.btnGhost} onClick={onRefresh} disabled={loading}>
                Refresh projects
              </button>
              <button type="button" className={pmNeu.btnPrimary} disabled={batchSending} onClick={onSendDailyBatch}>
                {batchSending ? "Sending…" : "Run daily check-ins"}
              </button>
            </div>
          </div>

          <div className={`mt-5 ${dashboardNeu.kpiGrid}`}>
            <DashboardNeuKpiTile
              label="Community"
              value={loading ? "…" : queue.communityUnread}
              hint="Unread notifs"
              tone={queue.communityUnread > 0 ? "sky" : "brand"}
              href="/community"
              active={queue.communityUnread > 0}
            />
            <DashboardNeuKpiTile
              label="Projects"
              value={loading ? "…" : queue.visibleProjects}
              hint="Visible"
              tone="emerald"
              href="/pm/projects"
              active={queue.visibleProjects > 0}
            />
            <DashboardNeuKpiTile
              label="Notifications"
              value={loading ? "…" : queue.unreadNotifications}
              hint="Unread"
              tone={queue.unreadNotifications > 0 ? "rose" : "sky"}
              href="/community"
              active={queue.unreadNotifications > 0}
            />
            <DashboardNeuKpiTile
              label="Messages"
              value={loading ? "…" : queue.messagesToRespond}
              hint="To respond"
              tone={queue.messagesToRespond > 0 ? "amber" : "sky"}
              href="/pm/check-ins"
              active={queue.messagesToRespond > 0}
            />
          </div>

          <div className={`mt-3 ${dashboardNeu.kpiGrid}`}>
            <DashboardNeuKpiTile
              label="Due today"
              value={loading ? "…" : queue.dueToday}
              hint="Overdue milestones"
              tone={queue.dueToday > 0 ? "amber" : "sky"}
              href="/pm/projects"
              active={queue.dueToday > 0}
            />
            <DashboardNeuKpiTile
              label="Work progress"
              value={loading ? "…" : orgHealth}
              hint="Org health"
              tone="violet"
              visual="bar"
              active={orgHealth > 0}
            />
            <DashboardNeuKpiTile
              label="Delivery avg"
              value={loading ? "…" : deliveryPct}
              hint="Management %"
              tone="emerald"
              visual="bar"
              active={deliveryPct > 0}
            />
            <DashboardNeuKpiTile
              label="Reports today"
              value={loading ? "…" : queue.reportsToday}
              hint="Dev reports filed"
              tone="brand"
              href="/pm/reports"
              active={queue.reportsToday > 0}
            />
          </div>

          <div className={`mt-4 ${dashboardNeu.tasksStrip}`}>
            <p className="text-sm text-slate-400">
              Open tasks across approved projects:{" "}
              <span className="font-semibold tabular-nums text-teal-300">{loading ? "…" : queue.openTasks}</span>
              {" — "}backlog and reminders live in Tasks.
            </p>
            <Link href="/schedule" className={`${dashboardNeu.btnPrimary} shrink-0 text-center`}>
              Open Tasks →
            </Link>
          </div>
        </section>
      </div>

      <section className="border-b border-white/[0.06] px-3 py-6 sm:px-6">
        <WorkspaceDashboardSection label="Your delivery queue" roleKeys={auth.roleKeys}>
          <div className={`mt-3 ${pmNeu.kpiStrip}`}>
            <PmStatRow>
              <Link href="/pm/projects" className="min-w-0 hover:opacity-90">
                <PmStatInline
                  label="Active projects"
                  value={loading ? "…" : (overview?.activeProjects ?? 0)}
                  hint={`${overview?.totalProjects ?? 0} approved`}
                  tone="emerald"
                />
              </Link>
              <Link href="/schedule" className="min-w-0 hover:opacity-90">
                <PmStatInline
                  label="Open tasks"
                  value={loading ? "…" : queue.openTasks}
                  hint="Todo / in progress"
                  tone={queue.openTasks > 0 ? "sky" : "brand"}
                />
              </Link>
              <PmStatInline
                label="Org health"
                value={loading ? "…" : orgHealth}
                hint="Smart score / 100"
                tone="brand"
              />
              <PmStatInline
                label="At risk"
                value={loading ? "…" : queue.atRiskCount}
                hint="Projects slipping"
                tone={queue.atRiskCount > 0 ? "amber" : "emerald"}
              />
            </PmStatRow>
            <PmStatRow className="mt-6 border-t border-white/[0.06] pt-6">
              <Link href="/pm/check-ins" className="min-w-0 hover:opacity-90">
                <PmStatInline
                  label="Check-ins"
                  value={loading ? "…" : queue.messagesToRespond}
                  hint="Pending answers"
                  tone={queue.messagesToRespond > 0 ? "rose" : "sky"}
                />
              </Link>
              <PmStatInline
                label="Critical"
                value={loading ? "…" : queue.criticalCount}
                hint="Needs intervention"
                tone={queue.criticalCount > 0 ? "rose" : "emerald"}
              />
              <PmStatInline
                label="Reports today"
                value={loading ? "…" : queue.reportsToday}
                hint="Dev submissions"
                tone="violet"
              />
              <Link href="/community" className="min-w-0 hover:opacity-90">
                <PmStatInline
                  label="Community"
                  value={loading ? "…" : queue.communityUnread}
                  hint="Unread DMs"
                  tone={queue.communityUnread > 0 ? "amber" : "sky"}
                />
              </Link>
            </PmStatRow>
          </div>
        </WorkspaceDashboardSection>
      </section>

      <section className="border-b border-white/[0.06] px-3 py-6 sm:px-6">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Visual delivery metrics</DashboardSectionLabel>
        <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ChartPanel title="Org health">
            <RadialProgress
              value={orgHealth}
              label="Health score"
              sublabel="Across approved projects"
              color="#2dd4bf"
            />
          </ChartPanel>
          <ChartPanel title="Delivery progress">
            <RadialProgress
              value={deliveryPct}
              label="Avg progress"
              sublabel="Management %"
              color="#22d3ee"
            />
          </ChartPanel>
          <ChartPanel title="Workload">
            {workloadBars.length > 0 ? (
              <VerticalBarChart items={workloadBars} />
            ) : (
              <p className="text-sm text-slate-500">{loading ? "Loading…" : "No open workload signals"}</p>
            )}
          </ChartPanel>
          <ChartPanel title="Risk mix">
            <PieChart
              items={healthMix}
              size={160}
              variant="donut"
              centerLabel={loading ? "…" : String(projects.length)}
              emptyLabel={loading ? "Loading…" : "No projects yet"}
            />
          </ChartPanel>
        </div>
      </section>

      <PmSmartBriefPanel data={intel} loading={intelLoading} />

      {(intel?.orgSummary.criticalCount ?? 0) > 0 ? (
        <div className="px-3 sm:px-6">
          <PmBanner
            tone="warning"
            title={`${intel!.orgSummary.criticalCount} project${intel!.orgSummary.criticalCount === 1 ? "" : "s"} in critical delivery state`}
            detail="Open priority queue items and run sprint recovery suggestions on each project."
            action={
              <Link href="/pm/projects" className={pmNeu.btnGhost}>
                Review projects
              </Link>
            }
          />
        </div>
      ) : null}

      <nav
        aria-label="PM quick links"
        className="flex w-full flex-wrap gap-2 border-b border-white/[0.06] px-3 py-4 sm:px-6"
      >
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${pmNeu.navIdle} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section aria-label="Progress charts" className="w-full flex-1 px-3 py-6 sm:px-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Progress charts</DashboardSectionLabel>
          {scheduleKpis ? (
            <p className="text-xs text-slate-500">
              Tasks this week: {scheduleKpis.completed} done · {scheduleKpis.pending} pending
            </p>
          ) : null}
        </div>

        <div className="grid w-full gap-4 xl:grid-cols-2">
          <ChartPanel title="Delivery by project">
            <HorizontalBarChart
              items={deliveryBars}
              valueSuffix="%"
              emptyLabel={loading ? "Loading projects…" : "No active projects yet"}
            />
          </ChartPanel>

          <ChartPanel title="Project health mix">
            <PieChart
              items={healthMix}
              size={220}
              emptyLabel={loading ? "Loading health…" : "No health data yet"}
            />
          </ChartPanel>

          <ChartPanel title="Milestone status">
            <PieChart
              items={milestoneMix}
              size={220}
              emptyLabel={loading ? "Loading milestones…" : "No milestones on approved projects"}
            />
          </ChartPanel>

          <ChartPanel title="Projects by status">
            <HorizontalBarChart
              items={statusMix.map((p, idx) => ({
                label: p.label.replace(/_/g, " "),
                value: p.value,
                color: CHART_COLORS[idx % CHART_COLORS.length]
              }))}
              emptyLabel={loading ? "Loading…" : "No projects yet"}
            />
          </ChartPanel>

          <ChartPanel title="Weekly schedule">
            {taskBars.length > 0 ? (
              <VerticalBarChart items={taskBars} />
            ) : (
              <p className="text-sm text-slate-500">
                {loading ? "Loading schedule…" : "No tasks scheduled this week"}
              </p>
            )}
          </ChartPanel>

          <ChartPanel title="Priority delivery queue">
            {intelLoading ? (
              <p className="text-sm text-slate-500">Loading priorities…</p>
            ) : (intel?.priorities ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">
                {intel?.orgSummary.averageHealth === 100
                  ? "All projects look healthy."
                  : "No approved projects yet."}
              </p>
            ) : (
              <ul className="w-full space-y-2 text-sm">
                {(intel?.priorities ?? []).slice(0, 6).map((p) => (
                  <li
                    key={p.projectId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <Link href={`/pm/projects/${p.projectId}`} className="truncate text-teal-300 hover:underline">
                      {p.projectName}
                    </Link>
                    <PmHealthBadge score={p.healthScore} riskLevel={p.riskLevel} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </ChartPanel>
        </div>
      </section>

      <PmSection label="Full priority queue" description="Sorted by health — lowest scores need you first.">
        <PmDataBlock>
          {intelLoading ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading priorities…</p>
          ) : (intel?.priorities ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">
              {intel?.orgSummary.averageHealth === 100
                ? "All projects look healthy. Keep check-ins flowing."
                : "No approved projects yet."}
            </p>
          ) : (
            (intel?.priorities ?? []).map((p) => (
              <Link key={p.projectId} href={`/pm/projects/${p.projectId}`} className={`${pmNeu.listRow} block`}>
                <div className="flex items-center gap-4">
                  <PmHealthBadge score={p.healthScore} riskLevel={p.riskLevel} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100">{p.projectName}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {p.recommendedActions[0] ?? p.signals[0]?.message}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </PmDataBlock>
      </PmSection>
    </PmFullscreenPage>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={pmNeu.chartPanel}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-400/80">{title}</h3>
      <div className="mt-5 flex w-full flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}
