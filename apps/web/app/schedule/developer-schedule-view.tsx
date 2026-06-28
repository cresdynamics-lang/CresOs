"use client";

import type { FormEvent } from "react";
import type { StatTone } from "../../components/stat-card";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { DevNeuPanel, DevStatInline, DevStatRow } from "../../components/developer/developer-ui";
import { devNeu } from "../../components/developer/developer-theme";
import { formatNairobiDateTime } from "../../lib/nairobi-datetime";
import { useAuth } from "../auth-context";

export type ScheduleItemView = {
  id: string;
  title: string;
  type: string;
  scheduledAt: string;
  completedAt: string | null;
  notes: string | null;
  reminderMinutesBefore: number | null;
  user?: { id: string; name: string | null; email: string };
};

export type ScheduleStats = { total: number; completed: number; pending: number };

type Period = "day" | "week" | "month" | "quarter";

type TypeMeta = { value: string; label: string; tone: StatTone; icon: string };

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" }
];

const FILTER_OPTIONS: { value: "all" | "done" | "pending"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" }
];

const REMINDER_OPTIONS: { value: number | ""; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: 5, label: "5 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" }
];

function pillClass(active: boolean) {
  return active ? devNeu.navActive : devNeu.navIdle;
}

function typeAccent(tone: StatTone): string {
  if (tone === "sky") return "text-sky-400";
  if (tone === "emerald") return "text-emerald-400";
  if (tone === "violet") return "text-violet-400";
  if (tone === "amber") return "text-amber-400";
  if (tone === "rose") return "text-rose-400";
  return "text-brand";
}

type DeveloperScheduleViewProps = {
  period: Period;
  onPeriodChange: (p: Period) => void;
  completedFilter: "all" | "done" | "pending";
  onCompletedFilterChange: (f: "all" | "done" | "pending") => void;
  stats: ScheduleStats | null;
  items: ScheduleItemView[] | null;
  periodLabel: string;
  nairobiNow: string;
  loading: boolean;
  onRefresh: () => void;
  onAddOpen: () => void;
  addOpen: boolean;
  onAddClose: () => void;
  form: {
    title: string;
    type: string;
    scheduledAt: string;
    notes: string;
    reminderMinutesBefore: number | "";
  };
  onFormChange: (patch: Partial<DeveloperScheduleViewProps["form"]>) => void;
  types: TypeMeta[];
  onSubmitAdd: (e: FormEvent) => void;
  submitting: boolean;
  onToggleDone: (item: ScheduleItemView) => void;
  togglingId: string | null;
  typeMeta: (type: string) => TypeMeta;
  notificationDenied: boolean;
};

