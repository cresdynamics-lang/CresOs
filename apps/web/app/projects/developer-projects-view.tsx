"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatMoney } from "../format-money";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { DevNeuPanel, DevStatInline, DevStatRow } from "../../components/developer/developer-ui";
import { devNeu } from "../../components/developer/developer-theme";
import { useAuth } from "../auth-context";

export type DeveloperProjectItem = {
  id: string;
  name: string;
  status: string;
  type?: string | null;
  clientOrOwnerName?: string | null;
  price?: number | null;
  approvalStatus?: string;
  taskSummary?: {
    not_started: number;
    in_progress: number;
    waiting_response: number;
    blocked: number;
    done: number;
  };
  milestoneSummary?: {
    total: number;
    completed: number;
    pending: number;
  };
  financeProjectSeq?: number | null;
  financeRefYear?: number | null;
};

function financeRef(project: DeveloperProjectItem): string {
  if (project.financeProjectSeq == null || project.financeRefYear == null) return "—";
  return `${String(project.financeProjectSeq).padStart(3, "0")}/${String(project.financeRefYear % 100).padStart(2, "0")}`;
}

function taskTotal(ts: DeveloperProjectItem["taskSummary"]): number {
  if (!ts) return 0;
  return ts.done + ts.in_progress + ts.waiting_response + ts.blocked + ts.not_started;
}

function progressPercent(project: DeveloperProjectItem): number {
  const ms = project.milestoneSummary;
  if (ms && ms.total > 0) return Math.round((ms.completed / ms.total) * 100);
  const ts = project.taskSummary;
  const total = taskTotal(ts);
  if (!ts || total === 0) return 0;
  return Math.round((ts.done / total) * 100);
}

function statusTone(status: string): "violet" | "emerald" | "amber" | "sky" | "rose" {
  if (status === "active") return "emerald";
  if (status === "completed") return "sky";
  if (status === "paused") return "amber";
  if (status === "cancelled") return "rose";
  return "violet";
}

