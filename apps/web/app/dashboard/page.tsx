"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../data-refresh";
import { PageHeader } from "../page-header";
import { DashboardCardRow, DashboardScrollCard } from "../../components/dashboard-card-row";
import { formatMoney } from "../format-money";
import { notify, requestNotificationPermission } from "../browser-notify";
import { classifyAttentionSignal, shouldPlayBrowserSoundForUser } from "../../lib/notification-signals";

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

/** Snippet rows from `GET /reports/ai?snippet=true` (daily director briefing). */
type DirectorAiBriefingSnippet = {
  id: string;
  dateKey: string;
  subject: string;
  createdAt: string;
  bodyPreview: string;
};

/** `GET /director/summary-actions` — platform activity for the org day + AI digest pointer. */
type DirectorSummaryActionRow = {
  id: string;
  source: "activity" | "event";
  createdAt: string;
  type: string;
  summary: string;
  detail: string | null;
  actorLabel: string | null;
};

type DirectorSummaryFeed = {
  dateKey: string;
  tz: string;
  aiReportHourLocal: number;
  actions: DirectorSummaryActionRow[];
  aiDailyBrief: { id: string; subject: string; createdAt: string } | null;
};

function formatBriefingDateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(d.getTime()) ? dateKey : d.toLocaleDateString();
}

function formatSummaryActionTime(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
}

