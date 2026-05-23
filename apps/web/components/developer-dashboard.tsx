"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { emitDataRefresh } from "../app/data-refresh";
import { CrmSectionPanel } from "./crm/crm-section";
import { DashboardSectionLabel } from "./dashboard-welcome-banner";
import { StatCard, StatCardGrid } from "./stat-card";
import { WorkspaceHubCard } from "./workspace-hub-card";
import type { StatTone } from "./stat-card";

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

const NAV_HUB: { href: string; title: string; description: string; tone: StatTone; icon: string }[] = [
  {
    href: "/schedule",
    title: "Tasks",
    description: "Meetings, calls, reports, and deadlines — review by day, week, month, or quarter.",
    tone: "sky",
    icon: "◷"
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Delivery boards, tasks, milestones, and handoffs on your assignments.",
    tone: "emerald",
    icon: "◆"
  },
  {
    href: "/developer-reports",
    title: "Reports",
    description: "Daily and activity reports — locked history stays read-only after submit.",
    tone: "violet",
    icon: "◇"
  },
  {
    href: "/community",
    title: "Community",
    description: "Workspace chat, updates, and team coordination.",
    tone: "sky",
    icon: "◎"
  }
];

const DUTY_HUB = NAV_HUB;

const SNOOZE_PRESETS = [
  { key: "5m", label: "5 min" },
  { key: "15m", label: "15 min" },
  { key: "20m", label: "20 min" },
  { key: "30m", label: "30 min" },
  { key: "1h", label: "1 hour" },
  { key: "2h", label: "2 hours" },
  { key: "5h", label: "5 hours" },
  { key: "12h", label: "12 hours" },
  { key: "tomorrow", label: "Tomorrow" }
] as const;

function CurrentFocusPanelStyled({
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
      const res = await apiFetch("/user/current-focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId || null, note: note.trim() || null })
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
      <CrmSectionPanel title="Today's project focus" tone="emerald">
        <p className="text-sm text-slate-400">Loading current focus…</p>
      </CrmSectionPanel>
    );
  }

  return (
    <CrmSectionPanel
      title="Today's project focus"
      tone="emerald"
      description="Choose the project you are mainly working on so admin and director see it on the strategic overview. Developers: an approved project you are assigned to."
    >
      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full min-w-0 rounded-xl border border-emerald-800/50 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
          >
            <option value="">— No project selected —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-[2] flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Short note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. finishing API integration"
            className="w-full min-w-0 rounded-xl border border-emerald-800/50 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-full shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {updatedAt && (
        <p className="mt-3 text-xs text-slate-500">Last updated: {new Date(updatedAt).toLocaleString()}</p>
      )}
    </CrmSectionPanel>
  );
}