function StatusBadge({ label, tone }: { label: string; tone: "violet" | "emerald" | "amber" | "sky" | "slate" | "rose" }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
        : tone === "sky"
          ? "border-sky-500/25 bg-sky-500/10 text-sky-300"
          : tone === "rose"
            ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
          : tone === "violet"
            ? "border-violet-500/25 bg-violet-500/10 text-violet-300"
            : "border-white/10 bg-white/[0.04] text-slate-400";
  return (
    <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function TaskChip({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span
      className={`rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1 text-[10px] font-medium tabular-nums ${tone ?? "text-slate-400"}`}
    >
      <span className="text-slate-500">{label}</span>{" "}
      <span className="text-slate-200">{value}</span>
    </span>
  );
}

type DeveloperProjectsViewProps = {
  projects: DeveloperProjectItem[];
  loading: boolean;
  onRefresh: () => void;
};

export function DeveloperProjectsView({ projects, loading, onRefresh }: DeveloperProjectsViewProps) {
  const { auth } = useAuth();

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === "active" || p.status === "planned").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const tasksDone = projects.reduce((s, p) => s + (p.taskSummary?.done ?? 0), 0);
    const tasksOpen = projects.reduce((s, p) => {
      const ts = p.taskSummary;
      if (!ts) return s;
      return s + ts.in_progress + ts.waiting_response + ts.blocked + ts.not_started;
    }, 0);
    const milestonesDone = projects.reduce((s, p) => s + (p.milestoneSummary?.completed ?? 0), 0);
    const milestonesTotal = projects.reduce((s, p) => s + (p.milestoneSummary?.total ?? 0), 0);
    const milestonePct =
      milestonesTotal > 0 ? Math.round((milestonesDone / milestonesTotal) * 100) : 0;
    return { total: projects.length, active, completed, tasksDone, tasksOpen, milestonesDone, milestonesTotal, milestonePct };
  }, [projects]);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/90">
            Delivery
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Projects</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Assigned delivery work only — accept invites when directors add you. Daily progress lives in{" "}
            <Link href="/developer-reports" className="font-medium text-violet-300 hover:underline">
              Developer reports
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${devNeu.navIdle} shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section aria-label="Project snapshot" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Your assignments</DashboardSectionLabel>
        <div className={`mt-3 ${devNeu.kpiStrip}`}>
          <DevStatRow>
            <DevStatInline label="Assigned" value={loading ? "…" : stats.total} hint="Projects on your queue" tone="violet" />
            <DevStatInline label="Active" value={loading ? "…" : stats.active} hint="Planned or in flight" tone="emerald" />
            <DevStatInline
              label="Milestones"
              value={loading ? "…" : stats.milestonesTotal > 0 ? `${stats.milestonePct}%` : "—"}
              hint={
                stats.milestonesTotal > 0
                  ? `${stats.milestonesDone} of ${stats.milestonesTotal} done`
                  : "No milestones yet"
              }
              tone="sky"
            />
            <DevStatInline label="Tasks done" value={loading ? "…" : stats.tasksDone} hint={`${stats.tasksOpen} open`} tone="amber" />
          </DevStatRow>
        </div>
      </section>

      <section aria-label="Project list" className="w-full flex-1">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>Project directory</DashboardSectionLabel>
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {projects.length === 0 && !loading ? (
          <DevNeuPanel inset className="text-center text-sm text-slate-500">
            No assigned projects yet. Accept an invite from your director to get started.
          </DevNeuPanel>
        ) : (
          <ul className="flex w-full flex-col gap-3">
            {projects.map((project) => {
              const ts = project.taskSummary;
              const pct = progressPercent(project);
              const ms = project.milestoneSummary;
              const ref = financeRef(project);
              return (
                <li key={project.id} className={devNeu.panel}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-display text-lg font-semibold text-violet-200 hover:text-violet-100 hover:underline"
                        >
                          {project.name}
                        </Link>
                        <StatusBadge label={ref} tone="slate" />
                        {project.type === "demo" ? (
                          <StatusBadge label="Demo" tone="violet" />
                        ) : project.type === "project" ? (
                          <StatusBadge label="Project" tone="sky" />
                        ) : null}
                        <StatusBadge label={project.status} tone={statusTone(project.status)} />
                        {project.approvalStatus === "approved" ? (
                          <StatusBadge label="Approved" tone="emerald" />
                        ) : project.approvalStatus === "pending_approval" ? (
                          <StatusBadge label="Pending" tone="amber" />
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {project.clientOrOwnerName ? (
                          <span>
                            Client <span className="text-slate-300">{project.clientOrOwnerName}</span>
                          </span>
                        ) : null}
                        {project.price != null && project.price > 0 ? (
                          <span>
                            Value <span className="text-emerald-400/90">{formatMoney(project.price)}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-3 sm:min-w-[14rem] lg:items-end">
                      {ts && project.approvalStatus === "approved" ? (
                        <div className={`flex flex-wrap gap-1.5 ${devNeu.panelInset}`}>
                          <TaskChip label="Done" value={ts.done} tone="text-emerald-400" />
                          <TaskChip label="IP" value={ts.in_progress} tone="text-violet-400" />
                          <TaskChip label="Wait" value={ts.waiting_response} tone="text-amber-400" />
                          <TaskChip label="Blk" value={ts.blocked} tone="text-rose-400" />
                          <TaskChip label="NS" value={ts.not_started} />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">Delivery metrics appear after approval.</p>
                      )}

                      <div className="flex w-full min-w-[12rem] flex-col gap-2 sm:max-w-xs lg:items-end">
                        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                          <span>{ms && ms.total > 0 ? "Milestones" : "Progress"}</span>
                          <span className="font-semibold text-violet-300">{pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-black/30 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.5)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all"
                            style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }}
                          />
                        </div>
                        <Link
                          href={`/projects/${project.id}`}
                          className={`${devNeu.btnPrimary} inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold sm:w-auto`}
                        >
                          Open project →
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
