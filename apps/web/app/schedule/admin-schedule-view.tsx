"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo } from "react";
import { adminAccents, adminNeu, type AdminAccent } from "../../components/admin/admin-theme";
import { AdminStatInline, AdminStatRow } from "../../components/admin/admin-ui";
import { formatNairobiDateTime } from "../../lib/nairobi-datetime";
import type { ScheduleAttentionCopy } from "../../lib/schedule-access";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";
import { useAuth } from "../auth-context";
import type { ScheduleItemView, ScheduleStats } from "./developer-schedule-view";
import type { StatTone } from "../../components/stat-card";

type Period = "day" | "week" | "month" | "quarter";

type TypeMeta = { value: string; label: string; tone: StatTone; icon: string };

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" }
];

const FILTER_OPTIONS: { value: "all" | "done" | "pending"; label: string; accent: AdminAccent }[] = [
  { value: "all", label: "All", accent: "blue" },
  { value: "pending", label: "Pending", accent: "yellow" },
  { value: "done", label: "Done", accent: "green" }
];

const REMINDER_OPTIONS: { value: number | ""; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: 5, label: "5 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" }
];

function toneAccent(tone: StatTone): AdminAccent {
  if (tone === "emerald") return "green";
  if (tone === "amber") return "yellow";
  if (tone === "rose") return "red";
  if (tone === "violet") return "purple";
  if (tone === "brand") return "blue";
  return "blue";
}

