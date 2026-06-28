"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { AdminPanel } from "../../../components/admin/admin-ui";
import { adminNeu } from "../../../components/admin/admin-theme";

type PortalProject = {
  id: string;
  name: string;
  status: string;
  progressPercent: number;
  taskCount: number;
  doneTasks: number;
};

type PortalClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  hasPortalAccess: boolean;
  projectCount: number;
  projects: PortalProject[];
  portalUser: { id: string; name: string | null; email: string; lastLoginAt: string | null } | null;
  lastSession: {
    startedAt: string;
    lastSeenAt: string;
    ip: string | null;
    userAgent: string | null;
  } | null;
};

type PortalActivity = {
  id: string;
  type: string;
  summary: string;
  body: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};

type Overview = {
  stats: {
    totalClients: number;
    withPortalLogin: number;
    activeSessions: number;
    totalProjects: number;
  };
  clients: PortalClient[];
  recentActivity: PortalActivity[];
};

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AdminClientPortalPage() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/client/admin/overview");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not load client portal overview");
        setData(null);
        return;
      }
      const overview = (await res.json()) as Overview;
      setData(overview);
      setSelectedId((prev) => prev ?? overview.clients[0]?.id ?? null);
    } catch {
      setError("Could not reach the server.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => data?.clients.find((c) => c.id === selectedId) ?? data?.clients[0] ?? null,
    [data, selectedId]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <AdminPanel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">Client access</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">Client portal oversight</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              All CRM clients with portal-linked projects, login sessions, and activity — cross-check with{" "}
              <Link href="/activity" className="text-indigo-300 hover:text-indigo-200">
                Activity log
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className={adminNeu.btnGhost}>
              Refresh
            </button>
            <Link href="/crm" className={adminNeu.btnGhost}>
              CRM clients
            </Link>
          </div>
        </div>

        {data ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "CRM clients", value: data.stats.totalClients },
              { label: "Portal accounts", value: data.stats.withPortalLogin },
              { label: "Recent sessions", value: data.stats.activeSessions },
              { label: "Linked projects", value: data.stats.totalProjects }
            ].map((s) => (
              <div key={s.label} className={`${adminNeu.panelInset} text-center`}>
                <p className="text-2xl font-bold tabular-nums text-indigo-300">{s.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </AdminPanel>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}

      {loading && !data ? <p className="text-sm text-slate-500">Loading client portal data…</p> : null}

      {data ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_16rem]">
          <AdminPanel className="!p-0 flex max-h-[min(70vh,40rem)] flex-col overflow-hidden">
            <p className="shrink-0 border-b border-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              All clients
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {data.clients.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No clients in CRM yet.</p>
              ) : (
                data.clients.map((c) => {
                  const active = selected?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`flex w-full flex-col gap-1 border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                        active ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/20" : ""
                      }`}
                    >
                      <span className="truncate text-sm font-medium text-slate-200">{c.name}</span>
                      <span className="truncate text-xs text-slate-500">{c.email ?? "No email"}</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            c.hasPortalAccess
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-slate-700/50 text-slate-500"
                          }`}
                        >
                          {c.hasPortalAccess ? "Portal user" : "No login"}
                        </span>
                        <span className="text-[10px] text-slate-600">{c.projectCount} project{c.projectCount === 1 ? "" : "s"}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </AdminPanel>

          <AdminPanel className="min-h-[min(70vh,40rem)] overflow-y-auto">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a client to view portal details.</p>
            ) : (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{selected.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">{selected.email ?? "—"} · {selected.phone ?? "No phone"}</p>
                </div>

                <div className={`${adminNeu.panelInset} grid gap-3 sm:grid-cols-2`}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Portal account</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {selected.hasPortalAccess
                        ? selected.portalUser?.name ?? selected.portalUser?.email ?? "Yes"
                        : "Not provisioned — add client role user with matching email"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Last seen</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {fmtWhen(selected.lastSession?.lastSeenAt ?? selected.portalUser?.lastLoginAt)}
                    </p>
                    {selected.lastSession?.ip ? (
                      <p className="mt-0.5 text-xs text-slate-500">IP {selected.lastSession.ip}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Projects ({selected.projects.length})</h3>
                  {selected.projects.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No projects linked to this client.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {selected.projects.map((p) => (
                        <li key={p.id} className={`${adminNeu.listRow} flex flex-wrap items-center justify-between gap-2`}>
                          <div>
                            <p className="font-medium text-slate-200">{p.name}</p>
                            <p className="text-xs capitalize text-slate-500">{p.status.replace(/_/g, " ")}</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold text-indigo-300">{p.progressPercent}%</p>
                            <p className="text-xs text-slate-500">
                              {p.doneTasks}/{p.taskCount} tasks
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="text-xs text-slate-600">
                  Clients sign in at <code className="text-slate-400">/login</code> with CRM email and password (e.g.{" "}
                  <code className="text-slate-400">Acme1</code> for first-name + project #).
                </p>
              </div>
            )}
          </AdminPanel>

          <AdminPanel className="hidden max-h-[min(70vh,40rem)] flex-col overflow-hidden xl:flex !p-0">
            <p className="shrink-0 border-b border-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Portal logins
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500">No client portal logins recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className={`${adminNeu.listRow} text-xs`}>
                      <p className="font-medium text-slate-200">{a.summary}</p>
                      <p className="mt-1 text-slate-500">{fmtWhen(a.createdAt)}</p>
                      {a.body ? <p className="mt-1 line-clamp-2 text-slate-600">{a.body}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="shrink-0 border-t border-white/[0.06] p-3">
              <Link href="/activity" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">
                Full activity log →
              </Link>
            </div>
          </AdminPanel>
        </div>
      ) : null}
    </div>
  );
}
