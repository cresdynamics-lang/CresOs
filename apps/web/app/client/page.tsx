"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { formatMoney } from "../format-money";

type ClientMilestone = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
};

type ClientProject = {
  id: string;
  name: string;
  status: string;
  price: number | string | null;
  amountReceived: number | string | null;
  financeProjectSeq: number | null;
  taskCount: number;
  doneTasks: number;
  progressPercent: number;
  milestones: ClientMilestone[];
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "In progress",
    completed: "Completed",
    on_hold: "On hold",
    planning: "Planning",
    demo: "Demo"
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function milestoneStatusClass(status: string): string {
  if (status === "completed") return "text-emerald-400";
  if (status === "in_progress") return "text-sky-400";
  if (status === "rejected") return "text-rose-400";
  return "text-slate-400";
}

export default function ClientPortalPage() {
  const { apiFetch, auth } = useAuth();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch("/client/projects");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(body.error ?? "Could not load your projects");
        setProjects([]);
        return;
      }
      setProjects((await res.json()) as ClientProject[]);
    } catch {
      setLoadError("Could not reach the server.");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-8 px-3 py-4 sm:px-6 sm:py-5">
      <WorkspaceDashboardIntro
        title="My projects"
        description="Live delivery progress on work linked to your account."
        eyebrow="Client"
        showWelcomeBanner
        welcomeChildren={
          <>
            <DashboardSectionLabel roleKeys={auth.roleKeys}>
              Today&apos;s priorities (your queue)
            </DashboardSectionLabel>
            <p className="font-body text-sm leading-relaxed text-slate-400">
              Track milestone and task progress below. Contact your project lead through Community if you need an
              update.
            </p>
          </>
        }
      />

      {loadError && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </p>
      )}

      {loading && !loadError && <p className="text-sm text-slate-500">Loading projects…</p>}

      {!loading && !loadError && projects.length === 0 && (
        <p className="text-sm text-slate-400">
          No projects are linked to your email yet. Ask your account manager to connect your CRM client record and
          project.
        </p>
      )}

      <div className="flex flex-col gap-8">
        {projects.map((project) => {
          const price = project.price != null ? Number(project.price) : null;
          const received = project.amountReceived != null ? Number(project.amountReceived) : 0;
          return (
            <article key={project.id} className="border-b border-white/[0.06] pb-8 last:border-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{project.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {statusLabel(project.status)}
                    {project.financeProjectSeq != null ? ` · Project #${project.financeProjectSeq}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-400">
                  {price != null ? (
                    <>
                      <p>
                        {formatMoney(received)} received
                        {price > 0 ? ` of ${formatMoney(price)}` : ""}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Overall progress</span>
                  <span className="font-medium text-slate-300">{project.progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, project.progressPercent))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  {project.doneTasks} of {project.taskCount} tasks complete
                </p>
              </div>

              {project.milestones.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Milestones</h3>
                  <ul className="mt-3 space-y-2">
                    {project.milestones.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] py-2 text-sm last:border-0"
                      >
                        <span className="text-slate-200">{m.name}</span>
                        <span className={`text-xs capitalize ${milestoneStatusClass(m.status)}`}>
                          {m.status.replace(/_/g, " ")}
                          {m.dueDate ? ` · ${new Date(m.dueDate).toLocaleDateString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
