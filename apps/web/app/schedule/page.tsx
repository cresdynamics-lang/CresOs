"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth-context";
import { notify, requestNotificationPermission } from "../browser-notify";
import { CrmSectionPanel, WorkspaceFilterPills } from "../../components/crm/crm-section";
import { ScheduleKpiStrip } from "../../components/schedule-kpi-strip";
import { StatTone } from "../../components/stat-card";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import {
  canAccessSchedule,
  canDeleteScheduleItems,
  canViewOrgSchedule,
  scheduleAttentionForRoles,
  scheduleDescriptionForRoles,
  SCHEDULE_PAGE_EYEBROW
} from "../../lib/schedule-access";
import {
  formatNairobiDateTime,
  formatNairobiNow,
  nairobiDatetimeLocalToIso,
  toNairobiDatetimeLocalValue
} from "../../lib/nairobi-datetime";
import { DeveloperScheduleView } from "./developer-schedule-view";

type ScheduleItem = {
  id: string;
  title: string;
  type: string;
  scheduledAt: string;
  completedAt: string | null;
  notes: string | null;
  reminderMinutesBefore: number | null;
  user?: { id: string; name: string | null; email: string };
};

type ScheduleResponse = {
  period: string;
  scope?: string;
  range: { start: string; end: string };
  stats: { total: number; completed: number; pending: number };
  items: ScheduleItem[];
};

const PERIODS = [
  { value: "day" as const, label: "Today" },
  { value: "week" as const, label: "This week" },
  { value: "month" as const, label: "This month" },
  { value: "quarter" as const, label: "This quarter" }
];

const TYPES = [
  { value: "meeting", label: "Meeting", tone: "sky" as StatTone, icon: "◎" },
  { value: "call", label: "Call", tone: "emerald" as StatTone, icon: "☎" },
  { value: "report", label: "Report", tone: "violet" as StatTone, icon: "◇" },
  { value: "task", label: "Task", tone: "amber" as StatTone, icon: "✓" },
  { value: "other", label: "Other", tone: "brand" as StatTone, icon: "•" }
];

const TYPE_BADGE: Record<string, { tone: StatTone; label: string }> = Object.fromEntries(
  TYPES.map((t) => [t.value, { tone: t.tone, label: t.label }])
);

const REMINDER_OPTIONS: { value: number | ""; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: 5, label: "5 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" }
];

const FILTER_OPTIONS: { value: "all" | "done" | "pending"; label: string; tone: StatTone }[] = [
  { value: "all", label: "All", tone: "sky" },
  { value: "pending", label: "Pending", tone: "amber" },
  { value: "done", label: "Done", tone: "emerald" }
];

function typeMeta(type: string) {
  return TYPES.find((t) => t.value === type) ?? TYPES[4];
}

