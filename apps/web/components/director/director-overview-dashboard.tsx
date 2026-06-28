"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HorizontalBarChart, PieChart, VerticalBarChart } from "../analytics/chart-widgets";
import { WorkspaceLiveAnalytics } from "../analytics/workspace-live-analytics";
import { DashboardSectionLabel } from "../dashboard-welcome-banner";
import { DirectorPanel, DirectorStatInline, DirectorStatRow } from "./director-ui";
import { adminNeu } from "../admin/admin-theme";
import { AdminPanel, AdminStatInline, AdminStatRow } from "../admin/admin-ui";
import { DirectorBriefingPreview } from "./director-briefing-view";
import { directorNeu as directorNeuTokens } from "./director-theme";
import {
  WorkspaceAlignedTips,
  WorkspaceDashboardSection,
  WorkspacePriorityGrid,
  dedupeAiHint,
  dedupeFocusTips,
  type WorkspacePriorityItem
} from "../workspace/workspace-dashboard-primitives";
import { formatMoney } from "../../app/format-money";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst"
};

const QUICK_LINKS = [
  { href: "/schedule", label: "Tasks" },
  { href: "/projects", label: "Projects" },
  { href: "/leads", label: "Leads" },
  { href: "/approvals", label: "Approvals" },
  { href: "/analytics", label: "Analytics" },
  { href: "/reports", label: "Reports" },
  { href: "/developer-reports", label: "Dev reports" },
  { href: "/community", label: "Community" },
  { href: "/reports/ai", label: "AI summaries" }
] as const;

const ADMIN_QUICK_LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/org", label: "Departments" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/email-automation", label: "Email AI" },
  { href: "/analytics", label: "Analytics" },
  { href: "/approvals", label: "Approvals" },
  { href: "/projects", label: "Projects" },
  { href: "/reports/ai", label: "AI briefings" },
  { href: "/activity", label: "Activity" },
  { href: "/community", label: "Community" }
] as const;

const CHART_COLORS = ["bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];
const ADMIN_CHART_COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

type OverviewVariant = "director" | "admin";

export type DirectorProjectRow = {
  id: string;
  name: string;
  status: string;
  approvalStatus?: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
};

export type DirectorKpis = {
  projectHealth: {
    activeProjects: number;
    overdueTasks: number;
    blockedTasks: number;
    milestonesDone: number;
    milestonesPending: number;
  };
  leadConversion: {
    leadsThisMonth: number;
    dealsWon: number;
    dealsLost: number;
    winRate: number;
    avgTimeToCloseDays: number;
  };
};

export type DirectorDashboardData = {
  canSeeFinance?: boolean;
  financialHealth: {
    revenueThisPeriod: number;
    outstandingInvoices: number;
    netFlow: number;
    pendingExpenseApprovals: number;
  } | null;
  salesHealth: {
    totalPipelineValue: number;
    winRate: number;
    stalledDealsCount: number;
    averageDealCycleDays: number;
  };
  operationalHealth: {
    activeProjects: number;
    projectsAtRisk: number;
    blockedTasksAboveThreshold: number;
  };
  approvalQueue: { totalPending: number };
  teamCurrentFocus?: {
    userId: string;
    name: string | null;
    email: string;
    roleKeys: string[];
    project: { id: string; name: string; status: string; approvalStatus: string } | null;
    note: string | null;
    updatedAt: string | null;
  }[];
};

export type DirectorAttention = {
  notifications: { id: string; subject: string | null; body: string; readAt: string | null }[];
  leadsPendingApproval?: { id: string; title: string; owner: { name: string | null; email: string } | null }[];
  approvalsPending?: { id: string; entityType: string; entityId: string; requester: { name: string | null; email: string } | null }[];
  messages?: { id: string; reportId: string; content: string }[];
  dueToday?: { id: string; lead: { id: string; title: string } }[];
};

export type DirectorSummaryActionRow = {
  id: string;
  source: string;
  createdAt: string;
  type: string;
  summary: string;
  detail: string | null;
  actorLabel: string | null;
};

export type DirectorSummaryFeed = {
  dateKey: string;
  tz: string;
  aiReportHourLocal: number;
  actions: DirectorSummaryActionRow[];
  aiDailyBrief: { id: string; subject: string; createdAt: string } | null;
};

export type DirectorAiBriefing = {
  id: string;
  dateKey: string;
  subject: string;
  createdAt: string;
  bodyPreview: string;
};

type DirectorOverviewDashboardProps = {
  welcomeHeadline: string;
  roleKeys: string[];
  attention: DirectorAttention | null;
  directorDashboard: DirectorDashboardData | null;
  kpis: DirectorKpis | null;
  kpisError: boolean;
  canViewFinanceKpis: boolean;
  projects: DirectorProjectRow[];
  focusTips: string[];
  aiHint: string | null;
  directorSummaryFeed: DirectorSummaryFeed | null;
  directorSummaryFeedFailed: boolean;
  directorAiBriefings: DirectorAiBriefing[] | null;
  queue: {
    unreadNotifications: number;
    messagesCount: number;
    dueToday: number;
    workProgressPercent: number;
    reportStreakDays: number;
    approvalsPending: number;
    leadsPendingApproval: number;
    communityUnread: number;
  };
  loading: boolean;
  onRefresh: () => void;
  variant?: OverviewVariant;
};

function formatBriefingDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(d.getTime()) ? dateKey : d.toLocaleDateString();
}