type DashboardKpis = {
  finance: {
    revenueThisMonth: number;
    outstandingInvoicesAmount: number;
    overdueInvoicesCount: number;
    expensesThisMonth: number;
  };
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

type Attention = {
  notifications: {
    id: string;
    subject: string | null;
    body: string;
    readAt: string | null;
    createdAt: string;
    type?: string;
  }[];
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

type ProjectListRow = {
  id: string;
  name: string;
  status: string;
  approvalStatus?: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
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
    { href: "/sales", label: "Sales hub" },
    { href: "/crm", label: "CRM" },
    { href: "/leads", label: "Leads" },
    { href: "/reports", label: "My reports" },
    { href: "/approvals", label: "Approvals" }
  ],
  developer: [
    { href: "/projects", label: "Projects" },
    { href: "/developer-reports", label: "Reports" },
    { href: "/community", label: "Community" }
  ],
  director_admin: [
    { href: "/projects", label: "Projects" },
    { href: "/leads", label: "Leads" },
    { href: "/approvals", label: "Approvals" },
    { href: "/analytics", label: "Analytics" },
    { href: "/developer-reports", label: "Reports" }
  ],
  finance: [{ href: "/finance", label: "Finance" }, { href: "/approvals", label: "Approvals" }],
  analyst: [{ href: "/analytics", label: "Analytics" }, { href: "/crm", label: "CRM" }],
  admin: [
    { href: "/admin/users", label: "Users & org" },
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
  /** `null` until first fetch completes for directors/admin. */
  const [directorAiBriefings, setDirectorAiBriefings] = useState<DirectorAiBriefingSnippet[] | null>(null);
  const [directorSummaryFeed, setDirectorSummaryFeed] = useState<DirectorSummaryFeed | null>(null);
  const [directorSummaryFeedFailed, setDirectorSummaryFeedFailed] = useState(false);
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [kpisError, setKpisError] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const { apiFetch, auth, hydrated } = useAuth();
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
    if (!hydrated || !auth.accessToken) return;
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
          let firstRinging = true;
          for (const n of unread.slice(0, 8)) {
            if (notifiedIdsRef.current.has(n.id)) continue;
            if (!shouldPlayBrowserSoundForUser(n, auth.roleKeys)) continue;
            notifiedIdsRef.current.add(n.id);
            notify(n.subject ?? "CresOS", {
              body: n.body?.slice(0, 120) ?? "",
              tag: `notif-${n.id}`,
              playSound: firstRinging
            });
            firstRinging = false;
          }
        }
      }
    } catch {
      if (canViewOrgAnalyticsSummary) {
        setSummaryError(true);
      }
    }
  }, [apiFetch, canViewOrgAnalyticsSummary, hydrated, auth.accessToken, auth.roleKeys]);

  const loadDirectorDashboard = useCallback(async () => {
    if (!isDirectorOrAdmin) return;
    if (!hydrated || !auth.accessToken) return;
    try {
      const res = await apiFetch("/director/dashboard");
      if (res.ok) {
        const data = (await res.json()) as DirectorDashboard;
        setDirectorDashboard(data);
      }
    } catch {
      // ignore
    }
  }, [isDirectorOrAdmin, apiFetch, hydrated, auth.accessToken]);

  const loadDirectorAiBriefings = useCallback(async () => {
    if (!isDirectorOrAdmin) return;
    if (!hydrated || !auth.accessToken) return;
    try {
      const res = await apiFetch("/reports/ai?limit=14&snippet=true");
      if (res.ok) {
        const data = (await res.json()) as DirectorAiBriefingSnippet[];
        setDirectorAiBriefings(Array.isArray(data) ? data : []);
      } else {
        setDirectorAiBriefings([]);
      }
    } catch {
      setDirectorAiBriefings([]);
    }
  }, [isDirectorOrAdmin, apiFetch, hydrated, auth.accessToken]);

  const loadDirectorSummaryFeed = useCallback(async () => {
    if (!isDirectorOrAdmin) return;
    if (!hydrated || !auth.accessToken) return;
    setDirectorSummaryFeedFailed(false);
    try {
      const res = await apiFetch("/director/summary-actions");
      if (res.ok) {
        const data = (await res.json()) as DirectorSummaryFeed;
        setDirectorSummaryFeed(data);
      } else {
        setDirectorSummaryFeed(null);
        setDirectorSummaryFeedFailed(true);
      }
    } catch {
      setDirectorSummaryFeed(null);
      setDirectorSummaryFeedFailed(true);
    }
  }, [isDirectorOrAdmin, apiFetch, hydrated, auth.accessToken]);

  const loadProjects = useCallback(async () => {
    if (!hydrated || !auth.accessToken) return;
    try {
      const res = await apiFetch("/projects");
      if (!res.ok) return;
      const data = (await res.json()) as any[];
      setProjects(
        data.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          approvalStatus: p.approvalStatus,
          createdBy: p.createdBy ?? null
        }))
      );
    } catch {
      // ignore
    }
  }, [apiFetch, hydrated, auth.accessToken]);

  const canViewKpis = useMemo(
    () => auth.roleKeys.some((r) => ["admin", "director_admin", "finance"].includes(r)),
    [auth.roleKeys]
  );

  const loadKpis = useCallback(async () => {
    if (!canViewKpis) return;
    if (!hydrated || !auth.accessToken) return;
    try {
      const res = await apiFetch("/dashboard/kpis");
      if (res.ok) {
        setKpis((await res.json()) as DashboardKpis);
        setKpisError(false);
      } else {
        setKpisError(true);
      }
    } catch {
      setKpisError(true);
    }
  }, [apiFetch, canViewKpis, hydrated, auth.accessToken]);

  useEffect(() => {
    void loadSummaryAndAttention();
  }, [loadSummaryAndAttention]);

  useEffect(() => {
    void loadDirectorDashboard();
  }, [loadDirectorDashboard]);

  useEffect(() => {
    void loadDirectorAiBriefings();
  }, [loadDirectorAiBriefings]);

  useEffect(() => {
    void loadDirectorSummaryFeed();
  }, [loadDirectorSummaryFeed]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadSummaryAndAttention();
        void loadDirectorDashboard();
        void loadDirectorAiBriefings();
        void loadDirectorSummaryFeed();
        void loadProjects();
        void loadKpis();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => {
      void loadSummaryAndAttention();
      void loadDirectorDashboard();
      void loadDirectorAiBriefings();
      void loadDirectorSummaryFeed();
      void loadProjects();
      void loadKpis();
    });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [
    loadSummaryAndAttention,
    loadDirectorDashboard,
    loadDirectorAiBriefings,
    loadDirectorSummaryFeed,
    loadProjects,
    loadKpis
  ]);

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
  const navCards = useMemo(() => {
    const cards: { href: string; title: string; description: string; badge?: string }[] = [];
    const pendingApprovals = attention?.approvalsPending?.length ?? 0;
    const pendingApprovalsBadge = pendingApprovals > 0 ? String(pendingApprovals) : undefined;

    if (auth.roleKeys.includes("admin")) {
      cards.push(
        {
          href: "/projects",
          title: "Projects",
          description: "View all projects and their status.",
          badge: projects.length > 0 ? String(projects.length) : undefined
        },
        {
          href: "/approvals",
          title: "Approvals",
          description: "Review pending finance requests and decisions.",
          badge: pendingApprovalsBadge
        },
        {
          href: "/finance",
          title: "Finance",
          description: "Read-only governance overview and summaries."
        },
        {
          href: "/analytics",
          title: "Analytics",
          description: "Extended admin analytics dashboard."
        },
        {
          href: "/admin/users",
          title: "Users & org",
          description: "Users, departments, roles (admin tools)."
        },
        {
          href: "/community",
          title: "Community",
          description: "Workspace chat and updates."
        }
      );
      return cards;
    }

    // Non-admin: use their quick links but present as cards.
    for (const l of quickLinks) {
      cards.push({
        href: l.href,
        title: l.label,
        description: "Open section"
      });
    }
    return cards;
  }, [auth.roleKeys, attention?.approvalsPending?.length, projects.length, quickLinks]);

  const actionCards = useMemo(() => {
    const cards: Array<{
      href: string;
      title: string;
      value: number;
      sub: string;
      tone: "sky" | "amber" | "rose" | "emerald";
    }> = [];

    const approvalsCount =
      attention?.approvalsPending?.length ??
      directorDashboard?.approvalQueue.totalPending ??
      0;
    const leadsPendingApprovalCount = attention?.leadsPendingApproval?.length ?? 0;

    if (auth.roleKeys.some((r) => ["admin", "director_admin", "finance"].includes(r))) {
      cards.push({
        href: "/approvals",
        title: "Approvals",
        value: approvalsCount,
        sub: "pending",
        tone: approvalsCount > 0 ? "amber" : "sky"
      });
    }

    if (auth.roleKeys.some((r) => ["sales", "director_admin", "admin", "finance"].includes(r))) {
      cards.push({
        href: "/leads",
        title: "Due today",
        value: dueCount,
        sub: "follow-ups",
        tone: dueCount > 0 ? "amber" : "sky"
      });
    }

    if (auth.roleKeys.includes("sales")) {
      cards.push({
        href: "/reports",
        title: "Messages",
        value: messagesCount,
        sub: "need reply",
        tone: messagesCount > 0 ? "rose" : "sky"
      });
    }

    if (auth.roleKeys.includes("developer")) {
      cards.push({
        href: "/projects",
        title: "Tasks",
        value: tasksOverdue,
        sub: "overdue",
        tone: tasksOverdue > 0 ? "rose" : "sky"
      });
      cards.push({
        href: "/projects",
        title: "Projects",
        value: projectsNeedingReview.length + handoffRequests.length,
        sub: "need attention",
        tone: (projectsNeedingReview.length + handoffRequests.length) > 0 ? "amber" : "sky"
      });
    }

    if (auth.roleKeys.includes("director_admin")) {
      cards.push({
        href: "/leads",
        title: "Leads",
        value: leadsPendingApprovalCount,
        sub: "pending approval",
        tone: leadsPendingApprovalCount > 0 ? "amber" : "sky"
      });
    }

    // Always keep a couple of general entry points.
    cards.push(
      {
        href: "/community",
        title: "Community",
        value: unreadCount,
        sub: "unread notifs",
        tone: unreadCount > 0 ? "sky" : "sky"
      },
      {
        href: "/projects",
        title: "Projects",
        value: projects.length,
        sub: isAdmin ? "all" : "visible",
        tone: "sky"
      }
    );

    // De-dup by href+title, keep first occurrence.
    const seen = new Set<string>();
    return cards.filter((c) => {
      const k = `${c.href}::${c.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [
    attention?.approvalsPending?.length,
    attention?.leadsPendingApproval?.length,
    auth.roleKeys,
    directorDashboard?.approvalQueue.totalPending,
    dueCount,
    messagesCount,
    tasksOverdue,
    projectsNeedingReview.length,
    handoffRequests.length,
    unreadCount,
    projects.length,
    isAdmin
  ]);
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

  const attentionSignalSummary = useMemo(() => {
    const unread = attention?.notifications?.filter((n) => !n.readAt) ?? [];
    let fromNotifs = { message: 0, project: 0, inquiry: 0 };
    for (const n of unread) {
      const k = classifyAttentionSignal(n);
      if (k === "message") fromNotifs.message++;
      else if (k === "project") fromNotifs.project++;
      else if (k === "inquiry") fromNotifs.inquiry++;
    }
    const reportMessages = messagesCount;
    const leadsQueue = attention?.leadsPendingApproval?.length ?? 0;
    const devProjectQueue =
      isDeveloper ? projectsNeedingReview.length + handoffRequests.length : 0;
    return {
      message: fromNotifs.message + reportMessages,
      project: fromNotifs.project + devProjectQueue,
      inquiry: fromNotifs.inquiry + leadsQueue
    };
  }, [
    attention?.notifications,
    attention?.leadsPendingApproval?.length,
    messagesCount,
    isDeveloper,
    projectsNeedingReview.length,
    handoffRequests.length
  ]);

  const messageJumpHref =
    auth.roleKeys.includes("sales") && messagesCount > 0 ? "/developer-reports" : "/community";

  const hasAttentionSignalRow =
    attentionSignalSummary.message + attentionSignalSummary.project + attentionSignalSummary.inquiry > 0;

  return (
    <section className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-4">
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

      {hasAttentionSignalRow && (
        <div className="shell min-w-0 border-brand/35 bg-brand/5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Alerts — sounds only for sales, developer, and director (messages, projects, reports, inquiries). Admins see
            the same signals here without audio. Task reminders never play a sound.
          </p>
          <DashboardCardRow lgCols={3}>
            <DashboardScrollCard>
              <Link
                href={messageJumpHref}
                className={`flex h-full min-h-[112px] flex-col rounded-xl border px-4 py-3 transition-colors ${
                  attentionSignalSummary.message > 0
                    ? "border-sky-600/50 bg-sky-950/40 hover:border-sky-500/70"
                    : "border-slate-800/80 bg-slate-950/30 opacity-60"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">Messages</span>
                <span className="mt-1 text-2xl font-semibold text-sky-100">{attentionSignalSummary.message}</span>
                <span className="mt-0.5 text-[11px] text-slate-500">Chat and report threads</span>
              </Link>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <Link
                href="/projects"
                className={`flex h-full min-h-[112px] flex-col rounded-xl border px-4 py-3 transition-colors ${
                  attentionSignalSummary.project > 0
                    ? "border-amber-600/50 bg-amber-950/30 hover:border-amber-500/70"
                    : "border-slate-800/80 bg-slate-950/30 opacity-60"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">Project updates</span>
                <span className="mt-1 text-2xl font-semibold text-amber-50">{attentionSignalSummary.project}</span>
                <span className="mt-0.5 text-[11px] text-slate-500">Assignments, tasks, and handoffs</span>
              </Link>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <Link
                href="/leads"
                className={`flex h-full min-h-[112px] flex-col rounded-xl border px-4 py-3 transition-colors ${
                  attentionSignalSummary.inquiry > 0
                    ? "border-emerald-600/50 bg-emerald-950/25 hover:border-emerald-500/70"
                    : "border-slate-800/80 bg-slate-950/30 opacity-60"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Inquiries</span>
                <span className="mt-1 text-2xl font-semibold text-emerald-50">{attentionSignalSummary.inquiry}</span>
                <span className="mt-0.5 text-[11px] text-slate-500">Leads and meeting requests</span>
              </Link>
            </DashboardScrollCard>
          </DashboardCardRow>
        </div>
      )}

      <div className="shell min-w-0 flex flex-col gap-2 border-slate-700/60 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Backlog and reminders are managed in{" "}
          <Link href="/schedule" className="font-medium text-sky-400 underline-offset-2 hover:underline">
            Tasks
          </Link>
          .
        </p>
        <Link
          href="/schedule"
          className="shrink-0 self-start rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 sm:self-auto"
        >
          Open Tasks
        </Link>
      </div>

      {actionCards.length > 0 && (
        <div className="shell min-w-0 border-slate-700/70 bg-slate-900/40">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Quick actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadSummaryAndAttention()}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Refresh alerts
              </button>
              <button
                type="button"
                onClick={() => void loadProjects()}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Refresh projects
              </button>
              {canViewKpis && (
                <button
                  type="button"
                  onClick={() => void loadKpis()}
                  className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Refresh KPIs
                </button>
              )}
            </div>
          </div>

          <DashboardCardRow lgCols={4}>
            {actionCards.slice(0, 8).map((c) => {
              const tone =
                c.tone === "rose"
                  ? "text-rose-300"
                  : c.tone === "amber"
                    ? "text-amber-300"
                    : c.tone === "emerald"
                      ? "text-emerald-300"
                      : "text-sky-300";
              return (
                <DashboardScrollCard key={`${c.href}-${c.title}`} width="wide">
                  <Link
                    href={c.href}
                    className="flex h-full min-h-[120px] flex-col rounded-xl border border-slate-700/80 bg-slate-950/20 p-4 hover:border-slate-600 hover:bg-slate-900/40"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.title}</p>
                    <p className={`mt-1 text-2xl font-semibold ${tone}`}>{c.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{c.sub}</p>
                  </Link>
                </DashboardScrollCard>
              );
            })}
          </DashboardCardRow>
        </div>
      )}

      {isDeveloper && hydrated && auth.accessToken && (
        <div className="shell min-w-0 border-slate-700/70 bg-slate-900/40">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Developer overview
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadSummaryAndAttention()}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Refresh
              </button>
              <Link
                href="/projects"
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open projects →
              </Link>
            </div>
          </div>

          <DashboardCardRow lgCols={4}>
            <DashboardScrollCard>
              <Link
                href="/projects"
                className="flex h-full min-h-[120px] flex-col rounded-xl border border-slate-700/80 bg-slate-950/20 p-4 hover:border-slate-600 hover:bg-slate-900/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tasks</p>
                <p className="mt-1 text-2xl font-semibold text-rose-300">{tasksOverdue}</p>
                <p className="mt-1 text-xs text-slate-500">Overdue</p>
                {tasksDueSoon > 0 && (
                  <p className="mt-1 text-xs text-amber-200">{tasksDueSoon} due soon</p>
                )}
              </Link>
            </DashboardScrollCard>

            <DashboardScrollCard>
              <Link
                href="/developer-reports"
                className="flex h-full min-h-[120px] flex-col rounded-xl border border-slate-700/80 bg-slate-950/20 p-4 hover:border-slate-600 hover:bg-slate-900/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Messages</p>
                <p className="mt-1 text-2xl font-semibold text-sky-300">{messagesCount}</p>
                <p className="mt-1 text-xs text-slate-500">Need a reply</p>
              </Link>
            </DashboardScrollCard>

            <DashboardScrollCard>
              <Link
                href="/developer-reports"
                className="flex h-full min-h-[120px] flex-col rounded-xl border border-slate-700/80 bg-slate-950/20 p-4 hover:border-slate-600 hover:bg-slate-900/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reports</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-400">
                  {developerReportStreak}
                </p>
                <p className="mt-1 text-xs text-slate-500">Streak (days)</p>
              </Link>
            </DashboardScrollCard>

            <DashboardScrollCard>
              <Link
                href="/projects"
                className="flex h-full min-h-[120px] flex-col rounded-xl border border-slate-700/80 bg-slate-950/20 p-4 hover:border-slate-600 hover:bg-slate-900/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Projects</p>
                <p className="mt-1 text-2xl font-semibold text-amber-300">
                  {projectsNeedingReview.length + handoffRequests.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">Need attention</p>
              </Link>
            </DashboardScrollCard>
          </DashboardCardRow>

          {(overdueTasks.length > 0 ||
            (attention?.messages?.length ?? 0) > 0 ||
            projectsNeedingReview.length > 0 ||
            handoffRequests.length > 0) && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(overdueTasks.length > 0 || projectsNeedingReview.length > 0 || handoffRequests.length > 0) && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Next actions</p>
                  <ul className="space-y-2 text-sm">
                    {projectsNeedingReview.slice(0, 3).map((p) => (
                      <li key={p.id} className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2">
                        <Link href={`/projects/${p.id}`} className="text-sky-300 hover:underline">
                          Review project: {p.name}
                        </Link>
                      </li>
                    ))}
                    {handoffRequests.slice(0, 2).map((h) => (
                      <li key={h.id} className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-200">
                        Handoff request: <span className="text-slate-100">{h.project.name}</span>
                        <span className="ml-1 text-xs text-slate-400">from {h.fromUser.name ?? h.fromUser.email}</span>
                      </li>
                    ))}
                    {overdueTasks.slice(0, 3).map((t) => (
                      <li key={t.id} className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2">
                        <Link href={`/projects/${t.projectId}`} className="text-rose-200 hover:underline">
                          Overdue: {t.title}
                        </Link>
                        <span className="ml-2 text-xs text-slate-500">
                          Due {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(attention?.messages?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Messages</p>
                  <ul className="space-y-2 text-sm">
                    {(attention?.messages ?? []).slice(0, 5).map((m) => (
                      <li key={m.id} className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2">
                        <Link href={`/reports/${m.reportId}`} className="text-brand hover:underline">
                          {m.content.slice(0, 90)}
                          {m.content.length > 90 ? "…" : ""}
                        </Link>
                        <span className="ml-2 text-xs text-slate-500">
                          {new Date(m.askedAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/developer-reports"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Submit report →
            </Link>
            <Link
              href="/community"
              className="rounded-lg border border-slate-600 bg-slate-950/30 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900/40"
            >
              Community →
            </Link>
          </div>
        </div>
      )}

      {navCards.length > 0 && (
        <div className="shell min-w-0 border-slate-700/70 bg-slate-900/40">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Navigate
            </h3>
            <div className="flex flex-wrap gap-2">
              {canViewKpis && (
                <button
                  type="button"
                  onClick={() => void loadKpis()}
                  className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Refresh KPIs
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadSummaryAndAttention()}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Refresh alerts
              </button>
            </div>
          </div>

          <DashboardCardRow lgCols={3}>
            {navCards.map((c) => (
              <DashboardScrollCard key={c.href} width="wide">
                <Link
                  href={c.href}
                  className="group flex h-full min-h-[100px] flex-col rounded-xl border border-slate-700/80 bg-slate-950/20 p-4 hover:border-slate-600 hover:bg-slate-900/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 group-hover:text-white">
                        {c.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{c.description}</p>
                    </div>
                    {c.badge && (
                      <span className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs tabular-nums text-slate-200">
                        {c.badge}
                      </span>
                    )}
                  </div>
                </Link>
              </DashboardScrollCard>
            ))}
          </DashboardCardRow>
        </div>
      )}

      {canViewKpis && (
        <div className="shell min-w-0 border-slate-700/70 bg-slate-900/40">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Overview (live from database)
            </h3>
            <button
              type="button"
              onClick={() => void loadKpis()}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {kpisError && !kpis && <p className="mb-3 text-sm text-rose-300">Could not load overview KPIs.</p>}
          {kpisError && kpis && (
            <p className="mb-3 text-xs text-amber-200">
              Latest refresh failed — showing the last saved KPI snapshot.
            </p>
          )}

          {kpis && (
            <DashboardCardRow lgCols={3}>
              <DashboardScrollCard width="wide">
                <div className="shell min-h-[180px]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Finance
                  </p>
                  <ul className="space-y-1 break-words text-sm text-slate-200">
                    <li>Revenue this month: <span className="text-emerald-400">{formatMoney(kpis.finance.revenueThisMonth)}</span></li>
                    <li>Outstanding invoices: <span className="text-amber-300">{formatMoney(kpis.finance.outstandingInvoicesAmount)}</span></li>
                    <li>Overdue invoices: <span className="text-rose-300">{kpis.finance.overdueInvoicesCount}</span></li>
                    <li>Expenses this month: <span className="text-amber-300">{formatMoney(kpis.finance.expensesThisMonth)}</span></li>
                  </ul>
                </div>
              </DashboardScrollCard>

              <DashboardScrollCard width="wide">
                <div className="shell min-h-[180px]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Project health
                  </p>
                  <ul className="space-y-1 break-words text-sm text-slate-200">
                    <li>Active projects: <span className="text-sky-300">{kpis.projectHealth.activeProjects}</span></li>
                    <li>Overdue tasks: <span className="text-rose-300">{kpis.projectHealth.overdueTasks}</span></li>
                    <li>Blocked tasks: <span className="text-amber-300">{kpis.projectHealth.blockedTasks}</span></li>
                    <li>Milestones done / pending: <span className="text-slate-100">{kpis.projectHealth.milestonesDone} / {kpis.projectHealth.milestonesPending}</span></li>
                  </ul>
                </div>
              </DashboardScrollCard>

              <DashboardScrollCard width="wide">
                <div className="shell min-h-[180px]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Lead conversion
                  </p>
                  <ul className="space-y-1 break-words text-sm text-slate-200">
                    <li>Leads this month: <span className="text-sky-300">{kpis.leadConversion.leadsThisMonth}</span></li>
                    <li>Deals won: <span className="text-emerald-400">{kpis.leadConversion.dealsWon}</span></li>
                    <li>Deals lost: <span className="text-rose-300">{kpis.leadConversion.dealsLost}</span></li>
                    <li>Win rate: <span className="text-slate-100">{kpis.leadConversion.winRate.toFixed(1)}%</span></li>
                    <li>Avg time to close: <span className="text-slate-100">{kpis.leadConversion.avgTimeToCloseDays.toFixed(1)} days</span></li>
                  </ul>
                </div>
              </DashboardScrollCard>
            </DashboardCardRow>
          )}
        </div>
      )}

      {!canViewOrgAnalyticsSummary && isSalesOrDeveloper && (
        <div className="shell min-w-0 border-sky-800/50 bg-sky-950/25">
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
        <DashboardCardRow lgCols={4}>
          <DashboardScrollCard>
            <div className="shell min-w-0 border-slate-700/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active projects</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{summary.activeProjects}</p>
              <p className="text-xs text-slate-500">Across all teams</p>
            </div>
          </DashboardScrollCard>
          <DashboardScrollCard>
            <div className="shell min-w-0 border-slate-700/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pending approvals</p>
              <p className="mt-1 text-2xl font-semibold text-amber-300">{pendingFinanceApprovals}</p>
              <p className="text-xs text-slate-500">Finance requests</p>
            </div>
          </DashboardScrollCard>
          <DashboardScrollCard>
            <div className="shell min-w-0 border-slate-700/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">At risk</p>
              <p className="mt-1 text-2xl font-semibold text-rose-300">{atRiskProjects}</p>
              <p className="text-xs text-slate-500">Delayed or stalled</p>
            </div>
          </DashboardScrollCard>
          <DashboardScrollCard>
            <div className="shell min-w-0 border-slate-700/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Team members</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{teamMembers}</p>
              <p className="text-xs text-slate-500">Seats in this workspace</p>
            </div>
          </DashboardScrollCard>
        </DashboardCardRow>
      )}

      {isAdmin && directorDashboard && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="shell min-w-0 border-l-4 border-amber-500/60 bg-slate-900/40">
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
          <div className="shell min-w-0 border-l-4 border-emerald-500/60 bg-slate-900/40">
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
          <div className="shell min-w-0 border-l-4 border-sky-500/60 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-sky-200">Work progress tracker</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Aggregated module completion across active projects updates as developers complete work. You can&apos;t edit this directly — it reflects live delivery.
            </p>
            <p className="mt-3 text-2xl font-semibold text-sky-300">{workProgress}%</p>
          </div>
          <div className="shell min-w-0 border-l-4 border-rose-500/50 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-rose-200">Your duties</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Admin-scoped items only: pending approvals, access requests, and governance reviews — not developer or sales task lists.
            </p>
            <Link
              href="/admin/users"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-200/90 hover:text-rose-100"
            >
              Users &amp; org →
            </Link>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="shell min-w-0 border-slate-700/70 bg-slate-900/40">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-slate-300">Projects (all)</h3>
            <Link
              href="/projects"
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Open projects →
            </Link>
          </div>
          <div className="-mx-1 min-w-0 overflow-x-auto rounded-lg border border-slate-700/80 sm:mx-0">
            <table className="min-w-[36rem] text-left text-sm sm:min-w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 font-medium sm:px-3">Project</th>
                  <th className="px-2 py-2 font-medium sm:px-3">Created by</th>
                  <th className="px-2 py-2 font-medium sm:px-3">Status</th>
                  <th className="px-2 py-2 font-medium sm:px-3">Approval</th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 15).map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/80 text-slate-200">
                    <td className="max-w-[10rem] px-2 py-2 font-medium text-slate-100 break-words sm:max-w-none sm:px-3">{p.name}</td>
                    <td className="min-w-0 px-2 py-2 text-slate-300 break-words sm:px-3">
                      {p.createdBy?.name ?? p.createdBy?.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 capitalize text-slate-300 sm:px-3">{p.status}</td>
                    <td className="min-w-0 px-2 py-2 text-xs text-slate-400 break-words sm:px-3">{p.approvalStatus ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right sm:px-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {projects.length > 15 && (
            <p className="mt-2 text-xs text-slate-500">Showing latest 15. Open Projects for full list.</p>
          )}
        </div>
      )}

      {projectsNeedingReview.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-sky-600/50 bg-sky-950/40 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
          <p className="min-w-0 text-sm leading-snug text-sky-200">
            Review and add tasks for {projectsNeedingReview.length} project(s) assigned to you.
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
            {projectsNeedingReview.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="max-w-full truncate rounded-lg bg-sky-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-sky-500 sm:max-w-[14rem]"
                title={p.name}
              >
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
        <div className="flex flex-col gap-3 rounded-xl border border-amber-600/50 bg-amber-950/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="min-w-0 flex-1 text-sm leading-snug text-amber-200">
            It’s been 12+ hours since your last report (and no current-focus update in that window). Submit a report to keep your streak and stay on track.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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

      {auth.roleKeys.includes("developer") && <CurrentFocusPanel apiFetch={apiFetch} />}

      {/* Stats row (hide for developers — replaced by simple cards above) */}
      {!isDeveloper && (
        <DashboardCardRow lgCols={5} layout="scroll">
          <DashboardScrollCard>
            <StatCard label="Notifications" value={unreadCount} />
          </DashboardScrollCard>
          <DashboardScrollCard>
            <StatCard label="Messages" value={messagesCount} sub="to respond" />
          </DashboardScrollCard>
          <DashboardScrollCard>
            <StatCard label="Due today" value={dueCount} />
          </DashboardScrollCard>
          <DashboardScrollCard>
            <StatCard label="Work progress" value={`${workProgress}%`} />
          </DashboardScrollCard>
          <DashboardScrollCard>
            <StatCard label="Report streak" value={reportStreak} sub="days" />
          </DashboardScrollCard>
        </DashboardCardRow>
      )}

      {!isDeveloper && hasAttention && attention && (
        <div className="shell min-w-0 border-brand/30 bg-brand/5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            What needs your attention
          </h3>
          <DashboardCardRow lgCols={3} layout="scroll">
            {unreadCount > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {messagesCount > 0 && attention.messages && attention.messages.length > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {dueCount > 0 && attention.dueToday && attention.dueToday.length > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {(attention.upcomingMeetings?.length ?? 0) > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {(attention.upcomingCalls?.length ?? 0) > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {(attention.leadsPendingApproval?.length ?? 0) > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {(attention.approvalsPending?.length ?? 0) > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {isDeveloper && overdueTasks.length > 0 && (
              <DashboardScrollCard width="wide">
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
              </DashboardScrollCard>
            )}
            {isDeveloper && latestDeveloperReportNeedsAttention && (
              <DashboardScrollCard width="wide">
              <div>
                <p className="mb-1 text-xs text-slate-400">From your last report — needs attention</p>
                <p className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-200">
                  {latestDeveloperReportNeedsAttention.slice(0, 200)}
                  {latestDeveloperReportNeedsAttention.length > 200 ? "…" : ""}
                </p>
              </div>
              </DashboardScrollCard>
            )}
          </DashboardCardRow>
        </div>
      )}

      {!isDeveloper && (workProgress > 0 || developerReportStreak > 0 || tasksOverdue > 0 || tasksDueSoon > 0) && (
        <div className="shell min-w-0 border-sky-800/40 bg-sky-950/20">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Performance</h3>
          <DashboardCardRow lgCols={4}>
            <DashboardScrollCard>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Work progress</p>
              <p className="mt-1 text-2xl font-semibold text-sky-400">{workProgress}%</p>
              <p className="text-xs text-slate-500">Tasks done vs assigned</p>
            </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Report streak</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">{developerReportStreak} day{developerReportStreak !== 1 ? "s" : ""}</p>
              <p className="text-xs text-slate-500">Consecutive days with reports</p>
            </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Tasks overdue</p>
              <p className="mt-1 text-2xl font-semibold text-rose-400">{tasksOverdue}</p>
              <p className="text-xs text-slate-500">Past due date</p>
            </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Tasks due soon</p>
              <p className="mt-1 text-2xl font-semibold text-amber-400">{tasksDueSoon}</p>
              <p className="text-xs text-slate-500">Next 7 days</p>
            </div>
            </DashboardScrollCard>
          </DashboardCardRow>
        </div>
      )}

      {isDirectorOrAdmin && directorDashboard && (
        <div className="shell min-w-0 border-sky-800/50 bg-sky-950/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Director overview — aligned view</h3>
              <p className="mb-4 text-xs text-slate-400">
                {isDirectorOnly
                  ? "Sales, delivery, and operational signals in one place. Invoice and billing detail live under Finance for Admin."
                  : "Sales, delivery, finance, and approvals in one place. All amounts in Kenyan Shillings (KES)."}
              </p>
              <DashboardCardRow layout="scroll" lgCols={isDirectorOnly ? 3 : 4}>
                {!isDirectorOnly && (
                  <DashboardScrollCard width="wide">
                    <div className="shell flex min-h-[168px] min-w-0 flex-col">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Financial health</p>
                      <p className="mt-2 break-words text-sm text-slate-200">
                        Revenue (period): {formatMoney(directorDashboard.financialHealth.revenueThisPeriod)}
                      </p>
                      <p className="break-words text-sm text-slate-200">
                        Outstanding: {formatMoney(directorDashboard.financialHealth.outstandingInvoices)}
                      </p>
                      <p className="break-words text-sm text-slate-200">Net flow: {formatMoney(directorDashboard.financialHealth.netFlow)}</p>
                      <p className="mt-auto text-xs text-slate-400">
                        Pending approvals: {directorDashboard.financialHealth.pendingExpenseApprovals}
                      </p>
                    </div>
                  </DashboardScrollCard>
                )}
                <DashboardScrollCard width="wide">
                  <div className="shell flex min-h-[168px] min-w-0 flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sales health</p>
                    <p className="mt-2 break-words text-sm text-slate-200">
                      Pipeline: {formatMoney(directorDashboard.salesHealth.totalPipelineValue)}
                    </p>
                    <p className="text-sm text-slate-200">Win rate: {directorDashboard.salesHealth.winRate.toFixed(0)}%</p>
                    <p className="text-sm text-slate-200">Stalled deals: {directorDashboard.salesHealth.stalledDealsCount}</p>
                  </div>
                </DashboardScrollCard>
                <DashboardScrollCard width="wide">
                  <div className="shell flex min-h-[168px] min-w-0 flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Operational health</p>
                    <p className="mt-2 text-sm text-slate-200">Active projects: {directorDashboard.operationalHealth.activeProjects}</p>
                    <p className="text-sm text-slate-200">At risk: {directorDashboard.operationalHealth.projectsAtRisk}</p>
                    <p className="text-sm text-slate-200">
                      Blocked tasks (threshold): {directorDashboard.operationalHealth.blockedTasksAboveThreshold}
                    </p>
                  </div>
                </DashboardScrollCard>
                <DashboardScrollCard width="wide">
                  <div className="shell flex min-h-[168px] min-w-0 flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approval queue</p>
                    <p className="mt-2 text-xl font-semibold text-amber-400">{directorDashboard.approvalQueue.totalPending} pending</p>
                    <Link href="/approvals" className="mt-auto inline-block text-sm text-sky-400 hover:underline">
                      View approvals →
                    </Link>
                  </div>
                </DashboardScrollCard>
              </DashboardCardRow>
              <div className="mt-6 min-w-0">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Team — current project focus</h4>
                <div className="-mx-1 min-w-0 overflow-x-auto rounded-lg border border-slate-700/80 sm:mx-0">
                  <table className="min-w-[44rem] text-left text-sm sm:min-w-full">
                    <caption className="sr-only">Team current focus</caption>
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-2 py-2 font-medium sm:px-3">Person</th>
                        <th className="px-2 py-2 font-medium sm:px-3">Roles</th>
                        <th className="px-2 py-2 font-medium sm:px-3">Project</th>
                        <th className="px-2 py-2 font-medium sm:px-3">Note</th>
                        <th className="px-2 py-2 font-medium sm:px-3">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(directorDashboard.teamCurrentFocus ?? []).map((row) => (
                        <tr key={row.userId} className="border-b border-slate-800/80 text-slate-200">
                          <td className="min-w-0 px-2 py-2 sm:px-3">
                            <span className="font-medium break-words text-slate-100">{row.name?.trim() || row.email}</span>
                          </td>
                          <td className="min-w-0 px-2 py-2 text-xs break-words text-slate-400 sm:px-3">
                            {row.roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") || "—"}
                          </td>
                          <td className="min-w-0 px-2 py-2 sm:px-3">
                            {row.project ? (
                              <Link
                                href={`/projects/${row.project.id}`}
                                className="break-words text-sky-400 hover:underline"
                              >
                                {row.project.name}
                              </Link>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="min-w-0 max-w-[12rem] px-2 py-2 break-words text-slate-400 sm:max-w-[14rem] sm:px-3">
                            {row.note?.trim() || "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500 sm:px-3">
                            {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="flex min-h-0 w-full shrink-0 flex-col gap-6 border-t border-slate-700/80 pt-6 lg:max-w-[26rem] lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</h4>
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Org-day action log (admin activity + audit events, excluding routine logins). Refreshes as things
                  happen. The written AI digest for this calendar day is generated at{" "}
                  {directorSummaryFeed?.aiReportHourLocal ?? 19}:00{" "}
                  {directorSummaryFeed?.tz?.replace(/_/g, " ") ?? "org timezone"} — see Daily AI summaries below.
                </p>
                {directorSummaryFeed === null && !directorSummaryFeedFailed ? (
                  <p className="text-sm text-slate-400">Loading Summary…</p>
                ) : directorSummaryFeedFailed || !directorSummaryFeed ? (
                  <p className="text-sm text-rose-300/90">Could not load Summary. Try refreshing.</p>
                ) : (
                  <>
                    <p className="mb-2 text-[0.65rem] text-slate-500">
                      <span className="text-slate-400">Day:</span> {formatBriefingDateLabel(directorSummaryFeed.dateKey)}
                      {directorSummaryFeed.aiDailyBrief ? (
                        <span className="ml-2 text-emerald-400/90">· Today&apos;s AI digest: ready</span>
                      ) : (
                        <span className="ml-2 text-amber-400/90">
                          · AI digest for this day: pending until the scheduled run
                        </span>
                      )}
                    </p>
                    {directorSummaryFeed.actions.length === 0 ? (
                      <p className="text-sm text-slate-400">No logged actions for this org day yet.</p>
                    ) : (
                      <div className="max-h-[min(20rem,42vh)] min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-slate-700/80">
                        <table className="w-full min-w-[16rem] text-left text-[0.7rem]">
                          <caption className="sr-only">Platform actions for director summary</caption>
                          <thead>
                            <tr className="sticky top-0 z-[1] border-b border-slate-700 bg-slate-900/95 uppercase tracking-wide text-slate-400">
                              <th className="px-2 py-1.5 font-medium whitespace-nowrap">Time</th>
                              <th className="px-2 py-1.5 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {directorSummaryFeed.actions.map((a) => (
                              <tr key={a.id} className="border-b border-slate-800/80 align-top text-slate-200">
                                <td className="whitespace-nowrap px-2 py-1.5 text-slate-400">
                                  {formatSummaryActionTime(a.createdAt, directorSummaryFeed.tz)}
                                </td>
                                <td className="min-w-0 px-2 py-1.5">
                                  <span className="text-slate-500">[{a.source}]</span>{" "}
                                  <span className="text-slate-400">{a.type}</span>
                                  <p className="mt-0.5 break-words text-slate-200">{a.summary}</p>
                                  {a.actorLabel ? (
                                    <p className="mt-0.5 text-slate-500">Actor: {a.actorLabel}</p>
                                  ) : null}
                                  {a.detail ? (
                                    <p className="mt-0.5 line-clamp-2 break-words text-slate-500">{a.detail}</p>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="min-h-0 min-w-0 flex flex-col border-t border-slate-700/80 pt-6">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Daily AI summaries</h4>
                <Link href="/reports/ai" className="shrink-0 text-xs text-sky-400 hover:underline">
                  All reports →
                </Link>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                One row per day (Groq when configured; otherwise counts). Refreshes after the scheduled run.
              </p>
              {directorAiBriefings === null ? (
                <p className="text-sm text-slate-400">Loading summaries…</p>
              ) : directorAiBriefings.length === 0 ? (
                <p className="text-sm text-slate-400">No summaries yet. They appear after the first daily job.</p>
              ) : (
                <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-slate-700/80 lg:max-h-[min(32rem,55vh)]">
                  <table className="w-full min-w-[18rem] text-left text-xs">
                    <caption className="sr-only">Daily AI director summaries by date</caption>
                    <thead>
                      <tr className="sticky top-0 z-[1] border-b border-slate-700 bg-slate-900/95 text-[0.65rem] uppercase tracking-wide text-slate-400">
                        <th className="px-2 py-2 font-medium whitespace-nowrap">Date</th>
                        <th className="px-2 py-2 font-medium">Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directorAiBriefings.map((r) => (
                        <tr key={r.id} className="border-b border-slate-800/80 align-top text-slate-200">
                          <td className="whitespace-nowrap px-2 py-2 text-slate-300">{formatBriefingDateLabel(r.dateKey)}</td>
                          <td className="min-w-0 px-2 py-2">
                            <p className="font-medium text-slate-100">{r.subject}</p>
                            <p className="mt-1 line-clamp-4 break-words text-slate-400">{r.bodyPreview}</p>
                            <Link
                              href="/reports/ai"
                              className="mt-1 inline-block text-sky-400 hover:underline"
                            >
                              Open full report →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {hasMetrics && (
        <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-1.5 sm:gap-3">
          {(
            [
              { key: "leads", label: "Leads this week", value: summary!.leadsThisWeek, tone: "green" as const },
              { key: "deals", label: "Deals won", value: summary!.dealsWon, tone: "green" as const },
              { key: "projects", label: "Active projects", value: summary!.activeProjects, tone: "blue" as const },
              { key: "revenue", label: "Revenue received", value: formatMoney(summary!.revenueReceived), tone: "green" as const },
              ...(!isDirectorOnly
                ? [
                    {
                      key: "inv",
                      label: "Invoices outstanding",
                      value: formatMoney(summary!.invoiceOutstanding),
                      tone: "amber" as const
                    }
                  ]
                : [])
            ] as const
          ).map((m) => (
            <div
              key={m.key}
              className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border border-slate-800 bg-slate-900/70 px-1 py-1.5 text-center shadow-sm sm:px-3 sm:py-3 sm:text-left"
            >
              <Metric label={m.label} value={m.value} tone={m.tone} />
            </div>
          ))}
        </div>
      )}

      {auth.roleKeys.includes("sales") && (
        <div className="shell min-w-0 border-amber-800/40 bg-amber-950/20">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Report submission streak</h3>
          <p className="text-2xl font-bold text-amber-400">{reportStreak} day{reportStreak !== 1 ? "s" : ""}</p>
          <p className="mt-1 text-xs text-slate-400">
            Submit a report today to keep your streak. Consecutive days with at least one submitted report.
          </p>
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="shell min-w-0">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Your duties</p>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="min-w-0 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-center text-sm font-medium text-brand hover:bg-brand/20 sm:px-4"
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
      <div className="shell min-w-0 border-slate-700/60">
        <p className="text-sm text-slate-400">Loading current focus…</p>
      </div>
    );
  }

  return (
    <div className="shell min-w-0 border-emerald-800/40 bg-emerald-950/15">
      <h3 className="mb-1 text-sm font-semibold text-slate-200">Today&apos;s project focus</h3>
      <p className="mb-3 text-xs text-slate-400">
        Choose the project you are mainly working on so admin and director see it on the strategic overview. Developers: an approved project you are assigned to. Sales: a project you created.
      </p>
      {error && <p className="mb-2 text-sm text-rose-400">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">— No project selected —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-[2] flex-col gap-1 text-xs text-slate-400">
          Short note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. finishing API integration"
            className="w-full min-w-0 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-full shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
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
    <div className="shell min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold text-slate-100">
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
    <div className="min-h-0 min-w-0">
      <p className="line-clamp-2 text-[7px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px] sm:leading-snug sm:text-slate-400 md:text-xs">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[10px] font-semibold leading-tight sm:mt-1 sm:text-base sm:leading-normal md:text-xl ${color}`}
      >
        {value}
      </p>
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
    <li className="flex flex-col gap-2 rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <span className="min-w-0 text-slate-200">
        <strong>{fromName}</strong> requested to hand off <strong>{projectName}</strong> to you.
      </span>
      <div className="flex shrink-0 flex-wrap gap-2">
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

