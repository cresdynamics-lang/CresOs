"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth-context";
import { notify, requestNotificationPermission } from "../browser-notify";

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
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" }
] as const;

const TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Call" },
  { value: "report", label: "Report" },
  { value: "task", label: "Task" },
  { value: "other", label: "Other" }
];

const REMINDER_OPTIONS: { value: number | ""; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: 5, label: "5 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" }
];

export default function SchedulePage() {
  const { apiFetch, auth } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");
  const canDeleteOrEditHistory = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">("week");
  const [completedFilter, setCompletedFilter] = useState<"all" | "done" | "pending">("all");
  const [orgSchedule, setOrgSchedule] = useState(false);
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "task", scheduledAt: "", notes: "", reminderMinutesBefore: "" as number | "" });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ period, completed: completedFilter });
      if (isAdmin && orgSchedule) q.set("scope", "org");
      const res = await apiFetch(`/schedule?${q.toString()}`);
      if (res.ok) setData((await res.json()) as ScheduleResponse);
    } catch {
      setData(null);
    }
  }, [period, completedFilter, apiFetch, isAdmin, orgSchedule]);

  useEffect(() => {
    load();
  }, [load]);

  // Request permission so reminders can ring
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setNotificationPermission(Notification.permission);
    requestNotificationPermission().then((p) => setNotificationPermission(p));
  }, []);

  // Client-side reminder timers: every minute check if any item's reminder time has passed; if so, ring
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
          const typeLabel = { meeting: "Meeting", call: "Call", report: "Report", task: "Task", other: "Item" }[item.type] ?? "Item";
          notify(`Get ready: ${item.title}`, {
            body: `${typeLabel} in ${item.reminderMinutesBefore} min. ${item.notes ? item.notes.slice(0, 80) : ""}`.trim(),
            tag: `schedule-${item.id}`,
            playSound: true
          });
        }
      }
    };

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [data?.items]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const scheduledAt = form.scheduledAt || new Date().toISOString().slice(0, 16);
    setSubmitting(true);
    try {
      const res = await apiFetch("/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          scheduledAt: new Date(scheduledAt).toISOString(),
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

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Tasks & schedule</h2>
          <p className="text-sm text-slate-300">
            Schedule meetings, calls, reports, and tasks. Review by day, week, month, or quarter to stay accountable.
            {isAdmin && (
              <span className="mt-2 block text-xs text-slate-400">
                As admin you can view everyone’s schedule and mark items done to confirm meetings org-wide.
              </span>
            )}
          </p>
          {notificationPermission === "denied" && (
            <p className="mt-1 text-xs text-amber-400">
              Enable browser notifications in your browser settings so reminders can ring and notify you.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Add item
        </button>
      </div>

      {/* Period review selector */}
      <div className="shell">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Review period</p>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${period === p.value ? "bg-sky-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={orgSchedule}
              onChange={(e) => setOrgSchedule(e.target.checked)}
              className="rounded border-slate-600"
            />
            Show entire organization (confirm anyone’s meetings)
          </label>
        )}
      </div>

      {/* Accountability stats */}
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="shell">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{data.stats.total}</p>
            <p className="text-xs text-slate-500">scheduled in period</p>
          </div>
          <div className="shell">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Done</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{data.stats.completed}</p>
            <p className="text-xs text-slate-500">completed</p>
          </div>
          <div className="shell">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-amber-400">{data.stats.pending}</p>
            <p className="text-xs text-slate-500">not done</p>
          </div>
        </div>
      )}

      {/* Filter: All / Done / Pending */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Show:</span>
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setCompletedFilter(f)}
            className={`rounded px-2 py-1 text-xs font-medium ${completedFilter === f ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
          >
            {f === "all" ? "All" : f === "done" ? "Done" : "Pending"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="shell">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">
          {PERIODS.find((p) => p.value === period)?.label}
          {data?.scope === "org" ? " · org-wide" : ""} — {data?.items.length ?? 0} items
        </h3>
        {!data ? (
          <p className="text-sm text-slate-400">Getting your schedule…</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-slate-400">No items in this period. Add meetings, calls, reports, or tasks to stay on track.</p>
        ) : (
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${item.completedAt ? "border-slate-700 bg-slate-800/40 opacity-90" : "border-slate-700 bg-slate-800/60"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-slate-100 ${item.completedAt ? "line-through text-slate-400" : ""}`}>
                    {item.title}
                  </p>
                  {item.user && (
                    <p className="text-xs text-sky-400/90">
                      {item.user.name ?? item.user.email}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {TYPES.find((t) => t.value === item.type)?.label ?? item.type} · {new Date(item.scheduledAt).toLocaleString()}
                    {item.reminderMinutesBefore != null && (
                      <span className="ml-1.5 text-sky-400">· Reminder {item.reminderMinutesBefore} min before</span>
                    )}
                  </p>
                  {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDone(item)}
                    disabled={togglingId === item.id}
                    className={`rounded px-2 py-1 text-xs font-medium ${item.completedAt ? "bg-slate-600 text-slate-200 hover:bg-slate-500" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-50`}
                  >
                    {togglingId === item.id ? "…" : item.completedAt ? "Undo" : "Mark done"}
                  </button>
                  {canDeleteOrEditHistory && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen && (
        <div className="shell max-w-md border-sky-600/30">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Schedule something</h3>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Title *</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Call client X, Submit report, Team standup"
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">When</span>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Remind me before (to prepare)</span>
              <select
                value={form.reminderMinutesBefore === "" ? "" : form.reminderMinutesBefore}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    reminderMinutesBefore: e.target.value === "" ? "" : Number(e.target.value)
                  }))
                }
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              >
                {REMINDER_OPTIONS.map((r) => (
                  <option key={r.value === "" ? "none" : r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
                {submitting ? "Adding…" : "Add"}
              </button>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
