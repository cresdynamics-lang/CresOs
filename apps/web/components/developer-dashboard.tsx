"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { SidebarSection } from "./community/community-types";
import { devGlass } from "./developer/developer-glass-theme";

export type DeveloperProgressReminder = {
  reminderKey: string;
  subject: string;
  body: string;
  projectId?: string;
  projectName?: string;
  severity: "info" | "warning";
};

export type DeveloperProjectAnalytics = {
  id: string;
  name: string;
  status: string;
  needsReview: boolean;
  untasked: boolean;
  taskCount: number;
  projectTaskCount: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  pendingMilestones: number;
  overdueMilestones: number;
  progressPercent: number;
  lastTaskUpdateAt: string | null;
  hoursSinceUpdate: number | null;
  stale: boolean;
};

type AnalyticsPayload = {
  projects: DeveloperProjectAnalytics[];
  totals: { assigned: number; overdue: number; blocked: number; avgProgress: number };
  refreshedAt?: string;
};

export interface OnlineUser {
  id: string;
  name: string;
  roles?: { key: string; name: string }[];
  status: "online" | "busy" | "away" | "offline";
  isOnline: boolean;
  avatar?: string | null;
}

interface DeveloperReport {
  id: string;
  reportDate: string;
  reviewStatus?: string;
  remarks?: string | null;
  createdAt: string;
}

