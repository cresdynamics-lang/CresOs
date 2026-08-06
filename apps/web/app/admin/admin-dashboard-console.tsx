"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { adminAccents, adminNeu, type AdminAccent } from "../../components/admin/admin-theme";
import { formatMoney } from "../format-money";
import { PieChart, ProjectHealthComboChart, VerticalBarChart } from "../../components/analytics/chart-widgets";
import type { ProjectHealthBarItem } from "../../components/analytics/chart-widgets";
import { WorkspaceLiveAnalytics } from "../../components/analytics/workspace-live-analytics";
import { AdminStatInline, AdminStatRow } from "../../components/admin/admin-ui";

type Notification = {
  id: string;
  type?: string;
  subject?: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  approvalStatus?: string | null;
  createdBy?: { name: string | null; email: string } | null;
};

type FocusRow = {
  userId: string;
  name: string | null;
  email: string;
  roleKeys: string[];
  project: { id: string; name: string; status: string } | null;
  note: string | null;
  updatedAt: string | null;
};

type ActivityItem = {
  id: string;
  type: string;
  summary: string;
  actorLabel?: string | null;
  createdAt: string;
};

type DirectorDashboard = {
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
  };
  operationalHealth: {
    activeProjects: number;
    projectsAtRisk: number;
    blockedTasksAboveThreshold: number;
  };
  approvalQueue: { totalPending: number };
  teamCurrentFocus?: FocusRow[];
};

type Kpis = {
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
  };
};

type CardKey = "ai" | "notifications" | "projects" | "focus" | "activity" | "briefings" | null;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst",
  hr: "HR",
  project_manager: "PM"
};

/** Deep solid bar fills — no soft / pastel shades */
const CHART_COLORS = ["bg-[#005CAB]", "bg-[#0B6A0B]", "bg-[#C19C00]", "bg-[#C50F1F]", "bg-[#5C2D91]"];

