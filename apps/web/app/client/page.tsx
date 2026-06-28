"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";
import { clientNeu } from "../../components/client/client-theme";

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
  if (status === "in_progress") return "text-teal-400";
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

  const displayName = auth.userName ?? auth.userEmail ?? "there";

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6">
      <header className={`${clientNeu.panel} border-teal-500/15`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/80">Client portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Welcome, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Live delivery progress on projects linked to your account — milestones, tasks, and payment received.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl border border-white/[0.08] bg-[#101820] px-3 py-2 text-sm text-slate-200 hover:text-white"
        >
          Refresh
        </button>
      </header>

      {loadError && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{loadError}</p>
      )}

      {loading && !loadError && <p className="text-sm text-slate-500">Loading your projects…</p>}

      {!loading && !loadError && projects.length === 0 && (
        <div className={`${clientNeu.panelInset} text-sm text-slate-400`}>
          No projects are linked to your email yet. Ask your account manager to connect your CRM client record to a
          project.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {projects.map((project) => {
          const price = project.price != null ? Number(project.price) : null;
          const received = project.amountReceived != null ? Number(project.amountReceived) : 0;
          return (
            <article key={project.id} className={clientNeu.panel}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{project.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {statusLabel(project.status)}
                    {project.financeProjectSeq != null ? ` · Project #${project.financeProjectSeq}` : ""}
                  </p>
                </div>
                {price != null && (
                  <div className="text-right text-sm text-slate-400">
                    <p className="font-medium text-teal-300">{formatMoney(received)} received</p>
                    {price > 0 ? <p className="text-xs text-slate-500">of {formatMoney(price)}</p> : null}
                  </div>
                )}
              </div>

              <div className={`mt-5 ${clientNeu.panelInset}`}>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Overall progress</span>
                  <span className="text-lg font-bold tabular-nums text-teal-300">{project.progressPercent}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, project.progressPercent))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {project.doneTasks} of {project.taskCount} tasks complete
                </p>
              </div>

              {project.milestones.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Milestones</h3>
                  <ul className="mt-3 space-y-2">
                    {project.milestones.map((m) => (
                      <li key={m.id} className={`${clientNeu.listRow} flex flex-wrap items-center justify-between gap-2 text-sm`}>
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

              <Link
                href="/community"
                className="mt-4 inline-block text-sm font-medium text-teal-400 hover:text-teal-300"
              >
                Message your project team →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
