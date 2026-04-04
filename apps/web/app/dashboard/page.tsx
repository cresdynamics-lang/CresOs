"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../data-refresh";
import { PageHeader } from "../page-header";
import { formatMoney } from "../format-money";
import { notify, requestNotificationPermission } from "../browser-notify";

type Summary = {
  leadsThisWeek: number;
  dealsWon: number;
  revenueReceived: number;
  invoiceOutstanding: number;
  activeProjects: number;
  teamMembers?: number;
};

type DirectorDashboard = {
  financialHealth: {
    revenueThisPeriod: number;
    outstandingInvoices: number;
    overdueInvoices: number;
    cashIn: number;
    cashOut: number;
    netFlow: number;
    forecast30Day: { cashIn: number; cashOut: number; netFlow: number };
    pendingPayouts: number;
    pendingExpenseApprovals: number;
  };
  salesHealth: {
    totalPipelineValue: number;
    weightedForecast: number;
    winRate: number;
    stalledDealsCount: number;
    averageDealCycleDays: number;
  };
  operationalHealth: {
    activeProjects: number;
    projectsAtRisk: number;
    blockedTasksAboveThreshold: number;
    milestonesPendingApproval: number;
    teamOverload: unknown;
  };
  approvalQueue: { totalPending: number };
  teamCurrentFocus?: {
    userId: string;
    name: string | null;
    email: string;
    roleKeys: string[];
    project: {
      id: string;
      name: string;
      status: string;
      approvalStatus: string;
    } | null;
    note: string | null;
    updatedAt: string | null;
  }[];
  riskSummary: { financial: unknown[]; operational: unknown[]; sales: unknown[] };
};

type Attention = {
  notifications: { id: string; subject: string | null; body: string; readAt: string | null; createdAt: string; type: string }[];
  upcomingMeetings: { id: string; type: string; scheduledAt: string; name: string | null; lead: { id: string; title: string } }[];
  upcomingCalls: { id: string; type: string; scheduledAt: string; name: string | null; lead: { id: string; title: string } }[];
  leadsPendingApproval: { id: string; title: string; owner: { name: string | null; email: string } | null }[];
  approvalsPending: { id: string; entityType: string; entityId: string; requester: { name: string | null; email: string } | null }[];
  stats?: {
    notificationsCount: number;
    messagesCount: number;
    dueCount: number;
    workProgressPercent: number;
    reportStreakDays: number;
    tasksOverdue?: number;
    tasksDueSoon?: number;
    developerReportStreakDays?: number;
    needsAttentionCount?: number;
  };
  messages?: { id: string; reportId: string; content: string; askedAt: string }[];
  dueToday?: { id: string; type: string; scheduledAt: string; lead: { id: string; title: string } }[];
  reportReminderDue?: boolean;
  lastReportSubmittedAt?: string | null;
  projectsNeedingReview?: { id: string; name: string }[];
  handoffRequestsReceived?: { id: string; projectId: string; project: { name: string }; fromUser: { name: string | null; email: string } }[];
  overdueTasks?: { id: string; title: string; projectId: string; dueDate: string }[];
  latestDeveloperReportNeedsAttention?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst",
  client: "Client"
};

const ROLE_QUICK_LINKS: Record<string, { href: string; label: string }[]> = {
  sales: [
    { href: "/crm", label: "CRM" },
    { href: "/leads", label: "Leads" },
    { href: "/reports", label: "My reports" },
    { href: "/meeting-requests", label: "Director meeting" }
  ],
  developer: [
    { href: "/projects", label: "Projects" },
    { href: "/developer-reports", label: "Reports" },
    { href: "/meeting-requests", label: "Director meeting" }
  ],
  director_admin: [
    { href: "/projects", label: "Projects" },
    { href: "/leads", label: "Leads" },
    { href: "/approvals", label: "Approvals" },
    { href: "/analytics", label: "Analytics" },
    { href: "/developer-reports", label: "Reports" },
    { href: "/meeting-requests", label: "Meeting requests" }
  ],
  finance: [{ href: "/finance", label: "Finance" }, { href: "/approvals", label: "Approvals" }],
  analyst: [{ href: "/analytics", label: "Analytics" }, { href: "/crm", label: "CRM" }],
  admin: [
    { href: "/admin", label: "Users & org" },
    { href: "/meeting-requests", label: "Meetings" },
    { href: "/analytics", label: "Analytics" }
  ],
  client: []
};