function ProgressReminderBanner({
  reminder,
  apiFetch,
  onSnoozed
}: {
  reminder: DeveloperProgressReminder;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onSnoozed: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  async function snooze(preset?: string) {
    setBusy(true);
    try {
      const res = await apiFetch("/dashboard/developer-reminders/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderKey: reminder.reminderKey,
          preset,
          phrase: preset ? undefined : phrase.trim() || undefined
        })
      });
      if (res.ok) onSnoozed(reminder.reminderKey);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const border =
    reminder.severity === "warning"
      ? "border-amber-500/50 bg-gradient-to-br from-amber-950/50 via-slate-950/90 to-slate-950"
      : "border-violet-500/40 bg-gradient-to-br from-violet-950/40 via-slate-950/90 to-slate-950";

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${border}`}>
      <p className="font-display text-base font-bold text-slate-100">{reminder.subject}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{reminder.body}</p>
      {reminder.projectId && (
        <Link
          href={`/projects/${reminder.projectId}`}
          className="mt-2 inline-block text-sm font-medium text-sky-400 hover:underline"
        >
          Open {reminder.projectName ?? "project"} →
        </Link>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Remind me later
        </button>
        {open &&
          SNOOZE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={busy}
              onClick={() => void snooze(p.key)}
              className="rounded-lg border border-violet-600/40 bg-violet-950/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder='e.g. "remind me in 20 minutes" or "Monday"'
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
          />
          <button
            type="button"
            disabled={busy || !phrase.trim()}
            onClick={() => void snooze()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Snooze
          </button>
        </div>
      )}
      <p className="mt-2 text-[0.65rem] text-slate-500">
        Snoozing notifies your assigned director that you postponed this nudge.
      </p>
    </div>
  );
}

export function DeveloperDashboardSections({
  apiFetch,
  onRefreshAttention,
  tasksOverdue,
  tasksDueSoon,
  developerReportStreak,
  messagesCount,
  projectsNeedingReview,
  handoffCount,
  progressReminders,
  overdueTasks,
  attentionMessages
}: {
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onRefreshAttention: () => void;
  tasksOverdue: number;
  tasksDueSoon: number;
  developerReportStreak: number;
  messagesCount: number;
  projectsNeedingReview: { id: string; name: string }[];
  handoffCount: number;
  progressReminders: DeveloperProgressReminder[];
  overdueTasks: { id: string; title: string; projectId: string; dueDate: string }[];
  attentionMessages: { id: string; reportId: string; content: string; askedAt: string }[];
}) {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch("/dashboard/developer-analytics");
      if (!res.ok) {
        setAnalyticsError(true);
        return;
      }
      const j = (await res.json()) as { data?: AnalyticsPayload };
      if (j.data) {
        setAnalytics(j.data);
        setAnalyticsError(false);
      }
    } catch {
      setAnalyticsError(true);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadAnalytics();
    const id = setInterval(() => void loadAnalytics(), 45_000);
    return () => clearInterval(id);
  }, [loadAnalytics]);

  const visibleReminders = progressReminders.filter((r) => !dismissedReminders.has(r.reminderKey));

  return (
    <div className="flex flex-col gap-5">
      {visibleReminders.length > 0 && (
        <div className="space-y-3">
          <DashboardSectionLabel roleKeys={["developer"]}>Progress reminders</DashboardSectionLabel>
          {visibleReminders.map((r) => (
            <ProgressReminderBanner
              key={r.reminderKey}
              reminder={r}
              apiFetch={apiFetch}
              onSnoozed={(key) => setDismissedReminders((s) => new Set(s).add(key))}
            />
          ))}
        </div>
      )}

      <CrmSectionPanel
        title="Live project analytics"
        tone="violet"
        description="Refreshes every 45 seconds from your assigned projects — task completion, milestones, and stale delivery signals."
        action={
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="rounded-lg border border-violet-600/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/50"
          >
            Refresh now
          </button>
        }
      >
        {analyticsError && !analytics && (
          <p className="text-sm text-rose-300">Could not load project analytics.</p>
        )}
        {analytics && (
          <>
            <StatCardGrid>
              <StatCard label="Assigned" value={analytics.totals.assigned} tone="sky" />
              <StatCard label="Avg progress" value={`${analytics.totals.avgProgress}%`} tone="violet" />
              <StatCard label="Overdue tasks" value={analytics.totals.overdue} tone="rose" />
              <StatCard label="Blocked" value={analytics.totals.blocked} tone="amber" />
            </StatCardGrid>
            {analytics.refreshedAt && (
              <p className="mt-2 text-xs text-slate-500">
                Last sync: {new Date(analytics.refreshedAt).toLocaleTimeString()}
              </p>
            )}
            {analytics.projects.length > 0 && (
              <div className="mt-4 -mx-1 overflow-x-auto rounded-xl border border-violet-900/40 sm:mx-0">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-violet-900/50 text-[0.65rem] uppercase tracking-wide text-violet-300/80">
                      <th className="px-3 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 font-medium">Progress</th>
                      <th className="px-3 py-2 font-medium">Tasks</th>
                      <th className="px-3 py-2 font-medium">Milestones</th>
                      <th className="px-3 py-2 text-right font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.projects.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/80 text-slate-200">
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-slate-100">{p.name}</span>
                          {p.stale && (
                            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.65rem] text-amber-300">
                              Stale {p.hoursSinceUpdate}h
                            </span>
                          )}
                          {p.untasked && (
                            <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[0.65rem] text-rose-300">
                              No tasks
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                                style={{ width: `${p.progressPercent}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-slate-400">{p.progressPercent}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">
                          {p.doneTasks}/{p.taskCount || p.projectTaskCount} done
                          {p.overdueTasks > 0 && (
                            <span className="ml-1 text-rose-300">· {p.overdueTasks} overdue</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">
                          {p.pendingMilestones} pending
                          {p.overdueMilestones > 0 && (
                            <span className="text-amber-300"> · {p.overdueMilestones} overdue</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <Link
                            href={`/projects/${p.id}`}
                            className="rounded-lg border border-violet-500/50 bg-violet-600/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CrmSectionPanel>

      <div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <DashboardSectionLabel roleKeys={["developer"]}>Navigate</DashboardSectionLabel>
          <button
            type="button"
            onClick={onRefreshAttention}
            className="w-fit rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Refresh alerts
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_HUB.map((c) => (
            <WorkspaceHubCard
              key={c.href}
              href={c.href}
              title={c.title}
              description={c.description}
              action="Open section"
              tone={c.tone}
              icon={c.icon}
            />
          ))}
        </div>
      </div>

      <CrmSectionPanel
        title="Developer overview"
        tone="sky"
        description="Your queue at a glance — tasks, reports, and projects needing attention."
      >
        <StatCardGrid>
          <Link href="/projects" className="block h-full min-h-[5.5rem]">
            <StatCard
              label="Tasks overdue"
              value={tasksOverdue}
              hint={tasksDueSoon > 0 ? `${tasksDueSoon} due soon` : "On track"}
              tone="rose"
            />
          </Link>
          <Link href="/developer-reports" className="block h-full min-h-[5.5rem]">
            <StatCard label="Messages" value={messagesCount} hint="Need a reply" tone="sky" />
          </Link>
          <Link href="/developer-reports" className="block h-full min-h-[5.5rem]">
            <StatCard
              label="Report streak"
              value={developerReportStreak}
              hint="Consecutive days"
              tone="emerald"
            />
          </Link>
          <Link href="/projects" className="block h-full min-h-[5.5rem]">
            <StatCard
              label="Projects"
              value={projectsNeedingReview.length + handoffCount}
              hint="Need attention"
              tone="amber"
            />
          </Link>
        </StatCardGrid>

        {(overdueTasks.length > 0 || attentionMessages.length > 0) && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {overdueTasks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Overdue tasks</p>
                <ul className="space-y-2 text-sm">
                  {overdueTasks.slice(0, 4).map((t) => (
                    <li key={t.id} className="rounded-xl border border-rose-900/40 bg-slate-950/50 px-3 py-2">
                      <Link href={`/projects/${t.projectId}`} className="text-rose-200 hover:underline">
                        {t.title}
                      </Link>
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
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Submit report →
          </Link>
          <Link
            href="/community"
            className="rounded-xl border border-slate-600 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900/50"
          >
            Community →
          </Link>
        </div>
      </CrmSectionPanel>

      <CrmSectionPanel
        title="Your work history (read-only)"
        tone="sky"
        description="Past submissions stay on record for visibility; you cannot edit or delete locked entries. You can still file new daily or activity reports from the pages below."
      >
        <Link
          href="/developer-reports"
          className="inline-flex rounded-xl border border-sky-500/40 bg-sky-600/20 px-5 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-600/30"
        >
          Developer reports →
        </Link>
      </CrmSectionPanel>

      {projectsNeedingReview.length > 0 && (
        <CrmSectionPanel
          title="Projects awaiting your review"
          tone="amber"
          description={`Review and add tasks for ${projectsNeedingReview.length} project(s) assigned to you.`}
        >
          <div className="overflow-x-auto rounded-xl border border-amber-900/40">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-amber-900/50 text-xs uppercase tracking-wide text-amber-300/80">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {projectsNeedingReview.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/80 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-slate-100">{p.name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <Link
                        href={`/projects/${p.id}`}
                        className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CrmSectionPanel>
      )}

      <CurrentFocusPanelStyled apiFetch={apiFetch} />

      <div>
        <DashboardSectionLabel roleKeys={["developer"]}>Your duties</DashboardSectionLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {DUTY_HUB.map((c) => (
            <WorkspaceHubCard
              key={`duty-${c.href}`}
              href={c.href}
              title={c.title}
              description={c.description}
              action="Open"
              tone={c.tone}
              icon={c.icon}
            />
          ))}
        </div>
        <p className="mt-6 text-center font-label text-xs tracking-[0.2em] text-slate-500">
          CresOS · Operating system for growth
        </p>
      </div>
    </div>
  );
}
