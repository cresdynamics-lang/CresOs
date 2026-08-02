"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { subscribeDataRefresh } from "../data-refresh";
import { adminNeu, adminAccents } from "../../components/admin/admin-theme";

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

function approvalStyle(status: string): { bg: string; color: string } {
  if (status === "approved") return { bg: "#0B6A0B", color: "#fff" };
  if (status === "rejected") return { bg: "#C50F1F", color: "#fff" };
  return { bg: "#C19C00", color: "#fff" };
}

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
    (async () => {
      try {
        const res = await apiFetch("/projects");
        if (res.ok) {
          const data = (await res.json()) as { id: string; name: string }[];
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
      void load();
    } catch {
      setError("Network error");
    }
  };

  const pending = leads.filter((l) => l.approvalStatus === "pending_approval").length;
  const approved = leads.filter((l) => l.approvalStatus === "approved").length;

  return (
    <section className="flex w-full min-w-0 flex-col gap-5 bg-white pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E1DFDD] pb-4">
        <div className="min-w-0">
          <p className="font-label text-[11px] font-semibold tracking-wide text-[#8A8886]">Leads</p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-[#242424]">Lead pipeline</h1>
          <p className="mt-1 max-w-2xl font-body text-[13px] font-medium leading-relaxed text-[#605E5C]">
            Project clients create leads automatically. Manual adds may need approval.
          </p>
        </div>
        {auth.roleKeys.some((r) => ["sales", "admin"].includes(r)) ? (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className={`${adminNeu.btnPrimary} !py-2 !text-[12px]`}
          >
            {showAdd ? "Cancel" : "+ Add lead"}
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          className="rounded-lg border bg-white p-3.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]"
          style={{ borderColor: adminAccents.blue.border, borderLeftWidth: 4, borderLeftColor: adminAccents.blue.solid }}
        >
          <p className="font-label text-[11px] font-semibold text-[#605E5C]">Total</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums" style={{ color: adminAccents.blue.solid }}>
            {loadedOnce ? leads.length : "…"}
          </p>
        </div>
        <div
          className="rounded-lg border bg-white p-3.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]"
          style={{
            borderColor: adminAccents.yellow.border,
            borderLeftWidth: 4,
            borderLeftColor: adminAccents.yellow.solid
          }}
        >
          <p className="font-label text-[11px] font-semibold text-[#605E5C]">Pending</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums" style={{ color: adminAccents.yellow.solid }}>
            {loadedOnce ? pending : "…"}
          </p>
        </div>
        <div
          className="rounded-lg border bg-white p-3.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]"
          style={{
            borderColor: adminAccents.green.border,
            borderLeftWidth: 4,
            borderLeftColor: adminAccents.green.solid
          }}
        >
          <p className="font-label text-[11px] font-semibold text-[#605E5C]">Approved</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums" style={{ color: adminAccents.green.solid }}>
            {loadedOnce ? approved : "…"}
          </p>
        </div>
      </div>

      {showAdd ? (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="relative overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-[#005CAB]" aria-hidden />
          <p className="font-body text-[13px] font-semibold text-[#005CAB]">Add lead</p>
          <div className="mt-3 flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block font-label text-[11px] font-semibold text-[#605E5C]">Title *</span>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={adminNeu.input}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-label text-[11px] font-semibold text-[#605E5C]">Project</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={adminNeu.input}
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
              <span className="mb-1 block font-label text-[11px] font-semibold text-[#605E5C]">Source</span>
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className={adminNeu.input}
                placeholder="e.g. website, referral"
              />
            </label>
            {error ? <p className="font-body text-sm text-[#C50F1F]">{error}</p> : null}
            <button type="submit" className={`${adminNeu.btnPrimary} w-fit`}>
              Add lead (pending approval)
            </button>
          </div>
        </form>
      ) : null}

      <div
        className="relative overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[#0B6A0B]" aria-hidden />
        <p className="font-body text-[13px] font-semibold text-[#0B6A0B]">All leads</p>
        <div className="mt-3">
          {!loadedOnce ? (
            <p className="py-8 text-center font-body text-sm text-[#8A8886]">Loading…</p>
          ) : leads.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-[#8A8886]">
              No leads yet. Create or update a project with client details to generate one.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {leads.map((lead) => {
                const appr = approvalStyle(lead.approvalStatus);
                return (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E1DFDD] bg-white px-3.5 py-3 transition hover:border-[#005CAB]/40"
                      style={{ borderLeftWidth: 4, borderLeftColor: appr.bg }}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-body text-[14px] font-semibold text-[#242424]">{lead.title}</span>
                        {lead.source === "project" ? (
                          <span
                            className="ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: adminAccents.blue.solid }}
                          >
                            Project
                          </span>
                        ) : null}
                        {lead.client ? (
                          <p className="mt-1 font-body text-[12px] text-[#605E5C]">
                            Client: {lead.client.name}
                            {lead.client.phone ? ` · ${lead.client.phone}` : ""}
                            {lead.client.email ? ` · ${lead.client.email}` : ""}
                          </p>
                        ) : null}
                        {lead.owner ? (
                          <p className="mt-0.5 font-body text-[11px] text-[#8A8886]">
                            Owner: {lead.owner.name ?? lead.owner.email}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 text-[11px]">
                        {lead.project ? (
                          <span className="font-medium text-[#605E5C]">Project: {lead.project.name}</span>
                        ) : null}
                        {lead.status === "closed" && !lead.project ? (
                          <span
                            className="rounded-md px-2 py-0.5 font-semibold text-white"
                            style={{ backgroundColor: adminAccents.red.solid }}
                          >
                            Closed: link a project
                          </span>
                        ) : null}
                        <span className="rounded-md border border-[#E1DFDD] bg-white px-2 py-0.5 font-semibold text-[#605E5C]">
                          {lead.status}
                        </span>
                        <span
                          className="rounded-md px-2 py-0.5 font-bold text-white"
                          style={{ backgroundColor: appr.bg, color: appr.color }}
                        >
                          {lead.approvalStatus === "pending_approval" ? "Pending approval" : lead.approvalStatus}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
