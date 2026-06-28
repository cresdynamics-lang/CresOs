"use client";

import type { FormEvent } from "react";
import { useMemo } from "react";
import type { StatTone } from "../../components/stat-card";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { SalesNeuPanel, SalesStatInline, SalesStatRow } from "../../components/sales/sales-ui";
import { salesNeu } from "../../components/sales/sales-theme";
import { formatNairobiDateTime } from "../../lib/nairobi-datetime";
import type { ScheduleAttentionCopy } from "../../lib/schedule-access";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";
import { useAuth } from "../auth-context";
import type { ScheduleItemView, ScheduleStats } from "./developer-schedule-view";

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
  return active ? salesNeu.navActive : salesNeu.navIdle;
}

function typeAccent(tone: StatTone): string {
  if (tone === "sky") return "text-sky-400";
  if (tone === "emerald") return "text-emerald-400";
  if (tone === "violet") return "text-violet-400";
  if (tone === "amber") return "text-amber-400";
  if (tone === "rose") return "text-rose-400";
  return "text-brand";
}

type SalesScheduleViewProps = {
  period: Period;
  onPeriodChange: (p: Period) => void;
  completedFilter: "all" | "done" | "pending";
  onCompletedFilterChange: (f: "all" | "done" | "pending") => void;
  stats: ScheduleStats | null;
  items: ScheduleItemView[] | null;
  periodLabel: string;
  scopeOrg?: boolean;
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
  onFormChange: (patch: Partial<SalesScheduleViewProps["form"]>) => void;
  types: TypeMeta[];
  onSubmitAdd: (e: FormEvent) => void;
  submitting: boolean;
  onToggleDone: (item: ScheduleItemView) => void;
  togglingId: string | null;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
  typeMeta: (type: string) => TypeMeta;
  notificationDenied: boolean;
  attention: ScheduleAttentionCopy;
  scheduleDescription: string;
  showOrgToggle?: boolean;
  orgSchedule?: boolean;
  onOrgScheduleChange?: (next: boolean) => void;
};