function SectionCard({
  title,
  subtitle,
  count,
  icon,
  onClick,
  accent = "blue"
}: {
  title: string;
  subtitle: string;
  count?: string | number;
  icon: ReactNode;
  onClick: () => void;
  accent?: AdminAccent;
}) {
  const a = adminAccents[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${adminNeu.cardInteractive} group relative flex min-h-[6.25rem] flex-col justify-between overflow-hidden p-3`}
      style={{ borderTopWidth: 3, borderTopColor: a.solid }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: a.solid }}
        >
          {icon}
        </span>
        {count !== undefined ? (
          <span
            className="rounded-md px-1.5 py-0.5 font-label text-[10px] font-bold tabular-nums text-white"
            style={{ backgroundColor: a.solid }}
          >
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-2 min-w-0">
        <p className="truncate font-body text-[13px] font-semibold leading-tight text-[#242424]">{title}</p>
        <p className="mt-0.5 line-clamp-2 font-body text-[11px] font-medium leading-snug text-[#605E5C]">
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function DetailModal({
  title,
  onClose,
  children,
  footer
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1A1D26]/40 p-3 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-[1] flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[#E1DFDD] bg-white shadow-[0_6.4px_14.4px_rgba(0,0,0,0.13),0_1.2px_3.6px_rgba(0,0,0,0.1)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E1DFDD] px-4 py-3">
          <h2 className="font-body text-[15px] font-semibold text-[#242424]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#605E5C] hover:bg-[#F5F5F5]"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 text-[12px] leading-relaxed text-[#1A1D26]">
          {children}
        </div>
        {footer ? <div className="border-t border-[#E5E9EF] px-3.5 py-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
  accent = "blue"
}: {
  title: string;
  children: ReactNode;
  accent?: AdminAccent;
}) {
  const a = adminAccents[accent];
  return (
    <div className={adminNeu.chartPanel}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: a.solid }} aria-hidden />
      <h3 className="font-body text-[13px] font-semibold tracking-tight" style={{ color: a.solid }}>
        {title}
      </h3>
      <div className="mt-4 flex w-full flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function IconSpark() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
      />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
      />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 12h6m-6 4h6M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M9 9h2M9 13h2M9 17h2M14 21h6V10h-4"
      />
    </svg>
  );
}

export function AdminDashboardConsole() {
  const { auth, apiFetch } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState<CardKey>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [teamFocus, setTeamFocus] = useState<FocusRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityDate, setActivityDate] = useState<string | null>(null);
  const [dash, setDash] = useState<DirectorDashboard | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [kpisError, setKpisError] = useState(false);
  const [briefings, setBriefings] = useState<{ id: string; dateKey: string; subject: string }[]>([]);
  const [approvalsPending, setApprovalsPending] = useState(0);
  const [leadsPending, setLeadsPending] = useState(0);
  const [projectHealthSeries, setProjectHealthSeries] = useState<ProjectHealthBarItem[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, cRes, pRes, dRes, aRes, kRes, bRes, attRes, liveRes] = await Promise.all([
        apiFetch("/notifications/me"),
        apiFetch("/notifications/me/unseen-count"),
        apiFetch("/projects"),
        apiFetch("/director/dashboard"),
        apiFetch("/director/summary-actions"),
        apiFetch("/dashboard/kpis"),
        apiFetch("/reports/ai?limit=8&snippet=true"),
        apiFetch("/dashboard/attention"),
        apiFetch("/analytics/live-insights")
      ]);

      if (nRes.ok) setNotifications((await nRes.json()) as Notification[]);
      if (cRes.ok) {
        const j = (await cRes.json()) as { count?: number };
        setUnseenCount(j.count ?? 0);
      }
      if (pRes.ok) {
        const list = (await pRes.json()) as ProjectRow[];
        setProjects(Array.isArray(list) ? list : []);
      }
      if (dRes.ok) {
        const data = (await dRes.json()) as DirectorDashboard;
        setDash(data);
        setTeamFocus(data.teamCurrentFocus ?? []);
        setApprovalsPending(data.approvalQueue?.totalPending ?? 0);
      } else {
        setDash(null);
      }
      if (aRes.ok) {
        const feed = (await aRes.json()) as {
          dateKey?: string;
          actions?: ActivityItem[];
        };
        setActivityDate(feed.dateKey ?? null);
        setActivity(Array.isArray(feed.actions) ? feed.actions : []);
      }
      if (kRes.ok) {
        setKpis((await kRes.json()) as Kpis);
        setKpisError(false);
      } else {
        setKpis(null);
        setKpisError(true);
      }
      if (bRes.ok) {
        const list = (await bRes.json()) as { id: string; dateKey: string; subject: string }[];
        setBriefings(Array.isArray(list) ? list : []);
      }
      if (attRes.ok) {
        const att = (await attRes.json()) as {
          leadsPendingApproval?: unknown[];
          approvalsPending?: unknown[];
        };
        if (Array.isArray(att.leadsPendingApproval)) setLeadsPending(att.leadsPendingApproval.length);
        if (Array.isArray(att.approvalsPending)) setApprovalsPending(att.approvalsPending.length);
      }
      if (liveRes.ok) {
        const live = (await liveRes.json()) as {
          projects?: { healthSeries?: ProjectHealthBarItem[] };
        };
        setProjectHealthSeries(
          Array.isArray(live.projects?.healthSeries) ? live.projects!.healthSeries! : []
        );
      } else {
        setProjectHealthSeries([]);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = useMemo(() => notifications.filter((n) => !n.readAt), [notifications]);

  const activeProjects = useMemo(() => {
    const active = projects.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s === "active" || s === "in_progress" || s === "planned" || !s.includes("cancel");
    });
    return active.length ? active : projects;
  }, [projects]);

  const projectCount = dash?.operationalHealth.activeProjects || activeProjects.length;
  const canViewFinance = dash?.canSeeFinance !== false && Boolean(dash?.financialHealth);

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
    if (!dash) return [];
    return [
      {
        label: "Pipeline",
        value: Math.round(dash.salesHealth.totalPipelineValue / 1000),
        color: "bg-[#2067B0]"
      },
      {
        label: "Stalled",
        value: dash.salesHealth.stalledDealsCount,
        color: "bg-[#F8B042]"
      },
      {
        label: "At risk",
        value: dash.operationalHealth.projectsAtRisk,
        color: "bg-[#E85D5D]"
      }
    ].filter((b) => b.value > 0);
  }, [dash]);

  const askAi = async () => {
    const q = aiPrompt.trim();
    if (!q) return;
    setAiLoading(true);
    setAiReply(null);
    try {
      const res = await apiFetch("/admin/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      setAiReply(res.ok ? data.reply ?? "No reply." : data.error ?? "Request failed.");
    } catch {
      setAiReply("Could not reach AI.");
    } finally {
      setAiLoading(false);
    }
  };

  const firstName = (auth.userName || auth.userEmail || "Admin").split(/\s+/)[0];

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 bg-white">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E1DFDD] pb-4">
        <div>
          <p className="font-label text-[11px] font-semibold tracking-wide text-[#8A8886]">Admin</p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-[#242424]">
            Hello, {firstName}
          </h1>
          <p className="mt-1 max-w-xl font-body text-[13px] font-medium leading-relaxed text-[#605E5C]">
            Overview of approvals, pipeline, and delivery. Open a card for detail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`${adminNeu.btnGhost} !px-3 !py-1.5 !text-[12px] disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {/* 1) Stats */}
      <section aria-label="Key stats">
        <p className="mb-3 font-body text-[13px] font-semibold text-[#242424]">Stats</p>
        <div className={adminNeu.kpiStrip}>
          <AdminStatRow>
            <Link href="/admin/management?tab=approvals" className="min-w-0 block transition-opacity hover:opacity-95">
              <AdminStatInline
                label="Approvals"
                value={approvalsPending}
                hint="Pending decisions"
                tone={approvalsPending > 0 ? "amber" : "sky"}
              />
            </Link>
            <Link href="/admin/management?tab=leads" className="min-w-0 block transition-opacity hover:opacity-95">
              <AdminStatInline
                label="Leads queue"
                value={leadsPending}
                hint="Need approval"
                tone={leadsPending > 0 ? "amber" : "sky"}
              />
            </Link>
            <button type="button" className="min-w-0 text-left" onClick={() => setOpen("notifications")}>
              <AdminStatInline
                label="Notifications"
                value={unseenCount}
                hint="Unread · open card"
                tone={unseenCount > 0 ? "rose" : "sky"}
              />
            </button>
            <button type="button" className="min-w-0 text-left" onClick={() => setOpen("projects")}>
              <AdminStatInline
                label="Active projects"
                value={projectCount}
                hint={`${dash?.operationalHealth.projectsAtRisk ?? 0} at risk`}
                tone="violet"
              />
            </button>
            <AdminStatInline
              label="Pipeline"
              value={dash ? formatMoney(dash.salesHealth.totalPipelineValue) : "—"}
              hint={dash ? `Win ${dash.salesHealth.winRate.toFixed(0)}%` : "Loading…"}
              tone="sky"
            />
          </AdminStatRow>
        </div>

        {canViewFinance && dash?.financialHealth ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatInline
              label="Revenue"
              value={formatMoney(dash.financialHealth.revenueThisPeriod)}
              tone="emerald"
            />
            <AdminStatInline
              label="Outstanding"
              value={formatMoney(dash.financialHealth.outstandingInvoices)}
              tone="amber"
            />
            <AdminStatInline label="Net flow" value={formatMoney(dash.financialHealth.netFlow)} tone="sky" />
            <AdminStatInline
              label="Expense approvals"
              value={dash.financialHealth.pendingExpenseApprovals}
              tone="rose"
            />
          </div>
        ) : null}
      </section>

      {/* Shortcuts */}
      <section aria-label="Open details" className="scroll-mt-4">
        <p className="mb-1 font-body text-[13px] font-semibold text-[#242424]">Open details</p>
        <p className="mb-3 font-body text-[12px] font-medium text-[#8A8886]">
          Click a card for full detail, or open Organisation for users, departments, roles, and clients.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-7">
          <SectionCard
            title="Organisation"
            subtitle="Users · depts · roles · clients"
            icon={<IconBuilding />}
            accent="blue"
            onClick={() => router.push("/admin/organisation")}
          />
          <SectionCard
            title="AI Command"
            subtitle="Org intelligence ask"
            icon={<IconSpark />}
            accent="purple"
            onClick={() => setOpen("ai")}
          />
          <SectionCard
            title="Notifications"
            subtitle={unseenCount > 0 ? `${unseenCount} unread` : "All caught up"}
            count={unseenCount}
            icon={<IconBell />}
            accent="yellow"
            onClick={() => setOpen("notifications")}
          />
          <SectionCard
            title="Active projects"
            subtitle="Delivery snapshot"
            count={projectCount}
            icon={<IconFolder />}
            accent="green"
            onClick={() => setOpen("projects")}
          />
          <SectionCard
            title="Team focus"
            subtitle={teamFocus.length ? `${teamFocus.length} reporting` : "No focus set"}
            count={teamFocus.length}
            icon={<IconUsers />}
            accent="blue"
            onClick={() => setOpen("focus")}
          />
          <SectionCard
            title="Platform activity"
            subtitle={activityDate ? `Day ${activityDate}` : "Today’s events"}
            count={activity.length}
            icon={<IconPulse />}
            accent="red"
            onClick={() => setOpen("activity")}
          />
          <SectionCard
            title="AI briefings"
            subtitle={briefings.length ? `${briefings.length} recent` : "Daily digests"}
            count={briefings.length}
            icon={<IconDoc />}
            accent="yellow"
            onClick={() => setOpen("briefings")}
          />
        </div>
      </section>

      {/* Graphs */}
      <section aria-label="Graphs">
        <p className="mb-3 font-body text-[13px] font-semibold text-[#242424]">Graphs</p>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ChartPanel title="Project health · progress, payments & overdue" accent="blue">
              <ProjectHealthComboChart
                items={projectHealthSeries}
                emptyLabel={
                  loading
                    ? "Loading…"
                    : "No active projects to chart yet"
                }
              />
            </ChartPanel>
          </div>
          <ChartPanel title="Lead outcomes (month)" accent="green">
            <PieChart items={leadMix} size={200} emptyLabel="No lead/deal activity this month" />
          </ChartPanel>
          <ChartPanel title="Milestones" accent="yellow">
            <PieChart items={milestoneMix} size={200} emptyLabel="No milestones tracked yet" />
          </ChartPanel>
          <ChartPanel title="Pipeline signals" accent="red">
            {pipelineBars.length > 0 ? (
              <VerticalBarChart
                items={pipelineBars.map((b, i) => ({
                  ...b,
                  color: CHART_COLORS[i % CHART_COLORS.length]
                }))}
              />
            ) : (
              <p className="text-sm text-[#8A8886]">{loading ? "Loading…" : "No pipeline signals yet"}</p>
            )}
          </ChartPanel>
        </div>
      </section>

      <section aria-label="Live analytics">
        <p className="mb-3 font-body text-[13px] font-semibold text-[#242424]">Analytics &amp; predictions</p>
        <WorkspaceLiveAnalytics variant="admin" compact className="mt-0 border-0 bg-transparent pb-0" />
      </section>

      {open === "ai" && (
        <DetailModal
          title="AI Command"
          onClose={() => setOpen(null)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/admin/ai-command"
                className="font-label text-[11px] font-bold text-[#0F6CBD] hover:underline"
                onClick={() => setOpen(null)}
              >
                Open full console →
              </Link>
              <button type="button" onClick={() => setOpen(null)} className={`${adminNeu.btnGhost} !text-[11px] !py-1.5`}>
                Close
              </button>
            </div>
          }
        >
          <p className="mb-2 text-[11px] font-medium text-[#5B6472]">
            Quick intelligence ask. Use the full console for execute mode.
          </p>
          <div className="flex gap-1.5">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void askAi()}
              placeholder="e.g. Summarise active project risks"
              className={`${adminNeu.input} !py-1.5 !text-[12px]`}
            />
            <button
              type="button"
              disabled={aiLoading || !aiPrompt.trim()}
              onClick={() => void askAi()}
              className={`${adminNeu.btnPrimary} !px-3 !py-1.5 !text-[11px] disabled:opacity-50`}
            >
              {aiLoading ? "…" : "Ask"}
            </button>
          </div>
          {aiReply ? (
            <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#E1DFDD] bg-white p-2.5 text-[11px] leading-relaxed text-[#1A1D26]">
              {aiReply}
            </div>
          ) : null}
        </DetailModal>
      )}

      {open === "notifications" && (
        <DetailModal
          title="Notifications"
          onClose={() => setOpen(null)}
          footer={
            <Link
              href="/settings/notifications"
              className="font-label text-[11px] font-bold text-[#0F6CBD] hover:underline"
              onClick={() => setOpen(null)}
            >
              Notification preferences →
            </Link>
          }
        >
          {unread.length === 0 && notifications.length === 0 ? (
            <p className="text-[11px] text-[#8B93A1]">No notifications yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {(unread.length ? unread : notifications).slice(0, 30).map((n) => (
                <li key={n.id} className="rounded-lg border border-[#E1DFDD] bg-white px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-[#1A1D26]">
                    {(n.subject || n.body).slice(0, 120)}
                    {(n.subject || n.body).length > 120 ? "…" : ""}
                  </p>
                  {n.subject ? (
                    <p className="mt-0.5 text-[10px] text-[#5B6472]">{n.body.slice(0, 160)}</p>
                  ) : null}
                  <p className="mt-1 text-[9px] font-medium text-[#8B93A1]">
                    {new Date(n.createdAt).toLocaleString()}
                    {n.readAt ? "" : " · Unread"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DetailModal>
      )}

      {open === "projects" && (
        <DetailModal
          title="Active projects"
          onClose={() => setOpen(null)}
          footer={
            <Link
              href="/projects"
              className="font-label text-[11px] font-bold text-[#0F6CBD] hover:underline"
              onClick={() => setOpen(null)}
            >
              All projects →
            </Link>
          }
        >
          {activeProjects.length === 0 ? (
            <p className="text-[11px] text-[#8B93A1]">No projects found.</p>
          ) : (
            <ul className="space-y-1.5">
              {activeProjects.slice(0, 20).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block rounded-lg border border-[#E1DFDD] bg-white px-2.5 py-2 hover:border-[#0F6CBD]/40"
                    onClick={() => setOpen(null)}
                  >
                    <p className="text-[11px] font-semibold text-[#1A1D26]">{p.name}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-[#5B6472]">
                      {p.status}
                      {p.approvalStatus ? ` · ${p.approvalStatus}` : ""}
                      {p.createdBy ? ` · ${p.createdBy.name?.trim() || p.createdBy.email}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DetailModal>
      )}

      {open === "focus" && (
        <DetailModal
          title="Team focus"
          onClose={() => setOpen(null)}
          footer={
            <button type="button" onClick={() => setOpen(null)} className={`${adminNeu.btnGhost} !text-[11px] !py-1.5`}>
              Close
            </button>
          }
        >
          {teamFocus.length === 0 ? (
            <p className="text-[11px] text-[#8B93A1]">
              No team focus reported yet. People set daily focus from their workspaces.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {teamFocus.map((row) => (
                <li key={row.userId} className="rounded-lg border border-[#E1DFDD] bg-white px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-[#1A1D26]">{row.name?.trim() || row.email}</p>
                  <p className="mt-0.5 text-[10px] text-[#5B6472]">
                    {row.roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") || "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[#1A1D26]">
                    {row.project ? (
                      <Link
                        href={`/projects/${row.project.id}`}
                        className="font-semibold text-[#0F6CBD] hover:underline"
                        onClick={() => setOpen(null)}
                      >
                        {row.project.name}
                      </Link>
                    ) : (
                      <span className="text-[#8B93A1]">No project set</span>
                    )}
                  </p>
                  {row.note?.trim() ? (
                    <p className="mt-0.5 text-[10px] text-[#5B6472]">{row.note.trim()}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DetailModal>
      )}

      {open === "activity" && (
        <DetailModal
          title="Platform activity"
          onClose={() => setOpen(null)}
          footer={
            <Link
              href="/activity"
              className="font-label text-[11px] font-bold text-[#0F6CBD] hover:underline"
              onClick={() => setOpen(null)}
            >
              Full activity log →
            </Link>
          }
        >
          {activity.length === 0 ? (
            <p className="text-[11px] text-[#8B93A1]">
              {activityDate ? `No platform events for ${activityDate} yet.` : "No activity loaded."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {activity.slice(0, 40).map((a) => (
                <li key={a.id} className="rounded-lg border border-[#E1DFDD] bg-white px-2.5 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#0F6CBD]">
                      {a.type.replace(/[._]/g, " ")}
                    </span>
                    <span className="text-[9px] text-[#8B93A1]">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#1A1D26]">{a.summary}</p>
                  {a.actorLabel ? <p className="mt-0.5 text-[10px] text-[#5B6472]">{a.actorLabel}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </DetailModal>
      )}

      {open === "briefings" && (
        <DetailModal
          title="AI briefings"
          onClose={() => setOpen(null)}
          footer={
            <Link
              href="/admin/reports?tab=ai"
              className="font-label text-[11px] font-bold text-[#0F6CBD] hover:underline"
              onClick={() => setOpen(null)}
            >
              All reports →
            </Link>
          }
        >
          {briefings.length === 0 ? (
            <p className="text-[11px] text-[#8B93A1]">No AI briefings yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {briefings.map((b) => (
                <li key={b.id} className="rounded-lg border border-[#E1DFDD] bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[#0F6CBD]">{b.dateKey}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#1A1D26]">{b.subject}</p>
                </li>
              ))}
            </ul>
          )}
        </DetailModal>
      )}
    </div>
  );
}