// ----------------------------------------------------
// Reusable Card Frame Component
// ----------------------------------------------------
interface CardFrameProps {
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function CardFrame({ title, icon, actions, footer, children, className = "" }: CardFrameProps) {
  return (
    <div className={`flex flex-col ${devGlass.card} p-5 min-h-[19rem] ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b ${devGlass.divider} pb-3.5 mb-4`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-slate-400 shrink-0">{icon}</span>
          <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>
      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col justify-between">
        {children}
      </div>
      {/* Footer */}
      {footer && (
        <div className="mt-4 border-t border-slate-800/60 pt-3 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}

// Helper to format Date: 22-JUN-2026
function formatAnnouncementDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = String(date.getDate()).padStart(2, "0");
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return "";
  }
}

// Helper to calculate weekdays in current month (Required reports count)
function getWeekdaysInCurrentMonth(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let weekdays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      weekdays++;
    }
  }
  return weekdays;
}

// ----------------------------------------------------
// Card 1: Team Directory Card
// ----------------------------------------------------
type Category = "developer" | "sales" | "finance" | "admin" | "all";

function TeamDirectoryCard({ apiFetch }: { apiFetch: (url: string) => Promise<Response> }) {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [filter, setFilter] = useState<Category>("developer");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiFetch("/chat-community/online-users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data?.data?.onlineUsers || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filter === "all") return true;
      const keys = u.roles?.map((r) => r.key) || [];
      if (filter === "developer") return keys.includes("developer");
      if (filter === "sales") return keys.includes("sales");
      if (filter === "finance") return keys.includes("finance") || keys.includes("director_finance");
      if (filter === "admin") return keys.includes("admin") || keys.includes("director_admin");
      return false;
    });
  }, [users, filter]);

  const statusColors = {
    online: "bg-emerald-500 shadow-emerald-500/50",
    busy: "bg-rose-500 shadow-rose-500/50",
    away: "bg-amber-500 shadow-amber-500/50",
    offline: "bg-slate-600 shadow-slate-600/50"
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const categories: { key: Category; label: string }[] = [
    { key: "developer", label: "Devs" },
    { key: "sales", label: "Sales" },
    { key: "finance", label: "Finance" },
    { key: "admin", label: "Admin" },
    { key: "all", label: "All" }
  ];

  return (
    <CardFrame
      title="Team Directory"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
      actions={
        <button onClick={fetchUsers} className="text-slate-500 hover:text-slate-300 p-1" title="Refresh">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.283 8H18" />
          </svg>
        </button>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1 mb-3.5 pb-2 border-b border-slate-800/40">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-200 ${
                filter === cat.key
                  ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto max-h-[14rem] pr-1 space-y-2">
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-6">Loading roster…</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No members in this category.</p>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-2 rounded-xl border border-slate-800/40 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-950/40 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-700/50">
                    {getInitials(user.name)}
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-950 shadow-sm ${statusColors[user.status || "offline"]}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                      {user.roles?.[0]?.name || "Team Member"}
                    </p>
                  </div>
                </div>
                <Link
                  href="/community"
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shrink-0"
                >
                  Chat
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </CardFrame>
  );
}

// ----------------------------------------------------
// Card 2: Dev Report Visualization Card
// ----------------------------------------------------
function DevReportVisualizationCard({
  apiFetch,
  developerReportStreak
}: {
  apiFetch: (url: string) => Promise<Response>;
  developerReportStreak: number;
}) {
  const [reports, setReports] = useState<DeveloperReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const response = await apiFetch("/developer-reports");
      if (response.ok) {
        setReports((await response.json()) as DeveloperReport[]);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Compute Current Month Stats
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`; // YYYY-MM

  const loggedReportsThisMonth = reports.filter((r) => r.reportDate.startsWith(currentMonthKey)).length;
  const requiredReportsThisMonth = getWeekdaysInCurrentMonth();
  const progressPercent = Math.min(
    100,
    requiredReportsThisMonth > 0 ? Math.round((loggedReportsThisMonth / requiredReportsThisMonth) * 100) : 0
  );

  // Generate last 30 calendar days list for Streak contribution grid
  const last30Days = useMemo(() => {
    const list = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateString = d.toISOString().slice(0, 10);
      const report = reports.find((r) => r.reportDate === dateString);
      list.push({
        date: dateString,
        hasReport: !!report,
        status: report?.reviewStatus || "none"
      });
    }
    return list;
  }, [reports]);

  return (
    <CardFrame
      title="Report Compliance"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      actions={
        <button onClick={fetchReports} className="text-slate-500 hover:text-slate-300 p-1" title="Refresh">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.283 8H18" />
          </svg>
        </button>
      }
    >
      <div className="flex flex-col justify-between h-full space-y-4">
        {/* Metric Overview */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight text-slate-100">
              {loggedReportsThisMonth} <span className="text-xs font-normal text-slate-500">/ {requiredReportsThisMonth} required</span>
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Logged reports this cycle</p>
          </div>
          {developerReportStreak > 0 && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                🔥 {developerReportStreak} day streak
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-sky-600 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-500 font-semibold uppercase">
            <span>{progressPercent}% Complete</span>
            <span>Billing Month</span>
          </div>
        </div>

        {/* GitHub-style Contribution Grid */}
        <div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Submission Heatmap (Past 30 Days)</p>
          <div className="flex flex-wrap gap-1.5 pb-2">
            {loading ? (
              <div className="h-6 w-full flex items-center justify-center text-xs text-slate-600">Syncing history…</div>
            ) : (
              last30Days.map((day) => {
                let colorClass = "bg-slate-800/60 border border-slate-700/30 hover:border-slate-600";
                if (day.hasReport) {
                  if (day.status === "checked") colorClass = "bg-emerald-500 hover:bg-emerald-400 border border-emerald-600";
                  else if (day.status === "viewed") colorClass = "bg-sky-500 hover:bg-sky-400 border border-sky-600";
                  else colorClass = "bg-violet-600 hover:bg-violet-500 border border-violet-700";
                }
                return (
                  <div
                    key={day.date}
                    className={`w-3.5 h-3.5 rounded-md transition-all ${colorClass}`}
                    title={`${day.date}: ${day.hasReport ? `Logged (${day.status})` : "No Report Submitted"}`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </CardFrame>
  );
}

// ----------------------------------------------------
// Card 3: Top 5 Notifications (Announcement Style)
// ----------------------------------------------------
interface AnnouncementItem {
  id: string;
  subject: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function AnnouncementCard({
  notifications,
  onRefresh
}: {
  notifications: AnnouncementItem[];
  onRefresh: () => void;
}) {
  const topNotifications = notifications.slice(0, 5);

  return (
    <CardFrame
      title="Announcement"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      }
      actions={
        <button onClick={onRefresh} className="text-slate-500 hover:text-slate-300 p-1" title="Refresh">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.283 8H18" />
          </svg>
        </button>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto max-h-[14rem] space-y-1">
          {topNotifications.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">No recent announcements.</p>
          ) : (
            topNotifications.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-slate-800/50 py-2.5 last:border-0 hover:bg-slate-900/10 px-1 rounded-lg"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-sky-400 hover:underline leading-relaxed line-clamp-2 cursor-pointer">
                    {item.subject || item.body.slice(0, 60)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">
                    BY SYSTEM
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tabular-nums">
                    {formatAnnouncementDate(item.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </CardFrame>
  );
}

// ----------------------------------------------------
// Card 4: Active Project Context Card
// ----------------------------------------------------
function ActiveProjectCard({ apiFetch }: { apiFetch: (url: string) => Promise<Response> }) {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [focus, setFocus] = useState<{ projectId?: string | null; note?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfRes, aRes] = await Promise.all([
        apiFetch("/user/current-focus"),
        apiFetch("/dashboard/developer-analytics")
      ]);

      if (cfRes.ok) {
        const j = await cfRes.json();
        setFocus(j.data || null);
      }
      if (aRes.ok) {
        const j = await aRes.json();
        setAnalytics(j.data || null);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeProject = useMemo(() => {
    if (!analytics) return null;
    if (focus?.projectId) {
      return analytics.projects.find((p) => p.id === focus.projectId) || analytics.projects[0] || null;
    }
    return analytics.projects[0] || null;
  }, [analytics, focus]);

  return (
    <CardFrame
      title={activeProject ? `Current Project: ${activeProject.name}` : "Current Project"}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      }
      actions={
        <button onClick={loadData} className="text-slate-500 hover:text-slate-300 p-1" title="Refresh">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.283 8H18" />
          </svg>
        </button>
      }
      footer={
        activeProject ? (
          <Link
            href={`/projects/${activeProject.id}`}
            className="w-full text-center rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-950/20 transition-all shrink-0"
          >
            Open Project Board
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col justify-between h-full space-y-4">
        {loading ? (
          <p className="text-xs text-slate-500 text-center py-10">Syncing project board…</p>
        ) : !activeProject ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-xs text-slate-400">No active project selected today.</p>
            <Link
              href="/dashboard"
              className="inline-block text-xs font-semibold text-violet-400 hover:underline"
            >
              Select focus project below →
            </Link>
          </div>
        ) : (
          <>
            {/* Horizontal progress bar */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Overall Completion</span>
                <span className="text-xs font-bold text-slate-200">{activeProject.progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${activeProject.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Key stats grid */}
            <div className="grid grid-cols-3 gap-2.5 text-center mt-2">
              <div className="p-2 border border-slate-800 bg-slate-950/25 rounded-xl">
                <p className="text-lg font-bold text-slate-200">{activeProject.overdueTasks}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">Open Tasks</p>
              </div>
              <div className="p-2 border border-slate-800 bg-slate-950/25 rounded-xl">
                <p className="text-lg font-bold text-slate-200">{activeProject.pendingMilestones}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">Pending Miles</p>
              </div>
              <div className="p-2 border border-slate-800 bg-slate-950/25 rounded-xl">
                <p className="text-lg font-bold text-rose-400">{activeProject.blockedTasks}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">Blockers</p>
              </div>
            </div>
          </>
        )}
      </div>
    </CardFrame>
  );
}

// ----------------------------------------------------
// Card 5: Today's Execution Queue ("Up Next")
// ----------------------------------------------------
interface ExecutionTask {
  id: string;
  title: string;
  projectId: string;
  dueDate: string;
}

function ExecutionQueueCard({ overdueTasks }: { overdueTasks: ExecutionTask[] }) {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Sync with localStorage to keep checked state persistent for the day
    const key = `cresos-tasks-checked-${new Date().toISOString().slice(0, 10)}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setCheckedIds(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const key = `cresos-tasks-checked-${new Date().toISOString().slice(0, 10)}`;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  const tasksToShow = overdueTasks.slice(0, 4);

  return (
    <CardFrame
      title="Today's Tasks"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
    >
      <div className="flex flex-col h-full min-h-0 justify-between">
        <div className="flex-1 overflow-y-auto max-h-[14rem] space-y-2.5">
          {tasksToShow.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs text-slate-500">No overdue or pending tasks assigned.</p>
              <p className="text-[10px] text-emerald-400 mt-1">✓ You are completely on track today!</p>
            </div>
          ) : (
            tasksToShow.map((task) => {
              const isChecked = !!checkedIds[task.id];
              return (
                <div
                  key={task.id}
                  onClick={() => toggleCheck(task.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border border-slate-800/40 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-950/40 cursor-pointer select-none transition-all ${
                    isChecked ? "opacity-60 bg-slate-900/10" : ""
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isChecked
                          ? "bg-violet-600 border-violet-500"
                          : "border-slate-600 bg-slate-950 hover:border-slate-400"
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold text-slate-200 leading-snug transition-all ${
                        isChecked ? "line-through text-slate-500" : ""
                      }`}
                    >
                      {task.title}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </CardFrame>
  );
}

// ----------------------------------------------------
// Card 6: Quick Actions (The Utility Belt)
// ----------------------------------------------------
function QuickActionsCard() {
  return (
    <CardFrame
      title="Quick Actions"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      }
    >
      <div className="grid grid-cols-2 gap-3 h-full">
        {/* Submit Daily Report */}
        <Link
          href="/developer-reports"
          className="flex flex-col items-center justify-center text-center p-3 border border-slate-800 bg-slate-950/20 hover:border-violet-500/50 hover:bg-violet-950/10 rounded-xl transition-all group gap-2"
        >
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-violet-500/20 group-hover:text-violet-400 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">Submit Report</span>
        </Link>

        {/* Request Leave */}
        <Link
          href="/developer-reports"
          className="flex flex-col items-center justify-center text-center p-3 border border-slate-800 bg-slate-950/20 hover:border-sky-500/50 hover:bg-sky-950/10 rounded-xl transition-all group gap-2"
        >
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-sky-500/20 group-hover:text-sky-400 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">Request Leave</span>
        </Link>

        {/* Log Time */}
        <Link
          href="/developer-reports"
          className="flex flex-col items-center justify-center text-center p-3 border border-slate-800 bg-slate-950/20 hover:border-emerald-500/50 hover:bg-emerald-950/10 rounded-xl transition-all group gap-2"
        >
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">Log Time</span>
        </Link>

        {/* IT Support */}
        <Link
          href="/community"
          className="flex flex-col items-center justify-center text-center p-3 border border-slate-800 bg-slate-950/20 hover:border-amber-500/50 hover:bg-amber-950/10 rounded-xl transition-all group gap-2"
        >
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">IT Support</span>
        </Link>
      </div>
    </CardFrame>
  );
}

// ----------------------------------------------------
// Main DeveloperDashboardSections Component
// ----------------------------------------------------
export function DeveloperDashboardSections({
  apiFetch,
  onRefreshAttention,
  developerReportStreak,
  overdueTasks,
  notifications,
  progressReminders
}: {
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onRefreshAttention: () => void;
  developerReportStreak: number;
  overdueTasks: ExecutionTask[];
  notifications: AnnouncementItem[];
  progressReminders: DeveloperProgressReminder[];
}) {
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const visibleReminders = progressReminders.filter((r) => !dismissedReminders.has(r.reminderKey));

  return (
    <div className="flex flex-col gap-6">
      {/* Reminders banner */}
      {visibleReminders.length > 0 && (
        <div className="space-y-3">
          {visibleReminders.map((r) => (
            <div
              key={r.reminderKey}
              className={r.severity === "warning" ? devGlass.alertWarning : devGlass.alertInfo}
            >
              <p className="font-display text-base font-bold text-slate-100">{r.subject}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{r.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDismissedReminders((s) => new Set(s).add(r.reminderKey))}
                  className={devGlass.btnGhost}
                >
                  Dismiss Reminder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid of the 6 core components */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Team Directory */}
        <TeamDirectoryCard apiFetch={apiFetch} />

        {/* Card 2: Report Streak / Compliance */}
        <DevReportVisualizationCard apiFetch={apiFetch} developerReportStreak={developerReportStreak} />

        {/* Card 3: Top 5 Announcements / Notifications */}
        <AnnouncementCard notifications={notifications} onRefresh={onRefreshAttention} />

        {/* Card 4: Active Project Context */}
        <ActiveProjectCard apiFetch={apiFetch} />

        {/* Card 5: Today's Tasks Execution Queue */}
        <ExecutionQueueCard overdueTasks={overdueTasks} />

        {/* Card 6: Quick Actions Utility Belt */}
        <QuickActionsCard />
      </div>

      {/* Today's Focus Setter */}
      <div className="w-full">
        <CurrentFocusPanelStyled apiFetch={apiFetch} />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Today's Focus Panel Component (Styled from original)
// ----------------------------------------------------
function CurrentFocusPanelStyled({
  apiFetch
}: {
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [focusNotice, setFocusNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfRes, pRes] = await Promise.all([
        apiFetch("/user/current-focus"),
        apiFetch("/projects")
      ]);
      if (cfRes.ok) {
        const j = await cfRes.json();
        const d = j.data;
        setProjectId(d?.projectId || "");
        setNote(d?.note || "");
        setUpdatedAt(d?.updatedAt || null);
      }
      if (pRes.ok) {
        const list = await pRes.json();
        setProjects(Array.isArray(list) ? list.map((p) => ({ id: p.id, name: p.name })) : []);
      }
    } catch (e) {
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
    setFocusNotice(null);
    try {
      const res = await apiFetch("/user/current-focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId || null, note: note.trim() || null })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Save failed");
        return;
      }
      if (j.data?.updatedAt) setUpdatedAt(j.data.updatedAt);
      const parts: string[] = ["Focus saved."];
      if (j.data?.dailyFocusTask?.id) {
        parts.push(
          j.data.dailyFocusTask.created
            ? "Added to today's tasks."
            : "Updated today's focus task."
        );
      }
      if (j.data?.milestoneUpdate?.criteriaUpdated) {
        parts.push(`Milestone "${j.data.milestoneUpdate.name}" success criteria updated.`);
      } else if (j.data?.milestoneUpdate?.name && note.trim()) {
        parts.push(`Linked to milestone "${j.data.milestoneUpdate.name}".`);
      }
      setFocusNotice(parts.join(" "));
    } catch (e) {
      setError("Could not save focus");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`${devGlass.panelInset} p-5`}>
        <p className="text-xs text-slate-500">Loading focus panel…</p>
      </div>
    );
  }

  return (
    <div className={`${devGlass.card} p-5`}>
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Set Today's Project Focus</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Select the project you are working on today so it displays in your Active Project Context, adds a task for
            today, and updates milestone success criteria. You'll get alerts if focus or today's task is missed.
          </p>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {focusNotice && <p className="text-xs text-emerald-300/90">{focusNotice}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Project Focus
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={devGlass.input}
            >
              <option value="">— No project selected —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-[2] flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Short focus note (optional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. implementing direct chat UI"
              className={`${devGlass.input} text-xs`}
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className={`w-full shrink-0 sm:w-auto ${devGlass.btnPrimary} disabled:opacity-50`}
          >
            {saving ? "Saving…" : "Update Focus"}
          </button>
        </div>
        {updatedAt && (
          <p className="text-[10px] text-slate-500">Last updated: {new Date(updatedAt).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}