function formatActionTime(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
}

function isMeaningfulAction(a: DirectorSummaryActionRow): boolean {
  const t = a.type.toLowerCase();
  if (t.includes("auth.login")) return false;
  if (/logged in/i.test(a.summary)) return false;
  return true;
}

export function DirectorOverviewDashboard({
  welcomeHeadline,
  roleKeys,
  attention,
  directorDashboard,
  kpis,
  kpisError,
  canViewFinanceKpis,
  projects,
  focusTips,
  aiHint,
  directorSummaryFeed,
  directorSummaryFeedFailed,
  directorAiBriefings,
  queue,
  loading,
  onRefresh,
  variant = "director"
}: DirectorOverviewDashboardProps) {
  const neu = variant === "admin" ? adminNeu : directorNeuTokens;
  const accentMuted = variant === "admin" ? "text-indigo-400/90" : "text-sky-400/90";
  const accentSoft = variant === "admin" ? "text-indigo-300/90" : "text-sky-300/90";
  const accentLink = variant === "admin" ? "text-indigo-400" : "text-sky-400";
  const chartAccent = variant === "admin" ? "text-indigo-400/80" : "text-sky-400/80";
  const workspaceLabel = variant === "admin" ? "Admin" : "Director";
  const headerSubtitle =
    variant === "admin"
      ? "Governance command center for users, org, approvals, and org-wide delivery — live from the database."
      : "Command center for delivery, pipeline, and team alignment — live from the database, no calls required.";
  const queueLabel = variant === "admin" ? "Your governance queue" : "Your command queue";
  const quickLinks = variant === "admin" ? ADMIN_QUICK_LINKS : QUICK_LINKS;
  const chartColors = variant === "admin" ? ADMIN_CHART_COLORS : CHART_COLORS;
  const Panel = variant === "admin" ? AdminPanel : DirectorPanel;
  const StatRow = variant === "admin" ? AdminStatRow : DirectorStatRow;
  const StatInline = variant === "admin" ? AdminStatInline : DirectorStatInline;
  const analyticsVariant = variant === "admin" ? "admin" : "director";

  const alertItems = useMemo((): WorkspacePriorityItem[] => {
    const items: WorkspacePriorityItem[] = [];
    const dd = directorDashboard;

    if (queue.unreadNotifications > 0) {
      items.push({
        id: "unread",
        tone: queue.unreadNotifications >= 5 ? "danger" : "warning",
        title: `${queue.unreadNotifications} unread notification${queue.unreadNotifications === 1 ? "" : "s"}`,
        detail: "Briefings, governance, and team signals — clear the bell so nothing is missed.",
        href: "/community",
        action: "Open Community"
      });
    }

    if (queue.leadsPendingApproval > 0) {
      items.push({
        id: "leads",
        tone: "warning",
        title: `${queue.leadsPendingApproval} lead${queue.leadsPendingApproval === 1 ? "" : "s"} need approval`,
        detail: "New pipeline entries are blocked until you approve them.",
        href: "/leads",
        action: "Review leads"
      });
    }

    if (queue.approvalsPending > 0) {
      items.push({
        id: "approvals",
        tone: "danger",
        title: `${queue.approvalsPending} approval${queue.approvalsPending === 1 ? "" : "s"} pending`,
        detail: "Finance and ops requests waiting on your decision.",
        href: "/approvals",
        action: "Open approvals"
      });
    }

    if ((dd?.operationalHealth.projectsAtRisk ?? 0) > 0) {
      items.push({
        id: "at-risk",
        tone: "danger",
        title: `${dd!.operationalHealth.projectsAtRisk} project${dd!.operationalHealth.projectsAtRisk === 1 ? "" : "s"} at risk`,
        detail: "Delivery slipping or stalled — check milestones and blockers.",
        href: "/projects",
        action: "View projects"
      });
    }

    if ((dd?.salesHealth.stalledDealsCount ?? 0) > 0) {
      items.push({
        id: "stalled",
        tone: "warning",
        title: `${dd!.salesHealth.stalledDealsCount} stalled deal${dd!.salesHealth.stalledDealsCount === 1 ? "" : "s"}`,
        detail: "Pipeline velocity is slowing — align with Sales on next steps.",
        href: "/crm",
        action: "Open CRM"
      });
    }

    if (queue.messagesCount > 0) {
      items.push({
        id: "messages",
        tone: "warning",
        title: `${queue.messagesCount} report thread${queue.messagesCount === 1 ? "" : "s"} need a reply`,
        detail: "Sales or developer questions on submitted reports.",
        href: "/reports",
        action: "Open reports"
      });
    }

    return items;
  }, [directorDashboard, queue]);

  const alignedTips = useMemo(
    () =>
      dedupeFocusTips(focusTips, {
        hasUnreadAlert: queue.unreadNotifications > 0,
        hasPendingApprovalsAlert: queue.approvalsPending > 0,
        priorityTitles: alertItems.map((a) => a.title)
      }),
    [focusTips, queue, alertItems]
  );

  const alignedHint = useMemo(() => dedupeAiHint(aiHint, alignedTips, {}), [aiHint, alignedTips]);

  const meaningfulActions = useMemo(
    () => (directorSummaryFeed?.actions ?? []).filter(isMeaningfulAction).slice(0, 14),
    [directorSummaryFeed]
  );

  const projectHealthBars = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "active", value: kpis.projectHealth.activeProjects, color: "bg-sky-500" },
      { label: "overdue", value: kpis.projectHealth.overdueTasks, color: "bg-rose-500" },
      { label: "blocked", value: kpis.projectHealth.blockedTasks, color: "bg-amber-500" }
    ].filter((b) => b.value > 0);
  }, [kpis]);

  const leadMix = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "won", value: kpis.leadConversion.dealsWon },
      { label: "lost", value: kpis.leadConversion.dealsLost },
      { label: "leads", value: kpis.leadConversion.leadsThisMonth }
    ].filter((s) => s.value > 0);
  }, [kpis]);

  const milestoneMix = useMemo(() => {
    if (!kpis) return [];
    const done = kpis.projectHealth.milestonesDone;
    const pending = kpis.projectHealth.milestonesPending;
    if (done === 0 && pending === 0) return [];
    return [
      { label: "done", value: done },
      { label: "pending", value: pending }
    ];
  }, [kpis]);

  const pipelineBars = useMemo(() => {
    if (!directorDashboard) return [];
    return [
      {
        label: "Pipeline",
        value: Math.round(directorDashboard.salesHealth.totalPipelineValue / 1000),
        color: "bg-sky-500"
      },
      {
        label: "Stalled deals",
        value: directorDashboard.salesHealth.stalledDealsCount,
        color: "bg-amber-500"
      },
      {
        label: "At-risk projects",
        value: directorDashboard.operationalHealth.projectsAtRisk,
        color: "bg-rose-500"
      }
    ].filter((b) => b.value > 0);
  }, [directorDashboard]);

  const unreadNotifications = attention?.notifications.filter((n) => !n.readAt) ?? [];

  const alertClass = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return neu.alertDanger;
    if (tone === "warning") return neu.alertWarning;
    return neu.alertInfo;
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className={`font-label text-[10px] font-semibold uppercase tracking-[0.22em] ${accentMuted}`}>{workspaceLabel}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {welcomeHeadline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{headerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${neu.btnGhost} shrink-0 disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh all"}
        </button>
      </header>

      {alertItems.length > 0 ? (
        <WorkspaceDashboardSection label="Today's priorities" roleKeys={roleKeys}>
          <WorkspacePriorityGrid items={alertItems} panelClass={alertClass} />
        </WorkspaceDashboardSection>
      ) : (
        <Panel inset className="p-4 sm:p-5">
          <p className="text-sm text-emerald-300/90">
            <span className="font-semibold">Queue clear</span> — no urgent approvals, risks, or unread signals flagged
            right now. Charts and team focus below stay live.
          </p>
        </Panel>
      )}

      <WorkspaceAlignedTips
        tips={alignedTips}
        aiHint={alignedHint}
        panelClass={`${neu.panelInset} p-4 sm:p-5`}
        roleKeys={roleKeys}
      />

      <WorkspaceDashboardSection label={queueLabel} roleKeys={roleKeys}>
        <div className={`mt-3 ${neu.kpiStrip}`}>
          <StatRow>
            <Link href="/approvals" className="min-w-0 hover:opacity-90">
              <StatInline
                label="Approvals"
                value={queue.approvalsPending}
                hint="Pending decisions"
                tone={queue.approvalsPending > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/leads" className="min-w-0 hover:opacity-90">
              <StatInline
                label="Leads queue"
                value={queue.leadsPendingApproval}
                hint="Need approval"
                tone={queue.leadsPendingApproval > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/community" className="min-w-0 hover:opacity-90">
              <StatInline
                label="Notifications"
                value={queue.unreadNotifications}
                hint="Unread in-app"
                tone={queue.unreadNotifications > 0 ? "rose" : "sky"}
              />
            </Link>
            <Link href="/projects" className="min-w-0 hover:opacity-90">
              <StatInline
                label="Projects"
                value={directorDashboard?.operationalHealth.activeProjects ?? projects.length}
                hint={`${directorDashboard?.operationalHealth.projectsAtRisk ?? 0} at risk`}
                tone="violet"
              />
            </Link>
            <StatInline
              label="Work progress"
              value={`${queue.workProgressPercent}%`}
              hint="Org delivery signal"
              tone="emerald"
            />
          </StatRow>
        </div>
      </WorkspaceDashboardSection>

      <nav aria-label="Director quick links" className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-5">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`${neu.navIdle} rounded-lg px-3 py-2 text-sm font-medium`}>
            {link.label}
          </Link>
        ))}
      </nav>

      {directorDashboard && (
        <WorkspaceDashboardSection label="Org pulse" roleKeys={roleKeys}>
          <div className={`mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${neu.kpiStrip}`}>
            <StatInline
              label="Pipeline"
              value={formatMoney(directorDashboard.salesHealth.totalPipelineValue)}
              hint={`Win ${directorDashboard.salesHealth.winRate.toFixed(0)}% · ${directorDashboard.salesHealth.stalledDealsCount} stalled`}
              tone="sky"
            />
            <StatInline
              label="Active projects"
              value={directorDashboard.operationalHealth.activeProjects}
              hint={`${directorDashboard.operationalHealth.projectsAtRisk} at risk`}
              tone="violet"
            />
            <StatInline
              label="Blocked tasks"
              value={directorDashboard.operationalHealth.blockedTasksAboveThreshold}
              hint="Above threshold"
              tone="rose"
            />
            <Link href="/approvals" className="min-w-0 hover:opacity-90">
              <StatInline
                label="Approval queue"
                value={directorDashboard.approvalQueue.totalPending}
                hint="Finance & ops"
                tone="amber"
              />
            </Link>
          </div>
          {!canViewFinanceKpis && (
            <p className="mt-3 text-xs text-slate-500">
              Finance totals restricted — Admin can enable <span className="text-slate-300">Can see finance</span> on
              your profile.
            </p>
          )}
          {canViewFinanceKpis && directorDashboard.financialHealth && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatInline label="Revenue" value={formatMoney(directorDashboard.financialHealth.revenueThisPeriod)} tone="emerald" />
              <StatInline label="Outstanding" value={formatMoney(directorDashboard.financialHealth.outstandingInvoices)} tone="amber" />
              <StatInline label="Net flow" value={formatMoney(directorDashboard.financialHealth.netFlow)} tone="sky" />
              <StatInline label="Expense approvals" value={directorDashboard.financialHealth.pendingExpenseApprovals} tone="rose" />
            </div>
          )}
        </WorkspaceDashboardSection>
      )}

      <section aria-label="Progress charts" className="w-full">
        <DashboardSectionLabel roleKeys={roleKeys}>Progress charts</DashboardSectionLabel>
        <div className="mt-3 grid w-full gap-4 xl:grid-cols-2">
          <ChartPanel title="Project health" neu={neu} accentClass={chartAccent}>
            <HorizontalBarChart items={projectHealthBars} emptyLabel={kpisError ? "Could not load KPIs" : "No project task data yet"} />
          </ChartPanel>
          <ChartPanel title="Lead outcomes (month)" neu={neu} accentClass={chartAccent}>
            <PieChart items={leadMix} size={200} emptyLabel="No lead/deal activity this month" />
          </ChartPanel>
          <ChartPanel title="Milestones" neu={neu} accentClass={chartAccent}>
            <PieChart items={milestoneMix} size={200} emptyLabel="No milestones tracked yet" />
          </ChartPanel>
          <ChartPanel title="Pipeline signals" neu={neu} accentClass={chartAccent}>
            {pipelineBars.length > 0 ? (
              <VerticalBarChart
                items={pipelineBars.map((b, i) => ({
                  ...b,
                  color: chartColors[i % chartColors.length]
                }))}
              />
            ) : (
              <p className="text-sm text-slate-500">Loading pipeline signals…</p>
            )}
          </ChartPanel>
        </div>
      </section>

      <WorkspaceDashboardSection label="Active projects" roleKeys={roleKeys}>
        <div className={`mt-3 overflow-x-auto ${neu.panelInset}`}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Created by</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Approval</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 12).map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04] text-slate-200">
                  <td className="px-3 py-2.5 font-medium text-slate-100">{p.name}</td>
                  <td className="px-3 py-2.5 text-slate-400">{p.createdBy?.name ?? p.createdBy?.email ?? "—"}</td>
                  <td className="px-3 py-2.5 capitalize text-slate-300">{p.status}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{p.approvalStatus ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link href={`/projects/${p.id}`} className={`text-xs font-medium ${accentLink} hover:underline`}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WorkspaceDashboardSection>

      {directorDashboard?.teamCurrentFocus && directorDashboard.teamCurrentFocus.length > 0 && (
        <WorkspaceDashboardSection label="Team focus" roleKeys={roleKeys}>
          <div className={`mt-3 overflow-x-auto ${neu.panelInset}`}>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Roles</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {directorDashboard.teamCurrentFocus.map((row) => (
                  <tr key={row.userId} className="border-b border-white/[0.04] text-slate-200">
                    <td className="px-3 py-2.5 font-medium text-slate-100">{row.name?.trim() || row.email}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {row.roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.project ? (
                        <Link href={`/projects/${row.project.id}`} className={`${accentLink} hover:underline`}>
                          {row.project.name}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Not set</span>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2.5 text-slate-400">{row.note?.trim() || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkspaceDashboardSection>
      )}

      {(unreadNotifications.length > 0 ||
        (attention?.leadsPendingApproval?.length ?? 0) > 0 ||
        (attention?.approvalsPending?.length ?? 0) > 0) && (
        <WorkspaceDashboardSection label="What needs your attention" roleKeys={roleKeys}>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {unreadNotifications.length > 0 && (
              <Panel inset className="p-4">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${chartAccent}`}>Notifications</p>
                <ul className="mt-2 space-y-2">
                  {unreadNotifications.slice(0, 5).map((n) => (
                    <li key={n.id} className={`${neu.listRow} text-sm text-slate-300`}>
                      {(n.subject || n.body).slice(0, 72)}
                      {(n.subject || n.body).length > 72 ? "…" : ""}
                    </li>
                  ))}
                </ul>
                <Link href="/community" className={`mt-3 inline-block text-xs font-medium ${accentLink} hover:underline`}>
                  Open Community →
                </Link>
              </Panel>
            )}
            {(attention?.leadsPendingApproval?.length ?? 0) > 0 && (
              <Panel inset className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">Leads</p>
                <ul className="mt-2 space-y-2">
                  {attention!.leadsPendingApproval!.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/leads/${l.id}`}
                        className={`${neu.listRow} block text-sm text-slate-300 ${variant === "admin" ? "hover:text-indigo-300" : "hover:text-sky-300"}`}
                      >
                        {l.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {(attention?.approvalsPending?.length ?? 0) > 0 && (
              <Panel inset className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/80">Approvals</p>
                <ul className="mt-2 space-y-2">
                  {attention!.approvalsPending!.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <Link href="/approvals" className={`${neu.listRow} block text-sm text-slate-300`}>
                        {a.entityType} · {a.requester?.name ?? a.requester?.email ?? "requester"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </WorkspaceDashboardSection>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspaceDashboardSection label="Platform activity" roleKeys={roleKeys}>
          {directorSummaryFeed === null && !directorSummaryFeedFailed ? (
            <p className="mt-2 text-sm text-slate-500">Loading activity…</p>
          ) : directorSummaryFeedFailed || !directorSummaryFeed ? (
            <p className="mt-2 text-sm text-rose-300/90">Could not load activity feed.</p>
          ) : (
            <div className={`mt-3 ${neu.panelInset} max-h-80 overflow-y-auto p-3`}>
              <p className="mb-3 text-xs text-slate-500">
                Day {formatBriefingDate(directorSummaryFeed.dateKey)}
                {directorSummaryFeed.aiDailyBrief ? (
                  <span className="ml-2 text-emerald-400/90">· AI digest ready</span>
                ) : (
                  <span className="ml-2 text-amber-400/90">· Digest at {directorSummaryFeed.aiReportHourLocal}:00</span>
                )}
              </p>
              {meaningfulActions.length === 0 ? (
                <p className="text-sm text-slate-500">No significant platform events today yet (logins hidden).</p>
              ) : (
                <ul className="space-y-2">
                  {meaningfulActions.map((a) => (
                    <li key={a.id} className={`${neu.listRow} px-3 py-2`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className={`text-xs font-medium ${accentSoft}`}>{a.type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-slate-500">
                          {formatActionTime(a.createdAt, directorSummaryFeed.tz)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{a.summary}</p>
                      {a.actorLabel ? <p className="mt-0.5 text-xs text-slate-500">{a.actorLabel}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/activity" className={`mt-3 inline-block text-xs font-medium ${accentLink} hover:underline`}>
                Full activity log →
              </Link>
            </div>
          )}
        </WorkspaceDashboardSection>

        <WorkspaceDashboardSection label="Daily AI summaries" roleKeys={roleKeys}>
          {directorAiBriefings === null ? (
            <p className="mt-2 text-sm text-slate-500">Loading briefings…</p>
          ) : directorAiBriefings.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No AI summaries yet.</p>
          ) : (
            <ul className={`mt-3 space-y-2 ${neu.panelInset} p-3`}>
              {directorAiBriefings.slice(0, 5).map((r) => (
                <li key={r.id} className={`${neu.listRow} p-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs font-medium ${accentSoft}`}>{formatBriefingDate(r.dateKey)}</p>
                    <Link href="/reports/ai" className={`text-[10px] font-medium ${accentLink} hover:underline`}>
                      Open →
                    </Link>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-200">{r.subject}</p>
                  <DirectorBriefingPreview body={r.bodyPreview} className="mt-2" />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/reports/ai"
            className={`mt-2 inline-block text-xs text-slate-500 ${variant === "admin" ? "hover:text-indigo-400" : "hover:text-sky-400"}`}
          >
            All AI reports →
          </Link>
        </WorkspaceDashboardSection>
      </div>

      <section aria-label="Live analytics" className="w-full">
        <DashboardSectionLabel roleKeys={roleKeys} tone="dashboard">
          Analytics &amp; predictions
        </DashboardSectionLabel>
        <WorkspaceLiveAnalytics variant={analyticsVariant} compact className="mt-3 border-0 pb-0" />
      </section>
    </div>
  );
}

function ChartPanel({
  title,
  children,
  neu,
  accentClass
}: {
  title: string;
  children: React.ReactNode;
  neu: { chartPanel: string };
  accentClass: string;
}) {
  return (
    <div className={neu.chartPanel}>
      <h3 className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${accentClass}`}>{title}</h3>
      <div className="mt-5 flex flex-1 flex-col items-center justify-center w-full">{children}</div>
    </div>
  );
}

export function AdminOverviewDashboard(props: Omit<DirectorOverviewDashboardProps, "variant">) {
  return <DirectorOverviewDashboard {...props} variant="admin" />;
}