export default function SchedulePage() {
  const { apiFetch, auth, hydrated } = useAuth();
  const roleKeys = auth.roleKeys;
  const canUseSchedule = canAccessSchedule(roleKeys);
  const isDeveloperOnly =
    roleKeys.includes("developer") &&
    !roleKeys.some((r) => ["admin", "director_admin", "sales", "finance", "analyst", "client"].includes(r));
  const showOrgToggle = canViewOrgSchedule(roleKeys);
  const canDeleteOrEditHistory = canDeleteScheduleItems(roleKeys);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">("week");
  const [completedFilter, setCompletedFilter] = useState<"all" | "done" | "pending">("all");
  const [orgSchedule, setOrgSchedule] = useState(false);
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "task",
    scheduledAt: "",
    notes: "",
    reminderMinutesBefore: "" as number | ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  const [nairobiNow, setNairobiNow] = useState(() => formatNairobiNow());
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setNairobiNow(formatNairobiNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ period, completed: completedFilter });
      if (showOrgToggle && orgSchedule) q.set("scope", "org");
      const res = await apiFetch(`/schedule?${q.toString()}`);
      if (res.ok) setData((await res.json()) as ScheduleResponse);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, completedFilter, apiFetch, showOrgToggle, orgSchedule]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setNotificationPermission(Notification.permission);
    void requestNotificationPermission().then((p) => setNotificationPermission(p));
  }, []);

  useEffect(() => {
    const items = data?.items ?? [];
    const withReminder = items.filter(
      (i) => !i.completedAt && i.reminderMinutesBefore != null && new Date(i.scheduledAt) > new Date()
    );
    if (withReminder.length === 0) return;

    const check = () => {
      const now = Date.now();
      for (const item of withReminder) {
        const scheduled = new Date(item.scheduledAt).getTime();
        const triggerAt = scheduled - (item.reminderMinutesBefore ?? 0) * 60 * 1000;
        if (now >= triggerAt && !notifiedIdsRef.current.has(item.id)) {
          notifiedIdsRef.current.add(item.id);
          if (item.type === "task" || item.type === "other") continue;
          const typeLabel = TYPE_BADGE[item.type]?.label ?? "Item";
          notify(`Get ready: ${item.title}`, {
            body: `${typeLabel} in ${item.reminderMinutesBefore} min. ${item.notes ? item.notes.slice(0, 80) : ""}`.trim(),
            tag: `schedule-${item.id}`,
            playSound: false
          });
        }
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [data?.items]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const scheduledAt = form.scheduledAt || toNairobiDatetimeLocalValue(new Date());
    setSubmitting(true);
    try {
      const res = await apiFetch("/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          scheduledAt: nairobiDatetimeLocalToIso(scheduledAt),
          notes: form.notes.trim() || undefined,
          reminderMinutesBefore: form.reminderMinutesBefore === "" ? null : form.reminderMinutesBefore
        })
      });
      if (res.ok) {
        setForm({ title: "", type: "task", scheduledAt: "", notes: "", reminderMinutesBefore: "" });
        setAddOpen(false);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDone(item: ScheduleItem) {
    setTogglingId(item.id);
    try {
      const res = await apiFetch(`/schedule/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !item.completedAt })
      });
      if (res.ok) await load();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await apiFetch(`/schedule/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch {
      // ignore
    }
  }

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "Period";
  const scheduleDescription = scheduleDescriptionForRoles(roleKeys);
  const attention = scheduleAttentionForRoles(roleKeys);

  if (hydrated && !canUseSchedule) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-4">
        <p className="text-center text-sm text-slate-400">Tasks & schedule is not available for your account.</p>
      </section>
    );
  }

  if (isDeveloperOnly) {
    return (
      <DeveloperScheduleView
        period={period}
        onPeriodChange={setPeriod}
        completedFilter={completedFilter}
        onCompletedFilterChange={setCompletedFilter}
        stats={data?.stats ?? null}
        items={data?.items ?? null}
        periodLabel={periodLabel}
        nairobiNow={nairobiNow}
        loading={loading}
        onRefresh={() => void load()}
        onAddOpen={() => setAddOpen(true)}
        addOpen={addOpen}
        onAddClose={() => setAddOpen(false)}
        form={form}
        onFormChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        types={TYPES}
        onSubmitAdd={(e) => void handleAdd(e)}
        submitting={submitting}
        onToggleDone={(item) => void toggleDone(item)}
        togglingId={togglingId}
        typeMeta={typeMeta}
        notificationDenied={notificationPermission === "denied"}
      />
    );
  }

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 px-3 py-4 sm:px-6 sm:py-5">
      <WorkspaceDashboardIntro
        title="Tasks & schedule"
        description={scheduleDescription}
        eyebrow={SCHEDULE_PAGE_EYEBROW}
        brandLead="Operating system for growth"
        showWelcomeBanner
        showWelcomeRoleLabel={false}
        welcomeChildren={
          <>
            <DashboardSectionLabel roleKeys={roleKeys}>{attention.sectionTitle}</DashboardSectionLabel>
            <p className="font-body text-sm leading-relaxed text-slate-300">{attention.summary}</p>
            <ul className="ml-1 mt-3 list-disc space-y-2 pl-4 font-body text-sm text-slate-400 marker:text-violet-500">
              {attention.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-500 hover:to-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <span className="text-lg leading-none" aria-hidden>
              +
            </span>
            Add item
          </button>
        }
      />

      {notificationPermission === "denied" && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-slate-950/90 to-slate-950 px-4 py-3 sm:px-5">
          <p className="text-sm text-amber-100">
            <span className="font-semibold text-amber-300">Browser notifications are off.</span> Enable them in your
            browser settings so meeting, call, and report reminders can ring and notify you.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-500">
        All schedule times use <span className="font-medium text-slate-400">Nairobi (EAT)</span>. Now:{" "}
        <span className="font-medium text-sky-400/90">{nairobiNow}</span>
      </p>

      <CrmSectionPanel title="Review period" tone="sky" description="Pick the window you want to review and stay accountable.">
        <WorkspaceFilterPills
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((p) => ({
            value: p.value,
            label: p.label,
            tone: "sky" as StatTone
          }))}
        />
        {showOrgToggle && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-950/20 px-4 py-3 text-sm text-violet-100">
            <input
              type="checkbox"
              checked={orgSchedule}
              onChange={(e) => setOrgSchedule(e.target.checked)}
              className="h-4 w-4 rounded border-violet-600 text-violet-600 focus:ring-violet-500"
            />
            Show entire organization (review and confirm team meetings)
          </label>
        )}
      </CrmSectionPanel>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-6">
        <div className="flex flex-col gap-4 lg:min-h-0">
          <CrmSectionPanel title="Accountability" tone="violet" description="Totals for the selected review period.">
            {data ? (
              <ScheduleKpiStrip stats={data.stats} />
            ) : (
              <p className="text-sm text-slate-400">Loading stats…</p>
            )}
          </CrmSectionPanel>

          <CrmSectionPanel title="Show" tone="amber" description="Filter the list by completion status.">
            <WorkspaceFilterPills value={completedFilter} onChange={setCompletedFilter} options={FILTER_OPTIONS} />
          </CrmSectionPanel>
        </div>

        <CrmSectionPanel
          title={`${periodLabel}${data?.scope === "org" ? " · org-wide" : ""}`}
          tone="emerald"
          description={`${data?.items.length ?? 0} item${data?.items.length === 1 ? "" : "s"} in this period`}
          className="flex min-h-[min(24rem,50vh)] flex-1 flex-col lg:min-h-0"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {!data ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-6 py-16 text-center">
                <p className="font-display text-lg font-semibold text-slate-300">Loading your schedule…</p>
              </div>
            ) : data.items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-emerald-800/40 bg-gradient-to-br from-emerald-950/20 via-slate-950/60 to-slate-950 px-6 py-16 text-center">
                <p className="font-display text-xl font-bold tracking-tight text-emerald-200/90">No items in this period</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                  Add meetings, calls, reports, or tasks to stay on track.
                </p>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="mt-6 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500"
                >
                  Add your first item
                </button>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {data.items.map((item) => {
                  const meta = typeMeta(item.type);
                  const done = !!item.completedAt;
                  const toneBorder: Record<StatTone, string> = {
                    sky: "border-sky-500/35",
                    emerald: "border-emerald-500/35",
                    violet: "border-violet-500/35",
                    amber: "border-amber-500/35",
                    brand: "border-brand/35",
                    rose: "border-rose-500/35"
                  };
                  const toneBg: Record<StatTone, string> = {
                    sky: "from-sky-500/8",
                    emerald: "from-emerald-500/8",
                    violet: "from-violet-500/8",
                    amber: "from-amber-500/8",
                    brand: "from-brand/8",
                    rose: "from-rose-500/8"
                  };
                  return (
                    <li
                      key={item.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-br via-slate-950/90 to-slate-950 px-4 py-3.5 transition ${toneBorder[meta.tone]} ${toneBg[meta.tone]} ${done ? "opacity-75" : ""}`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${
                            meta.tone === "sky"
                              ? "bg-sky-500/20 text-sky-300"
                              : meta.tone === "emerald"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : meta.tone === "violet"
                                  ? "bg-violet-500/20 text-violet-300"
                                  : meta.tone === "amber"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-brand/20 text-brand"
                          }`}
                        >
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-display text-base font-semibold tracking-tight text-slate-100 ${done ? "line-through text-slate-500" : ""}`}
                          >
                            {item.title}
                          </p>
                          {item.user && (
                            <p className="mt-0.5 text-xs text-sky-400/90">{item.user.name ?? item.user.email}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-400">
                            <span className="font-medium text-slate-300">{meta.label}</span>
                            {" · "}
                            {formatNairobiDateTime(item.scheduledAt)}
                            {item.reminderMinutesBefore != null && (
                              <span className="ml-1.5 text-violet-400">
                                · Reminder {item.reminderMinutesBefore} min before
                              </span>
                            )}
                          </p>
                          {item.notes && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleDone(item)}
                          disabled={togglingId === item.id}
                          className={`rounded-xl px-3.5 py-2 text-xs font-semibold shadow-md transition disabled:opacity-50 ${
                            done
                              ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                              : "bg-emerald-600 text-white shadow-emerald-900/30 hover:bg-emerald-500"
                          }`}
                        >
                          {togglingId === item.id ? "…" : done ? "Undo" : "Mark done"}
                        </button>
                        {canDeleteOrEditHistory && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(item.id)}
                            className="rounded-xl border border-rose-600/40 bg-rose-950/40 p-2 text-rose-300 hover:bg-rose-900/50"
                            aria-label="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CrmSectionPanel>
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-add-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-950/60 via-slate-950 to-violet-950/40 shadow-2xl shadow-sky-900/20">
            <div className="border-b border-slate-800/80 px-5 py-4 sm:px-6">
              <h3 id="schedule-add-title" className="font-display text-xl font-bold tracking-tight text-sky-200">
                Schedule something
              </h3>
              <p className="mt-1 text-sm text-slate-400">Meetings, calls, reports, and tasks — with optional reminders.</p>
            </div>
            <form onSubmit={(e) => void handleAdd(e)} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Title *</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Call client X, Submit report, Team standup"
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus:border-sky-500/50 focus:outline-none"
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">When (Nairobi)</span>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                    className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus:border-sky-500/50 focus:outline-none"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Remind me before</span>
                <select
                  value={form.reminderMinutesBefore === "" ? "" : form.reminderMinutesBefore}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      reminderMinutesBefore: e.target.value === "" ? "" : Number(e.target.value)
                    }))
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus:border-violet-500/50 focus:outline-none"
                >
                  {REMINDER_OPTIONS.map((r) => (
                    <option key={r.value === "" ? "none" : r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus:border-sky-500/50 focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-gradient-to-r from-sky-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-sky-500 hover:to-violet-500 disabled:opacity-50"
                >
                  {submitting ? "Adding…" : "Add to schedule"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-xl border border-slate-600 bg-slate-900/60 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
