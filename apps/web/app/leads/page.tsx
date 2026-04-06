"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { subscribeDataRefresh } from "../data-refresh";

type Lead = {
  id: string;
  title: string;
  status: string;
  approvalStatus: string;
  source?: string;
  client?: { id: string; name: string; email?: string | null; phone?: string | null };
  project?: { id: string; name: string };
  owner?: { id: string; name: string | null; email: string };
};

export default function LeadsPage() {
  const { apiFetch, auth, hydrated } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSource, setNewSource] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    if (!auth.accessToken) {
      setLeads([]);
      setLoadedOnce(true);
      return;
    }
    try {
      const res = await apiFetch("/crm/leads");
      const raw = await res.json().catch(() => null);
      if (res.ok && Array.isArray(raw)) {
        setLeads(raw);
      } else {
        setLeads([]);
      }
    } catch {
      setLeads([]);
    } finally {
      setLoadedOnce(true);
    }
  }, [apiFetch, auth.accessToken]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    void load();
  }, [hydrated, auth.accessToken, load]);

  useEffect(() => {
    const unsub = subscribeDataRefresh(() => {
      void load();
    });
    return unsub;
  }, [load]);

  useEffect(() => {
    // Load projects to tie leads to existing work
    (async () => {
      try {
        const res = await apiFetch("/projects");
        if (res.ok) {
          const data = (await res.json()) as { id: string; name: string; approvalStatus?: string }[];
          setProjects(data);
        }
      } catch {
        // ignore
      }
    })();
  }, [apiFetch]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    try {
      const res = await apiFetch("/crm/leads", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          projectId: selectedProjectId || undefined,
          source: newSource.trim() || undefined
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Failed to add lead");
        return;
      }
      setNewTitle("");
      setNewSource("");
      setSelectedProjectId("");
      setShowAdd(false);
      load();
    } catch {
      setError("Network error");
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-50">Leads</h2>
          <p className="text-sm text-slate-300">
            New projects automatically create or update a client and a linked lead (project name, phone, email). This list refreshes when projects change. Manual adds may require admin approval.
          </p>
        </div>
        {auth.roleKeys.some((r) => ["sales", "admin"].includes(r)) && (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {showAdd ? "Cancel" : "Add lead"}
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="shell flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Title *</span>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Project *</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="">No project yet</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Source</span>
            <input
              type="text"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="e.g. website, referral"
            />
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button type="submit" className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Add lead (pending approval)
          </button>
        </form>
      )}

      <div className="shell">
        {loadedOnce && leads.length === 0 ? (
          <p className="text-slate-400">No leads yet. Create or update a project with client details to generate one automatically.</p>
        ) : leads.length > 0 ? (
          <ul className="space-y-2">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 hover:border-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-100">{lead.title}</span>
                    {lead.source === "project" && (
                      <span className="ml-2 rounded bg-sky-900/50 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                        Project
                      </span>
                    )}
                    {lead.client && (
                      <p className="mt-1 text-xs text-slate-400">
                        Client: {lead.client.name}
                        {lead.client.phone ? ` · ${lead.client.phone}` : ""}
                        {lead.client.email ? ` · ${lead.client.email}` : ""}
                      </p>
                    )}
                    {lead.owner && (
                      <p className="mt-0.5 text-xs text-slate-500">Owner: {lead.owner.name ?? lead.owner.email}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2 text-xs">
                    {lead.project && (
                      <span className="text-slate-400">Project: {lead.project.name}</span>
                    )}
                    {lead.status === "closed" && !lead.project && (
                      <span className="rounded bg-rose-900/50 px-2 py-0.5 text-rose-200">Closed: link a project</span>
                    )}
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300">
                      {lead.status}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 ${
                        lead.approvalStatus === "approved"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : lead.approvalStatus === "rejected"
                            ? "bg-rose-900/60 text-rose-300"
                            : "bg-amber-900/60 text-amber-300"
                      }`}
                    >
                      {lead.approvalStatus === "pending_approval"
                        ? "Pending approval"
                        : lead.approvalStatus}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          !loadedOnce && <p className="text-slate-400">Loading…</p>
        )}
      </div>
    </section>
  );
}