const REPORT_REMINDER_DISMISS_KEY = "cresos_report_reminder_dismiss";

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [attention, setAttention] = useState<Attention | null>(null);
  const [reportReminderDismissed, setReportReminderDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const until = sessionStorage.getItem(REPORT_REMINDER_DISMISS_KEY);
    return until ? Date.now() < parseInt(until, 10) : false;
  });
  const [directorDashboard, setDirectorDashboard] = useState<DirectorDashboard | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const { apiFetch, auth } = useAuth();
  const isDirectorOrAdmin = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));
  const isDirectorOnly =
    auth.roleKeys.includes("director_admin") && !auth.roleKeys.includes("admin");

  /** Org-wide analytics metrics (main dashboard tiles) — not shown to sales-only / developer-only roles. */
  const canViewOrgAnalyticsSummary = useMemo(
    () =>
      auth.roleKeys.some((r) => ["admin", "director_admin", "finance", "analyst"].includes(r)),
    [auth.roleKeys]
  );
  const isSalesOrDeveloper = auth.roleKeys.some((r) => ["sales", "developer"].includes(r));

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  const dismissReportReminder = () => {
    setReportReminderDismissed(true);
    sessionStorage.setItem(REPORT_REMINDER_DISMISS_KEY, String(Date.now() + 60 * 60 * 1000));
  };

  const loadSummaryAndAttention = useCallback(async () => {
    try {
      if (canViewOrgAnalyticsSummary) {
        const summaryRes = await apiFetch("/analytics/summary");
        if (summaryRes.ok) {
          const data = (await summaryRes.json()) as Summary;
          setSummary(data);
          setSummaryError(false);
        } else {
          setSummaryError(true);
        }
      } else {
        setSummary(null);
        setSummaryError(false);
      }

      const attentionRes = await apiFetch("/dashboard/attention");
      if (attentionRes.ok) {
        const data = (await attentionRes.json()) as Attention;
        setAttention(data);
        if (data?.notifications) {
          const unread = data.notifications.filter((n) => !n.readAt);
          let first = true;
          for (const n of unread.slice(0, 5)) {
            if (notifiedIdsRef.current.has(n.id)) continue;
            notifiedIdsRef.current.add(n.id);
            notify(n.subject ?? "Reminder", {
              body: n.body?.slice(0, 120) ?? "",
              tag: `notif-${n.id}`,
              playSound: first
            });
            first = false;
          }
        }
      }
    } catch {
      if (canViewOrgAnalyticsSummary) {
        setSummaryError(true);
      }
    }
  }, [apiFetch, canViewOrgAnalyticsSummary]);

  const loadDirectorDashboard = useCallback(async () => {
    if (!isDirectorOrAdmin) return;
    try {
      const res = await apiFetch("/director/dashboard");
      if (res.ok) {
        const data = (await res.json()) as DirectorDashboard;
        setDirectorDashboard(data);
      }
    } catch {
      // ignore
    }
  }, [isDirectorOrAdmin, apiFetch]);

  useEffect(() => {
    void loadSummaryAndAttention();
  }, [loadSummaryAndAttention]);

  useEffect(() => {
    void loadDirectorDashboard();
  }, [loadDirectorDashboard]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadSummaryAndAttention();
        void loadDirectorDashboard();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => {
      void loadSummaryAndAttention();
      void loadDirectorDashboard();
    });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [loadSummaryAndAttention, loadDirectorDashboard]);

  const quickLinks = Array.from(
    new Map(
      auth.roleKeys.flatMap((r) => ROLE_QUICK_LINKS[r] ?? []).map((l) => [l.href, l])
    ).values()
  );
  const hasMetrics = canViewOrgAnalyticsSummary && summary != null && !summaryError;
  const primaryRoleLabel = auth.roleKeys.map((r) => ROLE_LABELS[r]).filter(Boolean)[0] ?? "User";
  const unreadCount = attention?.stats?.notificationsCount ?? attention?.notifications?.filter((n) => !n.readAt).length ?? 0;
  const messagesCount = attention?.stats?.messagesCount ?? attention?.messages?.length ?? 0;
  const dueCount = attention?.stats?.dueCount ?? attention?.dueToday?.length ?? 0;
  const workProgress = attention?.stats?.workProgressPercent ?? 0;
  const reportStreak = attention?.stats?.reportStreakDays ?? 0;
  const tasksOverdue = attention?.stats?.tasksOverdue ?? 0;
  const tasksDueSoon = attention?.stats?.tasksDueSoon ?? 0;
  const developerReportStreak = attention?.stats?.developerReportStreakDays ?? 0;
  const needsAttentionCount = attention?.stats?.needsAttentionCount ?? 0;
  const reportReminderDue = attention?.reportReminderDue === true && auth.roleKeys.includes("sales") && !reportReminderDismissed;
  const projectsNeedingReview = attention?.projectsNeedingReview ?? [];
  const handoffRequests = attention?.handoffRequestsReceived ?? [];
  const overdueTasks = attention?.overdueTasks ?? [];
  const latestDeveloperReportNeedsAttention = attention?.latestDeveloperReportNeedsAttention ?? null;
  const isDeveloper = auth.roleKeys.includes("developer");
  const isAdmin = auth.roleKeys.includes("admin");
  const hasAttention =
    unreadCount > 0 ||
    messagesCount > 0 ||
    dueCount > 0 ||
    (attention?.upcomingMeetings?.length ?? 0) > 0 ||
    (attention?.upcomingCalls?.length ?? 0) > 0 ||
    (attention?.leadsPendingApproval?.length ?? 0) > 0 ||
    (attention?.approvalsPending?.length ?? 0) > 0 ||
    projectsNeedingReview.length > 0 ||
    handoffRequests.length > 0 ||
    (isDeveloper && (needsAttentionCount > 0 || (latestDeveloperReportNeedsAttention?.length ?? 0) > 0));

  const pendingFinanceApprovals =
    attention?.approvalsPending?.filter(
      (a) => a.entityType === "expense" || a.entityType === "payout"
    ).length ??
    directorDashboard?.approvalQueue.totalPending ??
    0;
  const atRiskProjects = directorDashboard?.operationalHealth.projectsAtRisk ?? 0;
  const teamMembers = summary?.teamMembers ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title={`${primaryRoleLabel} dashboard`}
        description={
          canViewOrgAnalyticsSummary
            ? "Operating System for Growth — one place for approvals, delivery signals, and finance health."
            : isSalesOrDeveloper
              ? "Your queue and work history — org-wide analytics are reserved for leadership roles. Submitted report history is read-only."
              : "Operating System for Growth — one place for approvals, delivery signals, and your work."
        }
      />

      {!canViewOrgAnalyticsSummary && isSalesOrDeveloper && (
        <div className="shell border-sky-800/50 bg-sky-950/25">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Your work history (read-only)
          </h3>
          <p className="mb-3 text-sm text-slate-400">
            Past submissions stay on record for visibility; you cannot edit or delete locked entries. You can still file
            new daily or activity reports from the pages below.
          </p>
          <div className="flex flex-wrap gap-3">
            {auth.roleKeys.includes("sales") && (
              <Link
                href="/reports"
                className="rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20"
              >
                Sales reports →
              </Link>
            )}
            {auth.roleKeys.includes("developer") && (
              <Link
                href="/developer-reports"
                className="rounded-lg border border-sky-600/40 bg-sky-950/40 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-900/50"
              >
                Developer reports →
              </Link>
            )}
          </div>
        </div>
      )}

      {isAdmin && directorDashboard && summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="shell border-slate-700/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active projects</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{summary.activeProjects}</p>
            <p className="text-xs text-slate-500">Across all teams</p>
          </div>
          <div className="shell border-slate-700/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pending approvals</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">{pendingFinanceApprovals}</p>
            <p className="text-xs text-slate-500">Finance requests</p>
          </div>
          <div className="shell border-slate-700/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">At risk</p>
            <p className="mt-1 text-2xl font-semibold text-rose-300">{atRiskProjects}</p>
            <p className="text-xs text-slate-500">Delayed or stalled</p>
          </div>
          <div className="shell border-slate-700/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Team members</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{teamMembers}</p>
            <p className="text-xs text-slate-500">Seats in this workspace</p>
          </div>
        </div>
      )}

      {isAdmin && directorDashboard && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="shell border-l-4 border-amber-500/60 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-amber-100/90">Director-level overview</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Read-only revenue, outstanding amounts, net flow, pipeline value, win rate, stalled deals, and active or at-risk projects — aligned for governance.
            </p>
            <Link
              href="/analytics"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-300 hover:text-amber-200"
            >
              See data sources →
            </Link>
          </div>
          <div className="shell border-l-4 border-emerald-500/60 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-emerald-200">Approval queue</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Pending Finance requests surface here and in the header. The badge turns warning when more than three requests are waiting.
            </p>
            <Link
              href="/approvals"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-300 hover:text-emerald-200"
            >
              Go to approvals →
            </Link>
          </div>
          <div className="shell border-l-4 border-sky-500/60 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-sky-200">Work progress tracker</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Aggregated module completion across active projects updates as developers complete work. You can&apos;t edit this directly — it reflects live delivery.
            </p>
            <p className="mt-3 text-2xl font-semibold text-sky-300">{workProgress}%</p>
          </div>
          <div className="shell border-l-4 border-rose-500/50 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-rose-200">Your duties</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Admin-scoped items only: pending approvals, access requests, and governance reviews — not developer or sales task lists.
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-200/90 hover:text-rose-100"
            >
              Users &amp; org →
            </Link>
          </div>
        </div>
      )}

      {projectsNeedingReview.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-600/50 bg-sky-950/40 px-4 py-3">
          <p className="text-sm text-sky-200">
            Review and add tasks for {projectsNeedingReview.length} project(s) assigned to you.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {projectsNeedingReview.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {handoffRequests.length > 0 && (
        <div className="rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-3">
          <p className="mb-2 text-sm font-medium text-slate-200">Handoff requests</p>
          <ul className="space-y-2">
            {handoffRequests.map((h) => (
              <HandoffRespondRow key={h.id} requestId={h.id} projectName={h.project.name} fromUser={h.fromUser} apiFetch={apiFetch} onDone={() => setAttention((a) => ({ ...a!, handoffRequestsReceived: (a?.handoffRequestsReceived ?? []).filter((r) => r.id !== h.id) }))} />
            ))}
          </ul>
        </div>
      )}

      {reportReminderDue && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-3">
          <p className="text-sm text-amber-200">
            It’s been 12+ hours since your last report (and no current-focus update in that window). Submit a report to keep your streak and stay on track.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/reports/new"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              Submit report
            </Link>
            <button
              type="button"
              onClick={dismissReportReminder}
              className="rounded p-1.5 text-amber-300 hover:bg-amber-900/50"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {(auth.roleKeys.includes("developer") || auth.roleKeys.includes("sales")) && (
        <CurrentFocusPanel apiFetch={apiFetch} />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Notifications" value={unreadCount} />
        <StatCard label="Messages" value={messagesCount} sub="to respond" />
        <StatCard label="Due today" value={dueCount} />
        <StatCard label="Work progress" value={`${workProgress}%`} />
        <StatCard label="Report streak" value={isDeveloper ? developerReportStreak : reportStreak} sub="days" />
        {isDeveloper && <StatCard label="Needs attention" value={needsAttentionCount} />}
      </div>

      {hasAttention && attention && (
        <div className="shell border-brand/30 bg-brand/5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            What needs your attention
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unreadCount > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Notifications</p>
                <ul className="space-y-1 text-sm">
                  {attention.notifications.filter((n) => !n.readAt).slice(0, 5).map((n) => (
                    <li key={n.id} className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5">
                      <span className="text-slate-200">{(n.subject || n.body).slice(0, 60)}{(n.body?.length > 60 ? "…" : "")}</span>
                    </li>
                  ))}
                  {unreadCount > 5 && <li className="text-slate-400">+{unreadCount - 5} more</li>}
                </ul>
              </div>
            )}
            {messagesCount > 0 && attention.messages && attention.messages.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Messages (need response)</p>
                <ul className="space-y-1 text-sm">
                  {attention.messages.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <Link href={`/reports/${m.reportId}`} className="text-brand hover:underline">
                        {m.content.slice(0, 50)}{m.content.length > 50 ? "…" : ""}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dueCount > 0 && attention.dueToday && attention.dueToday.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Due today</p>
                <ul className="space-y-1 text-sm">
                  {attention.dueToday.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <Link href={`/leads/${d.lead.id}`} className="text-brand hover:underline">
                        {d.lead.title}
                      </Link>
                      <span className="ml-1 text-slate-400">{new Date(d.scheduledAt).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.upcomingMeetings?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Upcoming meetings</p>
                <ul className="space-y-1 text-sm">
                  {attention.upcomingMeetings.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <Link href={`/leads/${m.lead.id}`} className="text-brand hover:underline">
                        {m.lead.title}
                      </Link>
                      <span className="ml-1 text-slate-400">{new Date(m.scheduledAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.upcomingCalls?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Upcoming calls</p>
                <ul className="space-y-1 text-sm">
                  {attention.upcomingCalls.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link href={`/leads/${c.lead.id}`} className="text-brand hover:underline">
                        {c.lead.title}
                      </Link>
                      <span className="ml-1 text-slate-400">{new Date(c.scheduledAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.leadsPendingApproval?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Leads pending approval</p>
                <ul className="space-y-1 text-sm">
                  {attention.leadsPendingApproval.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link href={`/leads/${l.id}`} className="text-brand hover:underline">
                        {l.title}
                      </Link>
                      {l.owner && <span className="ml-1 text-slate-400">({l.owner.name ?? l.owner.email})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.approvalsPending?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Approvals pending</p>
                <ul className="space-y-1 text-sm">
                  {attention.approvalsPending.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <Link href="/approvals" className="text-brand hover:underline">
                        {a.entityType} #{a.entityId.slice(0, 8)}
                      </Link>
                      {a.requester && <span className="ml-1 text-slate-400">({a.requester.name ?? a.requester.email})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isDeveloper && overdueTasks.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Overdue tasks</p>
                <ul className="space-y-1 text-sm">
                  {overdueTasks.slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <Link href={`/projects/${t.projectId}`} className="text-brand hover:underline">
                        {t.title}
                      </Link>
                      <span className="ml-1 text-slate-400">Due {new Date(t.dueDate).toLocaleDateString()}</span>
                    </li>
                  ))}
                  {overdueTasks.length > 5 && <li className="text-slate-400">+{overdueTasks.length - 5} more</li>}
                </ul>
              </div>
            )}
            {isDeveloper && latestDeveloperReportNeedsAttention && (
              <div>
                <p className="mb-1 text-xs text-slate-400">From your last report — needs attention</p>
                <p className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-200">
                  {latestDeveloperReportNeedsAttention.slice(0, 200)}
                  {latestDeveloperReportNeedsAttention.length > 200 ? "…" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isDeveloper && (workProgress > 0 || developerReportStreak > 0 || tasksOverdue > 0 || tasksDueSoon > 0) && (
        <div className="shell border-sky-800/40 bg-sky-950/20">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Performance</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Work progress</p>
              <p className="mt-1 text-2xl font-semibold text-sky-400">{workProgress}%</p>
              <p className="text-xs text-slate-500">Tasks done vs assigned</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Report streak</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">{developerReportStreak} day{developerReportStreak !== 1 ? "s" : ""}</p>
              <p className="text-xs text-slate-500">Consecutive days with reports</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Tasks overdue</p>
              <p className="mt-1 text-2xl font-semibold text-rose-400">{tasksOverdue}</p>
              <p className="text-xs text-slate-500">Past due date</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Tasks due soon</p>
              <p className="mt-1 text-2xl font-semibold text-amber-400">{tasksDueSoon}</p>
              <p className="text-xs text-slate-500">Next 7 days</p>
            </div>
          </div>
        </div>
      )}

      {isDirectorOrAdmin && directorDashboard && (
        <div className="shell border-sky-800/50 bg-sky-950/30">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Director overview — aligned view</h3>
          <p className="mb-4 text-xs text-slate-400">
            {isDirectorOnly
              ? "Sales, delivery, and operational signals in one place. Invoice and billing detail live under Finance for Admin."
              : "Sales, delivery, finance, and approvals in one place. All amounts in Kenyan Shillings (KES)."}
          </p>
          <div
            className={`grid gap-4 ${isDirectorOnly ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}
          >
            {!isDirectorOnly && (
              <div>
                <p className="text-xs text-slate-400">Financial health</p>
                <p className="mt-1 text-sm text-slate-200">
                  Revenue (period): {formatMoney(directorDashboard.financialHealth.revenueThisPeriod)}
                </p>
                <p className="text-sm text-slate-200">
                  Outstanding: {formatMoney(directorDashboard.financialHealth.outstandingInvoices)}
                </p>
                <p className="text-sm text-slate-200">Net flow: {formatMoney(directorDashboard.financialHealth.netFlow)}</p>
                <p className="text-xs text-slate-400">
                  Pending approvals: {directorDashboard.financialHealth.pendingExpenseApprovals}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400">Sales health</p>
              <p className="mt-1 text-sm text-slate-200">Pipeline: {formatMoney(directorDashboard.salesHealth.totalPipelineValue)}</p>
              <p className="text-sm text-slate-200">Win rate: {directorDashboard.salesHealth.winRate.toFixed(0)}%</p>
              <p className="text-sm text-slate-200">Stalled deals: {directorDashboard.salesHealth.stalledDealsCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Operational health</p>
              <p className="mt-1 text-sm text-slate-200">Active projects: {directorDashboard.operationalHealth.activeProjects}</p>
              <p className="text-sm text-slate-200">At risk: {directorDashboard.operationalHealth.projectsAtRisk}</p>
              <p className="text-sm text-slate-200">Blocked tasks (threshold): {directorDashboard.operationalHealth.blockedTasksAboveThreshold}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Approval queue</p>
              <p className="mt-1 text-xl font-semibold text-amber-400">{directorDashboard.approvalQueue.totalPending} pending</p>
              <Link href="/approvals" className="mt-1 inline-block text-sm text-sky-400 hover:underline">View approvals →</Link>
            </div>
          </div>
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Team — current project focus</h4>
            <div className="overflow-x-auto rounded-lg border border-slate-700/80">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Team current focus</caption>
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Person</th>
                    <th className="px-3 py-2 font-medium">Roles</th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(directorDashboard.teamCurrentFocus ?? []).map((row) => (
                    <tr key={row.userId} className="border-b border-slate-800/80 text-slate-200">
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-100">{row.name?.trim() || row.email}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {row.roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.project ? (
                          <Link href={`/projects/${row.project.id}`} className="text-sky-400 hover:underline">
                            {row.project.name}
                          </Link>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="max-w-[14rem] px-3 py-2 text-slate-400">{row.note?.trim() || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {hasMetrics && (
        <div
          className={`grid gap-4 ${isDirectorOnly ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}
        >
          <Metric label="Leads this week" value={summary!.leadsThisWeek} tone="green" />
          <Metric label="Deals won" value={summary!.dealsWon} tone="green" />
          <Metric label="Active projects" value={summary!.activeProjects} tone="blue" />
          <Metric label="Revenue received" value={formatMoney(summary!.revenueReceived)} tone="green" />
          {!isDirectorOnly && (
            <Metric label="Invoices outstanding" value={formatMoney(summary!.invoiceOutstanding)} tone="amber" />
          )}
        </div>
      )}

      {auth.roleKeys.includes("sales") && (
        <div className="shell border-amber-800/40 bg-amber-950/20">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Report submission streak</h3>
          <p className="text-2xl font-bold text-amber-400">{reportStreak} day{reportStreak !== 1 ? "s" : ""}</p>
          <p className="mt-1 text-xs text-slate-400">
            Submit a report today to keep your streak. Consecutive days with at least one submitted report.
          </p>
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="shell">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Your duties</p>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CurrentFocusPanel({
  apiFetch
}: {
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfRes, pRes] = await Promise.all([apiFetch("/user/current-focus"), apiFetch("/projects")]);
      if (cfRes.ok) {
        const j = (await cfRes.json()) as {
          data?: { projectId?: string | null; note?: string | null; updatedAt?: string | null };
        };
        const d = j.data;
        setProjectId(d?.projectId ?? "");
        setNote(d?.note ?? "");
        setUpdatedAt(d?.updatedAt ?? null);
      }
      if (pRes.ok) {
        const list = (await pRes.json()) as { id: string; name: string }[];
        setProjects(Array.isArray(list) ? list.map((p) => ({ id: p.id, name: p.name })) : []);
      }
    } catch {
      setError("Could not load focus settings");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        projectId: projectId || null,
        note: note.trim() || null
      };
      const res = await apiFetch("/user/current-focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { updatedAt?: string } };
      if (!res.ok) {
        setError(j.error ?? "Save failed");
        return;
      }
      if (j.data?.updatedAt) setUpdatedAt(j.data.updatedAt);
      emitDataRefresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="shell border-slate-700/60">
        <p className="text-sm text-slate-400">Loading current focus…</p>
      </div>
    );
  }

  return (
    <div className="shell border-emerald-800/40 bg-emerald-950/15">
      <h3 className="mb-1 text-sm font-semibold text-slate-200">Today&apos;s project focus</h3>
      <p className="mb-3 text-xs text-slate-400">
        Choose the project you are mainly working on so admin and director see it on the strategic overview. Developers: an approved project you are assigned to. Sales: a project you created.
      </p>
      {error && <p className="mb-2 text-sm text-rose-400">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">— No project selected —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-[2] flex-col gap-1 text-xs text-slate-400">
          Short note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. finishing API integration"
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {updatedAt && (
        <p className="mt-2 text-xs text-slate-500">Last updated: {new Date(updatedAt).toLocaleString()}</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="shell">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-slate-400">{sub}</span>}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone: "green" | "amber" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-sky-400";
  return (
    <div className="shell">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function HandoffRespondRow({
  requestId,
  projectName,
  fromUser,
  apiFetch,
  onDone
}: {
  requestId: string;
  projectName: string;
  fromUser: { name: string | null; email: string };
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const fromName = fromUser.name || fromUser.email;
  async function respond(accept: boolean) {
    setLoading(true);
    try {
      const res = await apiFetch(`/projects/handoff-requests/${requestId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept })
      });
      if (res.ok) onDone();
    } finally {
      setLoading(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm">
      <span className="text-slate-200">
        <strong>{fromName}</strong> requested to hand off <strong>{projectName}</strong> to you.
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => respond(true)} disabled={loading} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
          Accept
        </button>
        <button type="button" onClick={() => respond(false)} disabled={loading} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50">
          Reject
        </button>
      </div>
    </li>
  );
}

