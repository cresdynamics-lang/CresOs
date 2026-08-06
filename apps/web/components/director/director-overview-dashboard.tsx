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
import { AdminAiCommandWidget } from "../assistant/admin-ai-command-widget";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst"
};

const QUICK_LINKS = [
  { href: "/director/crm", label: "CRM" },
  { href: "/director/reports", label: "Reports" },
  { href: "/projects", label: "Projects" },
  { href: "/approvals", label: "Approvals" },
  { href: "/analytics", label: "Analytics" },
  { href: "/community", label: "Community" }
] as const;

const ADMIN_QUICK_LINKS = [
  { href: "/admin/organisation", label: "Organisation" },
  { href: "/admin/ai-command", label: "AI Command" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
  { href: "/approvals", label: "Approvals" },
  { href: "/projects", label: "Projects" },
  { href: "/activity", label: "Activity" },
  { href: "/community", label: "Community" }
] as const;

const CHART_COLORS = ["bg-[#005CAB]", "bg-[#0B6A0B]", "bg-[#C19C00]", "bg-[#5C2D91]", "bg-[#C50F1F]"];
const ADMIN_CHART_COLORS = ["bg-[#005CAB]", "bg-[#0B6A0B]", "bg-[#C19C00]", "bg-[#5C2D91]", "bg-[#C50F1F]"];

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
  const isDirector = variant === "director";
  const accentMuted = isDirector ? "text-[#005CAB]" : "text-indigo-600";
  const accentSoft = isDirector ? "text-[#005CAB]" : "text-indigo-600";
  const accentLink = isDirector ? "text-[#005CAB] hover:text-[#004A8C]" : "text-indigo-600";
  const chartAccent = isDirector ? "text-[#005CAB]" : "text-indigo-600";
  const workspaceLabel = variant === "admin" ? "Admin" : "Director";
  const headerSubtitle =
    variant === "admin"
      ? "Governance command center for users, org, approvals, and org-wide delivery — live from the database."
      : "Command center for delivery, pipeline, and team alignment — live from the database.";
  const queueLabel = variant === "admin" ? "Your governance queue" : "Your command queue";
  const quickLinks = variant === "admin" ? ADMIN_QUICK_LINKS : QUICK_LINKS;
  const chartColors = variant === "admin" ? ADMIN_CHART_COLORS : CHART_COLORS;
  const Panel = variant === "admin" ? AdminPanel : DirectorPanel;
  const StatRow = variant === "admin" ? AdminStatRow : DirectorStatRow;
  const StatInline = variant === "admin" ? AdminStatInline : DirectorStatInline;
  const analyticsVariant = variant === "admin" ? "admin" : "director";
  const quickLinkClass = isDirector ? directorNeuTokens.quickLink : `${neu.navIdle} rounded-lg px-3 py-2 text-sm font-medium`;
  const bodyMuted = isDirector ? "text-[#605E5C]" : "text-slate-500";
  const bodyStrong = isDirector ? "text-[#201F1E]" : "text-slate-900";
  const bodySecondary = isDirector ? "text-[#3B3A39]" : "text-slate-600";
  const clearQueueClass = isDirector
    ? "rounded-md border border-[#0B6A0B] border-l-4 border-l-[#0B6A0B] bg-white p-3.5 sm:p-4"
    : `${neu.panelInset} p-4 sm:p-5`;
  const clearQueueText = isDirector
    ? "font-body text-[13px] font-medium leading-relaxed text-[#0B6A0B]"
    : "text-sm text-emerald-700";
  const hoverLead = isDirector ? "hover:text-[#005CAB]" : "hover:text-indigo-600";
  const hoverAi = isDirector ? "hover:text-[#005CAB]" : "hover:text-indigo-600";

  const greetingParts = useMemo(() => {
    const raw = welcomeHeadline.trim();
    const comma = raw.indexOf(",");
    if (comma === -1) return { lead: raw, name: "" };
    return {
      lead: raw.slice(0, comma).trim(),
      name: raw.slice(comma + 1).trim()
    };
  }, [welcomeHeadline]);

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
        href: "/director/crm",
        action: "Open CRM"
      });
    }

    if (queue.messagesCount > 0) {
      items.push({
        id: "messages",
        tone: "warning",
        title: `${queue.messagesCount} report thread${queue.messagesCount === 1 ? "" : "s"} need a reply`,
        detail: "Sales or developer questions on submitted reports.",
        href: "/director/reports",
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
      { label: "active", value: kpis.projectHealth.activeProjects, color: "bg-[#005CAB]" },
      { label: "overdue", value: kpis.projectHealth.overdueTasks, color: "bg-[#C50F1F]" },
      { label: "blocked", value: kpis.projectHealth.blockedTasks, color: "bg-[#C19C00]" }
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
        color: "bg-[#005CAB]"
      },
      {
        label: "Stalled deals",
        value: directorDashboard.salesHealth.stalledDealsCount,
        color: "bg-[#C19C00]"
      },
      {
        label: "At-risk projects",
        value: directorDashboard.operationalHealth.projectsAtRisk,
        color: "bg-[#C50F1F]"
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
    <div className={`flex w-full min-w-0 flex-col gap-5 bg-white pb-6 ${isDirector ? "director-neu" : ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E1DFDD] bg-white pb-5">
        <div className="min-w-0 max-w-3xl">
          {isDirector ? (
            <>
              <p className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-[#005CAB]">
                Director · command center
              </p>
              <h1 className="mt-2 font-display text-[1.85rem] font-bold leading-[1.1] tracking-[-0.035em] text-[#201F1E] sm:text-[2.35rem]">
                <span className="font-semibold text-[#605E5C]">{greetingParts.lead}</span>
                {greetingParts.name ? (
                  <>
                    <span className="font-semibold text-[#C8C6C4]">,</span>{" "}
                    <span className="text-[#005CAB]">{greetingParts.name}</span>
                  </>
                ) : null}
              </h1>
              <p className="mt-3 max-w-2xl font-body text-[15px] font-medium leading-[1.55] tracking-[-0.01em] text-[#605E5C]">
                {headerSubtitle}
              </p>
            </>
          ) : (
            <>
              <p className={`font-label text-[11px] font-semibold tracking-wide ${accentMuted}`}>
                {workspaceLabel}
              </p>
              <h1 className={`mt-0.5 font-display text-2xl font-semibold tracking-tight ${bodyStrong}`}>
                {welcomeHeadline}
              </h1>
              <p className={`mt-1 max-w-xl font-body text-[13px] font-medium leading-relaxed ${bodyMuted}`}>
                {headerSubtitle}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${isDirector ? `${directorNeuTokens.btnGhost} !px-3.5 !py-2 !text-[12px] !font-semibold` : neu.btnGhost} shrink-0 disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {variant === "admin" ? <AdminAiCommandWidget /> : null}

      {alertItems.length > 0 ? (
        <WorkspaceDashboardSection label="Today's priorities" roleKeys={roleKeys}>
          <WorkspacePriorityGrid items={alertItems} panelClass={alertClass} />
        </WorkspaceDashboardSection>
      ) : (
        <div className={clearQueueClass}>
          <p className={clearQueueText}>
            <span className="font-display font-bold tracking-tight">Queue clear</span>
            <span className="font-body"> — no urgent approvals, risks, or unread signals right now. Charts and team focus below stay live.</span>
          </p>
        </div>
      )}

      <WorkspaceAlignedTips
        tips={alignedTips}
        aiHint={alignedHint}
        panelClass={`${neu.panelInset} !bg-white p-3.5 sm:p-4`}
        roleKeys={roleKeys}
      />

      <WorkspaceDashboardSection label={queueLabel} roleKeys={roleKeys}>
        <div className={`mt-2 ${neu.kpiStrip}`}>
          <StatRow>
            <Link href="/approvals" className="min-w-0 transition hover:opacity-95">
              <StatInline
                label="Approvals"
                value={queue.approvalsPending}
                hint="Pending decisions"
                tone={queue.approvalsPending > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/leads" className="min-w-0 transition hover:opacity-95">
              <StatInline
                label="Leads queue"
                value={queue.leadsPendingApproval}
                hint="Need approval"
                tone={queue.leadsPendingApproval > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/community" className="min-w-0 transition hover:opacity-95">
              <StatInline
                label="Notifications"
                value={queue.unreadNotifications}
                hint="Unread in-app"
                tone={queue.unreadNotifications > 0 ? "rose" : "sky"}
              />
            </Link>
            <Link href="/projects" className="min-w-0 transition hover:opacity-95">
              <StatInline
                label="Projects"
                value={directorDashboard?.operationalHealth.activeProjects ?? projects.length}
                hint={`${directorDashboard?.operationalHealth.projectsAtRisk ?? 0} at risk`}
                tone="violet"
              />
            </Link>
            {directorDashboard ? (
              <StatInline
                label="Pipeline"
                value={formatMoney(directorDashboard.salesHealth.totalPipelineValue)}
                hint={`Win ${directorDashboard.salesHealth.winRate.toFixed(0)}% · ${directorDashboard.salesHealth.stalledDealsCount} stalled`}
                tone="sky"
              />
            ) : (
              <StatInline
                label="Work progress"
                value={`${queue.workProgressPercent}%`}
                hint="Org delivery signal"
                tone="emerald"
              />
            )}
          </StatRow>
        </div>
      </WorkspaceDashboardSection>

      <nav
        aria-label="Director quick links"
        className={`flex flex-wrap gap-1.5 border-b pb-3 ${isDirector ? "border-[#E1DFDD]" : "border-[#E5E9EF]"}`}
      >
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className={quickLinkClass}>
            {link.label}
          </Link>
        ))}
      </nav>

      {directorDashboard && (
        <WorkspaceDashboardSection label="Org pulse" roleKeys={roleKeys}>
          <div className={`mt-2 ${neu.kpiStrip}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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
              <Link href="/approvals" className="min-w-0 transition hover:opacity-95">
                <StatInline
                  label="Approval queue"
                  value={directorDashboard.approvalQueue.totalPending}
                  hint="Finance & ops"
                  tone="amber"
                />
              </Link>
              <StatInline
                label="Work progress"
                value={`${queue.workProgressPercent}%`}
                hint="Org delivery signal"
                tone="emerald"
              />
            </div>
          </div>
          {!canViewFinanceKpis && (
            <p className={`mt-2 text-[11px] ${bodyMuted}`}>
              Finance totals restricted — Admin can enable <span className={`font-semibold ${bodyStrong}`}>Can see finance</span> on
              your profile.
            </p>
          )}
          {canViewFinanceKpis && directorDashboard.financialHealth && (
            <div className={`mt-2 ${neu.kpiStrip}`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatInline label="Revenue" value={formatMoney(directorDashboard.financialHealth.revenueThisPeriod)} tone="emerald" />
                <StatInline label="Outstanding" value={formatMoney(directorDashboard.financialHealth.outstandingInvoices)} tone="amber" />
                <StatInline label="Net flow" value={formatMoney(directorDashboard.financialHealth.netFlow)} tone="sky" />
                <StatInline label="Expense approvals" value={directorDashboard.financialHealth.pendingExpenseApprovals} tone="rose" />
              </div>
            </div>
          )}
        </WorkspaceDashboardSection>
      )}

      <section aria-label="Progress charts" className="w-full">
        <DashboardSectionLabel roleKeys={roleKeys}>Progress charts</DashboardSectionLabel>
        <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
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
              <p className={`text-sm ${bodyMuted}`}>Loading pipeline signals…</p>
            )}
          </ChartPanel>
        </div>
      </section>

      <WorkspaceDashboardSection label="Active projects" roleKeys={roleKeys}>
          <div className={`mt-2 overflow-x-auto ${neu.panelInset}`}>
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className={`border-b ${isDirector ? "border-[#E1DFDD]" : "border-[#D6E4E4]"} text-[10px] font-bold uppercase tracking-wider ${bodyMuted}`}>
                <th className="px-2.5 py-2">Project</th>
                <th className="px-2.5 py-2">Created by</th>
                <th className="px-2.5 py-2">Status</th>
                <th className="px-2.5 py-2">Approval</th>
                <th className="px-2.5 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 12).map((p) => (
                <tr key={p.id} className={`border-b ${isDirector ? "border-[#F5F5F5]" : "border-[#E5E9EF]"} ${bodySecondary}`}>
                  <td className={`px-2.5 py-2 font-semibold ${bodyStrong}`}>{p.name}</td>
                  <td className="px-2.5 py-2">{p.createdBy?.name ?? p.createdBy?.email ?? "—"}</td>
                  <td className="px-2.5 py-2 capitalize">{p.status}</td>
                  <td className="px-2.5 py-2 text-[12px]">{p.approvalStatus ?? "—"}</td>
                  <td className="px-2.5 py-2 text-right">
                    <Link href={`/projects/${p.id}`} className={`text-[11px] font-bold ${accentLink} hover:underline`}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-2.5 py-6 text-center ${bodyMuted}`}>
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
          <div className={`mt-2 overflow-x-auto ${neu.panelInset}`}>
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className={`border-b ${isDirector ? "border-[#E1DFDD]" : "border-[#D6E4E4]"} text-[10px] font-bold uppercase tracking-wider ${bodyMuted}`}>
                  <th className="px-2.5 py-2">Person</th>
                  <th className="px-2.5 py-2">Roles</th>
                  <th className="px-2.5 py-2">Project</th>
                  <th className="px-2.5 py-2">Note</th>
                  <th className="px-2.5 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {directorDashboard.teamCurrentFocus.map((row) => (
                  <tr key={row.userId} className={`border-b ${isDirector ? "border-[#F5F5F5]" : "border-[#E5E9EF]"} ${bodySecondary}`}>
                    <td className={`px-2.5 py-2 font-semibold ${bodyStrong}`}>{row.name?.trim() || row.email}</td>
                    <td className="px-2.5 py-2 text-[12px]">
                      {row.roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") || "—"}
                    </td>
                    <td className="px-2.5 py-2">
                      {row.project ? (
                        <Link href={`/projects/${row.project.id}`} className={`font-semibold ${accentLink} hover:underline`}>
                          {row.project.name}
                        </Link>
                      ) : (
                        <span className={bodyMuted}>Not set</span>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-2.5 py-2">{row.note?.trim() || "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[11px]">
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
          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            {unreadNotifications.length > 0 && (
              <Panel inset className="p-4">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${chartAccent}`}>Notifications</p>
                <ul className="mt-2 space-y-2">
                  {unreadNotifications.slice(0, 5).map((n) => (
                    <li key={n.id} className={`${neu.listRow} text-sm ${bodySecondary}`}>
                      {(n.subject || n.body).slice(0, 72)}
                      {(n.subject || n.body).length > 72 ? "…" : ""}
                    </li>
                  ))}
                </ul>
                <Link href="/community" className={`mt-3 inline-block text-xs font-bold ${accentLink} hover:underline`}>
                  Open Community →
                </Link>
              </Panel>
            )}
            {(attention?.leadsPendingApproval?.length ?? 0) > 0 && (
              <Panel inset className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A68500]">Leads</p>
                <ul className="mt-2 space-y-2">
                  {attention!.leadsPendingApproval!.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/leads/${l.id}`}
                        className={`${neu.listRow} block text-sm ${bodySecondary} ${hoverLead}`}
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#C50F1F]">Approvals</p>
                <ul className="mt-2 space-y-2">
                  {attention!.approvalsPending!.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <Link href="/approvals" className={`${neu.listRow} block text-sm ${bodySecondary}`}>
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
            <p className={`mt-2 text-sm ${bodyMuted}`}>Loading activity…</p>
          ) : directorSummaryFeedFailed || !directorSummaryFeed ? (
            <p className="mt-2 text-sm font-medium text-[#C50F1F]">Could not load activity feed.</p>
          ) : (
            <div className={`mt-3 ${neu.panelInset} max-h-80 overflow-y-auto p-3`}>
              <p className={`mb-3 text-xs ${bodyMuted}`}>
                Day {formatBriefingDate(directorSummaryFeed.dateKey)}
                {directorSummaryFeed.aiDailyBrief ? (
                  <span className="ml-2 font-semibold text-[#0B6A0B]">· AI digest ready</span>
                ) : (
                  <span className="ml-2 font-semibold text-[#A68500]">· Digest at {directorSummaryFeed.aiReportHourLocal}:00</span>
                )}
              </p>
              {meaningfulActions.length === 0 ? (
                <p className={`text-sm ${bodyMuted}`}>No significant platform events today yet (logins hidden).</p>
              ) : (
                <ul className="space-y-2">
                  {meaningfulActions.map((a) => (
                    <li key={a.id} className={`${neu.listRow} px-3 py-2`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className={`text-xs font-bold ${accentSoft}`}>{a.type.replace(/_/g, " ")}</span>
                        <span className={`text-[10px] ${bodyMuted}`}>
                          {formatActionTime(a.createdAt, directorSummaryFeed.tz)}
                        </span>
                      </div>
                      <p className={`mt-1 text-sm ${bodySecondary}`}>{a.summary}</p>
                      {a.actorLabel ? <p className={`mt-0.5 text-xs ${bodyMuted}`}>{a.actorLabel}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/activity" className={`mt-3 inline-block text-xs font-bold ${accentLink} hover:underline`}>
                Full activity log →
              </Link>
            </div>
          )}
        </WorkspaceDashboardSection>

        <WorkspaceDashboardSection label="Daily AI summaries" roleKeys={roleKeys}>
          {directorAiBriefings === null ? (
            <p className={`mt-2 text-sm ${bodyMuted}`}>Loading briefings…</p>
          ) : directorAiBriefings.length === 0 ? (
            <p className={`mt-2 text-sm ${bodyMuted}`}>No AI summaries yet.</p>
          ) : (
            <ul className={`mt-3 space-y-2 ${neu.panelInset} p-3`}>
              {directorAiBriefings.slice(0, 5).map((r) => (
                <li key={r.id} className={`${neu.listRow} p-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs font-bold ${accentSoft}`}>{formatBriefingDate(r.dateKey)}</p>
                    <Link href="/reports/ai" className={`text-[10px] font-bold ${accentLink} hover:underline`}>
                      Open →
                    </Link>
                  </div>
                  <p className={`mt-1 text-sm font-semibold ${bodyStrong}`}>{r.subject}</p>
                  <DirectorBriefingPreview body={r.bodyPreview} className="mt-2" />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/reports/ai"
            className={`mt-2 inline-block text-xs font-medium ${bodyMuted} ${hoverAi}`}
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
      <h3 className={`text-[11px] font-semibold tracking-wide ${accentClass}`}>{title}</h3>
      <div className="mt-3 flex w-full flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function AdminOverviewDashboard(props: Omit<DirectorOverviewDashboardProps, "variant">) {
  return <DirectorOverviewDashboard {...props} variant="admin" />;
}