function PeriodPills({
  value,
  onChange
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIODS.map((p, i) => {
        const accents: AdminAccent[] = ["blue", "green", "yellow", "red"];
        const a = adminAccents[accents[i % accents.length]];
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className="rounded-md px-3 py-1.5 font-body text-[12px] font-semibold transition"
            style={
              active
                ? { backgroundColor: a.solid, color: "#fff", border: `1px solid ${a.solid}` }
                : { backgroundColor: "#fff", color: "#242424", border: `1px solid ${a.border}` }
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  description,
  accent,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  accent: AdminAccent;
  children: ReactNode;
  className?: string;
}) {
  const a = adminAccents[accent];
  return (
    <section
      className={`relative overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5 ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: a.solid }} aria-hidden />
      <h3 className="font-body text-[13px] font-semibold tracking-tight" style={{ color: a.solid }}>
        {title}
      </h3>
      {description ? (
        <p className="mt-0.5 font-body text-[12px] font-medium text-[#8A8886]">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

type AdminScheduleViewProps = {
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
  onFormChange: (patch: Partial<AdminScheduleViewProps["form"]>) => void;
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

export function AdminScheduleView({
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
}: AdminScheduleViewProps) {
  const { auth } = useAuth();
  const list = items ?? [];
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5 bg-white pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E1DFDD] pb-4">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[11px] font-semibold tracking-wide text-[#8A8886]">Tasks & schedule</p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-[#242424]">
            {welcomeHeadline}
          </h1>
          <p className="mt-1 max-w-2xl font-body text-[13px] font-medium leading-relaxed text-[#605E5C]">
            {scheduleDescription}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${adminNeu.btnGhost} !px-3 !py-1.5 !text-[12px] disabled:opacity-50`}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={onAddOpen} className={`${adminNeu.btnPrimary} !py-1.5 !text-[12px]`}>
            + Add item
          </button>
        </div>
      </header>

      <Panel title={attention.sectionTitle} accent="blue" description={attention.summary}>
        <ul className="space-y-1.5 font-body text-[13px] text-[#605E5C]">
          {attention.bullets.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#005CAB]" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {notificationDenied ? (
        <div
          className="rounded-lg border border-l-4 bg-white px-4 py-3 font-body text-[13px] text-[#8A7000]"
          style={{ borderColor: "#E8D48A", borderLeftColor: "#C19C00" }}
        >
          Browser notifications are off — enable them so reminders can alert you before items start.
        </div>
      ) : null}

      <p className="font-body text-[12px] font-medium text-[#8A8886]">
        Times use <span className="text-[#242424]">Nairobi (EAT)</span> · Now{" "}
        <span className="font-semibold text-[#005CAB]">{nairobiNow}</span>
      </p>

      <Panel title="Review period" accent="blue" description="Pick the window you want to review.">
        <PeriodPills value={period} onChange={onPeriodChange} />
        {showOrgToggle && onOrgScheduleChange ? (
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-[#E1DFDD] bg-white px-3 py-2.5 font-body text-[13px] text-[#242424]">
            <input
              type="checkbox"
              checked={orgSchedule}
              onChange={(e) => onOrgScheduleChange(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D1D1] text-[#005CAB] focus:ring-[#005CAB]"
            />
            Show entire organization (team meetings)
          </label>
        ) : null}
      </Panel>

      <section aria-label="Accountability">
        <p className="mb-3 font-body text-[13px] font-semibold text-[#242424]">Stats</p>
        <AdminStatRow className="!grid-cols-3 lg:!grid-cols-3">
          <AdminStatInline
            label="Total"
            value={loading ? "…" : (stats?.total ?? 0)}
            hint="Scheduled in period"
            tone="sky"
          />
          <AdminStatInline
            label="Done"
            value={loading ? "…" : (stats?.completed ?? 0)}
            hint="Completed"
            tone="emerald"
          />
          <AdminStatInline
            label="Pending"
            value={loading ? "…" : (stats?.pending ?? 0)}
            hint="Not done"
            tone="amber"
          />
        </AdminStatRow>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Panel title="Show" accent="yellow" description="Filter by status">
          <div className="flex flex-col gap-2">
            {FILTER_OPTIONS.map((f) => {
              const a = adminAccents[f.accent];
              const active = completedFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => onCompletedFilterChange(f.value)}
                  className="rounded-md px-3 py-2 text-left font-body text-[12px] font-semibold"
                  style={
                    active
                      ? { backgroundColor: a.solid, color: "#fff" }
                      : { backgroundColor: "#fff", color: "#242424", border: `1px solid ${a.border}` }
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title={`${periodLabel}${scopeOrg ? " · org-wide" : ""}`}
          accent="green"
          description={`${list.length} item${list.length === 1 ? "" : "s"} in this period`}
          className="min-h-[min(22rem,50vh)]"
        >
          {loading && list.length === 0 ? (
            <p className="py-12 text-center font-body text-sm text-[#8A8886]">Loading your schedule…</p>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="font-display text-lg font-semibold text-[#242424]">No items in this period</p>
              <p className="mt-1 max-w-sm font-body text-[13px] text-[#8A8886]">
                Add meetings, calls, reports, or tasks to stay on track.
              </p>
              <button
                type="button"
                onClick={onAddOpen}
                className={`${adminNeu.btnPrimary} mt-4 !py-2 !text-[12px]`}
              >
                Add your first item
              </button>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {list.map((item) => {
                const meta = typeMeta(item.type);
                const a = adminAccents[toneAccent(meta.tone)];
                const done = !!item.completedAt;
                return (
                  <li
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-3.5 py-3 ${done ? "opacity-70" : ""}`}
                    style={{ borderColor: a.border, borderLeftWidth: 4, borderLeftColor: a.solid }}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                        style={{ backgroundColor: a.solid }}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-body text-[14px] font-semibold text-[#242424] ${done ? "line-through text-[#8A8886]" : ""}`}
                        >
                          {item.title}
                        </p>
                        {item.user ? (
                          <p className="mt-0.5 font-body text-[11px] font-medium" style={{ color: a.solid }}>
                            {item.user.name ?? item.user.email}
                          </p>
                        ) : null}
                        <p className="mt-1 font-body text-[11px] text-[#8A8886]">
                          <span className="font-semibold text-[#605E5C]">{meta.label}</span>
                          {" · "}
                          {formatNairobiDateTime(item.scheduledAt)}
                          {item.reminderMinutesBefore != null ? (
                            <span> · Reminder {item.reminderMinutesBefore} min</span>
                          ) : null}
                        </p>
                        {item.notes ? (
                          <p className="mt-1 font-body text-[12px] leading-relaxed text-[#605E5C]">{item.notes}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleDone(item)}
                        disabled={togglingId === item.id}
                        className="rounded-md px-3 py-1.5 font-body text-[11px] font-semibold text-white disabled:opacity-50"
                        style={{
                          backgroundColor: done ? "#605E5C" : adminAccents.green.solid
                        }}
                      >
                        {togglingId === item.id ? "…" : done ? "Undo" : "Mark done"}
                      </button>
                      {canDelete && onDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="rounded-md p-2 text-white"
                          style={{ backgroundColor: adminAccents.red.solid }}
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
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A1D26]/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-schedule-add-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-[#E1DFDD] bg-white shadow-[0_6.4px_14.4px_rgba(0,0,0,0.13)]">
            <div className="border-b border-[#E1DFDD] px-5 py-3.5" style={{ borderTop: `3px solid ${adminAccents.blue.solid}` }}>
              <h3 id="admin-schedule-add-title" className="font-body text-[15px] font-semibold text-[#242424]">
                Schedule something
              </h3>
              <p className="mt-0.5 font-body text-[12px] text-[#8A8886]">
                Meetings, calls, reports, and tasks — with optional reminders.
              </p>
            </div>
            <form onSubmit={onSubmitAdd} className="flex flex-col gap-3.5 px-5 py-4">
              <label className="flex flex-col gap-1">
                <span className="font-label text-[11px] font-semibold text-[#605E5C]">Title *</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => onFormChange({ title: e.target.value })}
                  placeholder="e.g. Call client X"
                  className={adminNeu.input}
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="font-label text-[11px] font-semibold text-[#605E5C]">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => onFormChange({ type: e.target.value })}
                    className={adminNeu.input}
                  >
                    {types.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label text-[11px] font-semibold text-[#605E5C]">When (Nairobi)</span>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => onFormChange({ scheduledAt: e.target.value })}
                    className={adminNeu.input}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-label text-[11px] font-semibold text-[#605E5C]">Remind me before</span>
                <select
                  value={form.reminderMinutesBefore === "" ? "" : form.reminderMinutesBefore}
                  onChange={(e) =>
                    onFormChange({
                      reminderMinutesBefore: e.target.value === "" ? "" : Number(e.target.value)
                    })
                  }
                  className={adminNeu.input}
                >
                  {REMINDER_OPTIONS.map((r) => (
                    <option key={r.value === "" ? "none" : r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-[11px] font-semibold text-[#605E5C]">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => onFormChange({ notes: e.target.value })}
                  rows={3}
                  className={adminNeu.input}
                />
              </label>
              <div className="flex flex-wrap gap-2 border-t border-[#E1DFDD] pt-3">
                <button type="submit" disabled={submitting} className={adminNeu.btnPrimary}>
                  {submitting ? "Adding…" : "Add to schedule"}
                </button>
                <button type="button" onClick={onAddClose} className={adminNeu.btnGhost}>
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
