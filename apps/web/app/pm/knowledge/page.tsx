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

export function KnowledgePoolConsole({ variant = "pm" }: { variant?: "pm" | "admin" } = {}) {
  const { apiFetch, auth } = useAuth();
  const isAdminShell = variant === "admin";
  const canAccess = canAccessKnowledgePool(auth.roleKeys) || auth.roleKeys.includes("admin");
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
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searchAi, setSearchAi] = useState(false);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError(null);
    setSearchAnswer(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
        params.set("sinceDays", "0");
      }
      if (sourceFilter) params.set("sourceType", sourceFilter);

      const requests: Promise<Response>[] = [apiFetch(`/pm/knowledge?${params.toString()}`)];
      if (q.trim()) {
        requests.push(
          apiFetch("/pm/knowledge/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: q.trim() })
          })
        );
      }

      const [listRes, askRes] = await Promise.all(requests);

      if (!listRes.ok) {
        setError("Could not load knowledge pool");
        return;
      }
      const data = (await listRes.json()) as { stats: KnowledgeStats; chunks: KnowledgeChunk[] };
      setStats(data.stats);
      setChunks(data.chunks);

      if (askRes) {
        if (askRes.ok) {
          const askData = (await askRes.json()) as { answer: string; aiGenerated: boolean };
          setSearchAnswer(askData.answer);
          setSearchAi(askData.aiGenerated);
        } else if (data.chunks.length === 0) {
          setSearchAnswer("No matches yet. Try **Sync full history** to index team profiles, reports, and communications.");
        }
      } else {
        setSearchAnswer(null);
        setSearchAi(false);
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setSearching(false);
    }
  }, [apiFetch, q, sourceFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sourceFilter) params.set("sourceType", sourceFilter);
      const res = await apiFetch(`/pm/knowledge?${params.toString()}`);
      if (!res.ok) {
        setError("Could not load knowledge pool");
        return;
      }
      const data = (await res.json()) as { stats: KnowledgeStats; chunks: KnowledgeChunk[] };
      setStats(data.stats);
      setChunks(data.chunks);

      if (data.stats.total === 0) {
        await apiFetch("/pm/knowledge/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamOnly: true })
        });
        const refresh = await apiFetch(`/pm/knowledge?${params.toString()}`);
        if (refresh.ok) {
          const refreshed = (await refresh.json()) as { stats: KnowledgeStats; chunks: KnowledgeChunk[] };
          setStats(refreshed.stats);
          setChunks(refreshed.chunks);
        }
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, sourceFilter]);

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
      setSearchAnswer(null);
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

  if (!canAccess) {
    return (
      <p className="px-4 py-8 text-sm text-[#8B93A1]">
        You don’t have access to the knowledge data pool.
      </p>
    );
  }

  const panelInset = pmNeu.panelInset;
  const listRow = pmNeu.listRow;
  const btnPrimary = pmNeu.btnPrimary;
  const btnGhost = pmNeu.btnGhost;

  const feedBody = (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border border-[#E5E9EF] bg-white px-3 py-2 text-sm text-[#1A1D26]"
          placeholder="Search — developers, Wilson, project name, blockers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
        />
        <button type="button" className={btnPrimary} disabled={searching} onClick={() => void runSearch()}>
          {searching ? "Searching…" : "Search with AI"}
        </button>
        {sourceFilter ? (
          <button type="button" className={btnGhost} onClick={() => setSourceFilter("")}>
            Clear filter
          </button>
        ) : null}
      </div>
      {searchAnswer ? (
        <div className={`${panelInset} mb-4 whitespace-pre-wrap border border-teal-500/20 px-4 py-3 text-sm leading-relaxed text-[#1A1D26]`}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#2D5A5A]">
            {searchAi ? "AI answer from knowledge pool" : "Search summary"}
          </p>
          {searchAnswer}
        </div>
      ) : null}
      {error ? <p className="mb-3 text-sm text-[#C62828]">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#5B6472]">Loading knowledge…</p>
      ) : chunks.length === 0 ? (
        <p className="text-sm text-[#5B6472]">
          No knowledge indexed yet. Click <strong className="text-[#5B6472]">Sync full history</strong> to copy all
          existing actions, communications, and reports into the pool.
        </p>
      ) : (
        <ul className="space-y-2">
          {chunks.map((c) => (
            <li key={c.id} className={`${listRow} px-3 py-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-[#5B6472]">
                <span>
                  {c.kind} · {c.sourceType}
                </span>
                <span>{new Date(c.occurredAt).toLocaleString()}</span>
              </div>
              {c.title ? <p className="mt-1 text-sm font-medium text-[#1A1D26]">{c.title}</p> : null}
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#5B6472]">
                {c.content.length > 500 ? `${c.content.slice(0, 500)}…` : c.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const content = (
    <>
      {!isAdminShell ? (
        <PmPageHero
          eyebrow="CresOS intelligence"
          title="Knowledge pool"
          description="Searchable copy of every action, project update, dev/sales/director communication, report, and email — full org history."
          backHref="/pm"
          backLabel="PM overview"
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} disabled={syncing} onClick={() => void syncPool()}>
                {syncing ? "Indexing all data…" : "Sync full history"}
              </button>
              <button type="button" className={btnPrimary} disabled={loadingInsights} onClick={() => void loadInsights()}>
                {loadingInsights ? "Analyzing…" : "Refresh AI insights"}
              </button>
            </div>
          }
        />
      ) : (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight text-[#1A1D26]">Data pool</h2>
            <p className="mt-0.5 max-w-2xl font-body text-sm font-medium text-[#5B6472]">
              Searchable org history — actions, reports, messages, and AI insights.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} disabled={syncing} onClick={() => void syncPool()}>
              {syncing ? "Indexing…" : "Sync full history"}
            </button>
            <button type="button" className={btnPrimary} disabled={loadingInsights} onClick={() => void loadInsights()}>
              {loadingInsights ? "Analyzing…" : "Refresh AI insights"}
            </button>
          </div>
        </div>
      )}

      {stats ? (
        <div className={`mb-4 flex flex-wrap gap-3 ${isAdminShell ? "" : "mx-5 lg:mx-8"}`}>
          <div className={`${panelInset} min-w-[8rem] px-4 py-3`}>
            <p className="text-[10px] uppercase tracking-wide text-[#5B6472]">Total indexed</p>
            <p className="text-2xl font-bold tabular-nums text-[#2D5A5A]">{stats.total}</p>
          </div>
          <div className={`${panelInset} min-w-[8rem] px-4 py-3`}>
            <p className="text-[10px] uppercase tracking-wide text-[#5B6472]">Last 30 days</p>
            <p className="text-2xl font-bold tabular-nums text-[#1A1D26]">{stats.recent30Days}</p>
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
                    className={`${panelInset} min-w-[7rem] px-4 py-3 text-left transition ${
                      sourceFilter === source ? "ring-1 ring-teal-500/50" : ""
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-[#5B6472]">{source.replace(/_/g, " ")}</p>
                    <p className="text-lg font-semibold text-[#1A1D26]">{count}</p>
                  </button>
                ))
            : null}
        </div>
      ) : null}

      {insights ? (
        isAdminShell ? (
          <div className="mb-4">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B93A1]">
              {insightsAi ? "AI delivery intelligence" : "Delivery intelligence"}
            </p>
            <div className={`${panelInset} whitespace-pre-wrap text-sm leading-relaxed text-[#5B6472]`}>{insights}</div>
          </div>
        ) : (
          <PmSection label={insightsAi ? "AI delivery intelligence" : "Delivery intelligence"}>
            <div className={`${pmNeu.panelInset} whitespace-pre-wrap text-sm leading-relaxed text-[#5B6472]`}>{insights}</div>
          </PmSection>
        )
      ) : null}

      {isAdminShell ? (
        <div>
          <p className="mb-1 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B93A1]">
            Knowledge feed
          </p>
          <p className="mb-4 font-body text-xs font-medium text-[#5B6472]">
            Search across team profiles, tasks, messages, reports, CRM, emails, and platform actions.
          </p>
          {feedBody}
        </div>
      ) : (
        <PmSection
          label="Knowledge feed"
          description="Search across all indexed copies — team profiles, tasks, comments, messages, reports, CRM, emails, and platform actions."
        >
          {feedBody}
        </PmSection>
      )}
    </>
  );

  if (isAdminShell) {
    return <div className="flex min-h-0 w-full flex-col">{content}</div>;
  }

  return <PmFullscreenPage>{content}</PmFullscreenPage>;
}

export default function PmKnowledgePage() {
  return <KnowledgePoolConsole variant="pm" />;
}