export function SalesScheduleView({
  period,
  onPeriodChange,
  completedFilter,
  onCompletedFilterChange,
  stats,
  items,
  periodLabel,
  scopeOrg = false,
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
  onDelete,
  canDelete = false,
  typeMeta,
  notificationDenied,
  attention,
  scheduleDescription,
  showOrgToggle = false,
  orgSchedule = false,
  onOrgScheduleChange
}: SalesScheduleViewProps) {
  const { auth } = useAuth();
  const list = items ?? [];
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            Tasks & schedule
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {welcomeHeadline}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{scheduleDescription}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${salesNeu.navIdle} rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={onAddOpen} className={salesNeu.btnPrimary}>
            + Add item
          </button>
        </div>
      </header>

      <section aria-label="Priorities" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>{attention.sectionTitle}</DashboardSectionLabel>
        <SalesNeuPanel inset className="mt-3">
          <p className="text-sm leading-relaxed text-slate-300">{attention.summary}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {attention.bullets.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-amber-500" aria-hidden>
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </SalesNeuPanel>
      </section>

      {notificationDenied ? (
        <div className={`${salesNeu.alertWarning} px-4 py-3 text-sm text-amber-200 sm:px-5`}>
          Browser notifications are off — enable them so call and meeting reminders can alert you before they start.
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        All times use <span className="font-medium text-slate-400">Nairobi (EAT)</span> · Now{" "}
        <span className="font-medium text-amber-400/90">{nairobiNow}</span>
      </p>

      <section aria-label="Accountability" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Accountability</DashboardSectionLabel>
        <div className={`mt-3 ${salesNeu.kpiStrip}`}>
          <SalesStatRow>
            <SalesStatInline
              label="Total"
              value={loading ? "…" : (stats?.total ?? 0)}
              hint="Scheduled in period"
              tone="sky"
            />
            <SalesStatInline
              label="Done"
              value={loading ? "…" : (stats?.completed ?? 0)}
              hint="Completed"
              tone="emerald"
            />
            <SalesStatInline
              label="Pending"
              value={loading ? "…" : (stats?.pending ?? 0)}
              hint="Not done"
              tone="amber"
            />
            <SalesStatInline label="Period" value={periodLabel} hint="Review window" tone="violet" />
          </SalesStatRow>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">
            Review period
          </p>
          <p className="mt-1 text-xs text-slate-500">Pick the window you want to review and stay accountable.</p>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Review period">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onPeriodChange(p.value)}
                className={`${pillClass(period === p.value)} min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          {showOrgToggle && onOrgScheduleChange ? (
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-950/15 px-4 py-3 text-sm text-amber-100">
              <input
                type="checkbox"
                checked={orgSchedule}
                onChange={(e) => onOrgScheduleChange(e.target.checked)}
                className="h-4 w-4 rounded border-amber-600 text-amber-600 focus:ring-amber-500"
              />
              Show entire organization
            </label>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">Show</p>
          <p className="mt-1 text-xs text-slate-500">Filter the list by completion status.</p>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Completion filter">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => onCompletedFilterChange(f.value)}
                className={`${pillClass(completedFilter === f.value)} min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
              >
                {f.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <section aria-label="Schedule items" className="flex min-h-0 w-full flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>
            {periodLabel}
            {scopeOrg ? " · org-wide" : ""}
          </DashboardSectionLabel>
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${list.length} item${list.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {!items ? (
          <SalesNeuPanel inset className="flex min-h-[min(14rem,35vh)] items-center justify-center text-sm text-slate-500">
            Loading your schedule…
          </SalesNeuPanel>
        ) : list.length === 0 ? (
          <SalesNeuPanel inset className="flex min-h-[min(14rem,35vh)] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="font-display text-lg font-semibold text-slate-200">Nothing scheduled in this period</p>
            <p className="max-w-sm text-sm text-slate-500">
              Add meetings, calls, reports, or tasks to stay on top of client motion.
            </p>
            <button type="button" onClick={onAddOpen} className={salesNeu.btnPrimary}>
              Add your first item
            </button>
          </SalesNeuPanel>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((item) => {
              const meta = typeMeta(item.type);
              const done = !!item.completedAt;
              return (
                <li key={item.id} className={`${salesNeu.panel} ${done ? "opacity-75" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/25 text-base font-semibold sm:h-11 sm:w-11 ${typeAccent(meta.tone)}`}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`font-display text-base font-semibold text-slate-100 sm:text-lg ${done ? "line-through text-slate-500" : ""}`}
                        >
                          {item.title}
                        </p>
                        {item.user ? (
                          <p className="mt-0.5 text-xs text-amber-400/90">{item.user.name ?? item.user.email}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                          <span className={`font-medium ${typeAccent(meta.tone)}`}>{meta.label}</span>
                          {" · "}
                          {formatNairobiDateTime(item.scheduledAt)}
                          {item.reminderMinutesBefore != null ? (
                            <span className="text-amber-400/90">
                              {" "}
                              · Reminder {item.reminderMinutesBefore}m before
                            </span>
                          ) : null}
                        </p>
                        {item.notes ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">{item.notes}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleDone(item)}
                        disabled={togglingId === item.id}
                        className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-semibold touch-manipulation disabled:opacity-50 sm:text-sm ${
                          done
                            ? `${salesNeu.navIdle} text-slate-300`
                            : "bg-emerald-600/90 text-white shadow-[0_4px_14px_rgba(16,185,129,0.25)] hover:bg-emerald-500"
                        }`}
                      >
                        {togglingId === item.id ? "…" : done ? "Undo" : "Mark done"}
                      </button>
                      {canDelete && onDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className={`min-h-[40px] min-w-[40px] rounded-lg border border-rose-500/30 bg-rose-950/30 p-2 text-rose-300 hover:bg-rose-900/40`}
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
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sales-schedule-add-title"
        >
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={onAddClose} />
          <div className={`sales-neu relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl ${salesNeu.panel}`}>
            <h3 id="sales-schedule-add-title" className="font-display text-xl font-bold text-amber-200">
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
                  placeholder="Client call, demo, daily report…"
                  className={salesNeu.input}
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => onFormChange({ type: e.target.value })}
                    className={salesNeu.input}
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
                    className={salesNeu.input}
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
                  className={salesNeu.input}
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
                  className={salesNeu.input}
                />
              </label>
              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <button type="submit" disabled={submitting} className={salesNeu.btnPrimary}>
                  {submitting ? "Adding…" : "Add to schedule"}
                </button>
                <button type="button" onClick={onAddClose} className={salesNeu.btnGhost}>
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