export function DeveloperScheduleView({
  period,
  onPeriodChange,
  completedFilter,
  onCompletedFilterChange,
  stats,
  items,
  periodLabel,
  nairobiNow,
  loading,
  onRefresh,
  onAddOpen,
  addOpen,
  onAddClose,
  form,
  onFormChange,
  types,
  onSubmitAdd,
  submitting,
  onToggleDone,
  togglingId,
  typeMeta,
  notificationDenied
}: DeveloperScheduleViewProps) {
  const { auth } = useAuth();
  const list = items ?? [];

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/90">
            Workspace
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            Tasks & schedule
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Plan standups, reviews, and report deadlines alongside delivery work. Times are in{" "}
            <span className="text-violet-300/90">Nairobi (EAT)</span> — now {nairobiNow}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${devNeu.navIdle} rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={onAddOpen} className={devNeu.btnPrimary}>
            + Add item
          </button>
        </div>
      </header>

      {notificationDenied ? (
        <div className={`${devNeu.alertWarning} px-4 py-3 text-sm text-amber-200 sm:px-5`}>
          Browser notifications are off — enable them for meeting and call reminders.
        </div>
      ) : null}

      <section aria-label="Accountability" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Accountability</DashboardSectionLabel>
        <div className={`mt-3 ${devNeu.kpiStrip}`}>
          <DevStatRow>
            <DevStatInline label="Total" value={loading ? "…" : (stats?.total ?? 0)} hint="In this period" tone="sky" />
            <DevStatInline label="Done" value={loading ? "…" : (stats?.completed ?? 0)} hint="Completed" tone="emerald" />
            <DevStatInline label="Pending" value={loading ? "…" : (stats?.pending ?? 0)} hint="Still open" tone="amber" />
            <DevStatInline label="Period" value={periodLabel} hint="Review window" tone="violet" />
          </DevStatRow>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Review period</p>
          <nav className="mt-2 flex flex-wrap gap-2" aria-label="Review period">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onPeriodChange(p.value)}
                className={`${pillClass(period === p.value)} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Show</p>
          <nav className="mt-2 flex flex-wrap gap-2" aria-label="Completion filter">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => onCompletedFilterChange(f.value)}
                className={`${pillClass(completedFilter === f.value)} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
              >
                {f.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <section aria-label="Schedule items" className="flex min-h-0 w-full flex-1 flex-col">
        <div className="mb-3 flex items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>{periodLabel}</DashboardSectionLabel>
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${list.length} item${list.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {!items ? (
          <DevNeuPanel inset className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500">
            Loading your schedule…
          </DevNeuPanel>
        ) : list.length === 0 ? (
          <DevNeuPanel inset className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center">
            <p className="font-display text-lg font-semibold text-slate-200">Nothing scheduled in this period</p>
            <p className="max-w-sm text-sm text-slate-500">Add meetings, calls, reports, or tasks to stay accountable.</p>
            <button type="button" onClick={onAddOpen} className={devNeu.btnPrimary}>
              Add your first item
            </button>
          </DevNeuPanel>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((item) => {
              const meta = typeMeta(item.type);
              const done = !!item.completedAt;
              return (
                <li key={item.id} className={`${devNeu.panel} ${done ? "opacity-75" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/25 text-base font-semibold ${typeAccent(meta.tone)}`}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`font-display text-base font-semibold text-slate-100 ${done ? "line-through text-slate-500" : ""}`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          <span className={`font-medium ${typeAccent(meta.tone)}`}>{meta.label}</span>
                          {" · "}
                          {formatNairobiDateTime(item.scheduledAt)}
                          {item.reminderMinutesBefore != null ? (
                            <span className="text-violet-400"> · Reminder {item.reminderMinutesBefore}m before</span>
                          ) : null}
                        </p>
                        {item.notes ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.notes}</p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleDone(item)}
                      disabled={togglingId === item.id}
                      className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${
                        done
                          ? `${devNeu.navIdle} text-slate-300`
                          : "bg-emerald-600/90 text-white shadow-[0_4px_14px_rgba(16,185,129,0.25)] hover:bg-emerald-500"
                      }`}
                    >
                      {togglingId === item.id ? "…" : done ? "Undo" : "Mark done"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-schedule-add-title"
        >
          <div className={`${devNeu.panel} w-full max-w-lg`}>
            <h3 id="dev-schedule-add-title" className="font-display text-xl font-bold text-violet-200">
              Schedule something
            </h3>
            <p className="mt-1 text-sm text-slate-400">Meetings, calls, reports, and tasks — optional reminders.</p>
            <form onSubmit={onSubmitAdd} className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => onFormChange({ title: e.target.value })}
                  placeholder="Team standup, client call, daily report…"
                  className="developer-neu w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-slate-100 placeholder:text-slate-600"
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => onFormChange({ type: e.target.value })}
                    className="developer-neu w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-slate-100"
                  >
                    {types.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">When (Nairobi)</span>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => onFormChange({ scheduledAt: e.target.value })}
                    className="developer-neu w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-slate-100"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Remind me</span>
                <select
                  value={form.reminderMinutesBefore === "" ? "" : form.reminderMinutesBefore}
                  onChange={(e) =>
                    onFormChange({
                      reminderMinutesBefore: e.target.value === "" ? "" : Number(e.target.value)
                    })
                  }
                  className="developer-neu w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-slate-100"
                >
                  {REMINDER_OPTIONS.map((r) => (
                    <option key={r.value === "" ? "none" : r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => onFormChange({ notes: e.target.value })}
                  rows={3}
                  className="developer-neu w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-slate-100"
                />
              </label>
              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <button type="submit" disabled={submitting} className={devNeu.btnPrimary}>
                  {submitting ? "Adding…" : "Add to schedule"}
                </button>
                <button
                  type="button"
                  onClick={onAddClose}
                  className={`${devNeu.navIdle} rounded-lg px-4 py-2 text-sm text-slate-300`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
