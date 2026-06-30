"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth-context";
import { pmNeu } from "../../../components/pm/pm-theme";
import { PmFullscreenPage, PmPageHero, PmSection } from "../../../components/pm/pm-shell";
import { canAccessKnowledgePool } from "../../../lib/is-pm-only";

type KnowledgeStats = {
  total: number;
  recent30Days: number;
  byKind: Record<string, number>;
  bySource?: Record<string, number>;
};

type KnowledgeChunk = {
  id: string;
  kind: string;
  sourceType: string;
  title: string | null;
  content: string;
  occurredAt: string;
  projectId: string | null;
};

export default function PmKnowledgePage() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessKnowledgePool(auth.roleKeys);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsAi, setInsightsAi] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
        params.set("sinceDays", "0");
      }
      if (sourceFilter) params.set("sourceType", sourceFilter);
      const res = await apiFetch(`/pm/knowledge?${params.toString()}`);
      if (!res.ok) {
        setError("Could not load knowledge pool");
        return;
      }
      const data = (await res.json()) as { stats: KnowledgeStats; chunks: KnowledgeChunk[] };
      setStats(data.stats);
      setChunks(data.chunks);
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, q, sourceFilter]);

  const loadInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const res = await apiFetch("/pm/knowledge/insights");
      if (res.ok) {
        const data = (await res.json()) as { insights: string; aiGenerated: boolean; stats: KnowledgeStats };
        setInsights(data.insights);
        setInsightsAi(data.aiGenerated);
        setStats(data.stats);
      }
    } finally {
      setLoadingInsights(false);
    }
  }, [apiFetch]);

  const syncPool = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await apiFetch("/pm/knowledge/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullHistory: true })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Sync failed");
        return;
      }
      await load();
      await loadInsights();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load, sourceFilter]);

  useEffect(() => {
    if (!canAccess) return;
    void loadInsights();
  }, [canAccess, loadInsights]);

  if (!canAccess) return null;

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="CresOS intelligence"
        title="Knowledge pool"
        description="Searchable copy of every action, project update, dev/sales/director communication, report, and email — full org history."
        backHref="/pm"
        backLabel="PM overview"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={pmNeu.btnGhost} disabled={syncing} onClick={() => void syncPool()}>
              {syncing ? "Indexing all data…" : "Sync full history"}
            </button>
            <button type="button" className={pmNeu.btnPrimary} disabled={loadingInsights} onClick={() => void loadInsights()}>
              {loadingInsights ? "Analyzing…" : "Refresh AI insights"}
            </button>
          </div>
        }
      />

      {stats ? (
        <div className="mx-5 mb-4 flex flex-wrap gap-3 lg:mx-8">
          <div className={`${pmNeu.panelInset} min-w-[8rem] px-4 py-3`}>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Total indexed</p>
            <p className="text-2xl font-bold tabular-nums text-teal-300">{stats.total}</p>
          </div>
          <div className={`${pmNeu.panelInset} min-w-[8rem] px-4 py-3`}>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Last 30 days</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{stats.recent30Days}</p>
          </div>
          {stats.bySource
            ? Object.entries(stats.bySource)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([source, count]) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => {
                      setSourceFilter((cur) => (cur === source ? "" : source));
                    }}
                    className={`${pmNeu.panelInset} min-w-[7rem] px-4 py-3 text-left transition ${
                      sourceFilter === source ? "ring-1 ring-teal-500/50" : ""
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{source.replace(/_/g, " ")}</p>
                    <p className="text-lg font-semibold text-slate-200">{count}</p>
                  </button>
                ))
            : null}
        </div>
      ) : null}

      {insights ? (
        <PmSection label={insightsAi ? "AI delivery intelligence" : "Delivery intelligence"}>
          <div className={`${pmNeu.panelInset} whitespace-pre-wrap text-sm leading-relaxed text-slate-300`}>{insights}</div>
        </PmSection>
      ) : null}

      <PmSection label="Knowledge feed" description="Search across all indexed copies — tasks, comments, messages, reports, CRM, emails, and platform actions.">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm text-slate-200"
            placeholder="Search anything — project name, dev update, client email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
          <button type="button" className={pmNeu.btnGhost} onClick={() => void load()}>
            Search all history
          </button>
          {sourceFilter ? (
            <button type="button" className={pmNeu.btnGhost} onClick={() => { setSourceFilter(""); }}>
              Clear filter
            </button>
          ) : null}
        </div>
        {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading knowledge…</p>
        ) : chunks.length === 0 ? (
          <p className="text-sm text-slate-500">
            No knowledge indexed yet. Click <strong className="text-slate-300">Sync full history</strong> to copy all existing actions, communications, and reports into the pool.
          </p>
        ) : (
          <ul className="space-y-2">
            {chunks.map((c) => (
              <li key={c.id} className={`${pmNeu.listRow} px-3 py-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                  <span>
                    {c.kind} · {c.sourceType}
                  </span>
                  <span>{new Date(c.occurredAt).toLocaleString()}</span>
                </div>
                {c.title ? <p className="mt-1 text-sm font-medium text-slate-100">{c.title}</p> : null}
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">
                  {c.content.length > 500 ? `${c.content.slice(0, 500)}…` : c.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PmSection>
    </PmFullscreenPage>
  );
}
