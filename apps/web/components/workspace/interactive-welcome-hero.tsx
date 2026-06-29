"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { resolveRoleTheme } from "../dashboard-welcome-banner";
import { dashboardNeu } from "../dashboard/dashboard-theme";
import {
  dismissCompanionNudge,
  formatActiveDuration,
  initWorkspaceActiveTimeTracker,
  isCompanionNudgeDismissed,
  mergedActiveMinutes
} from "../../lib/workspace-active-time";
import { buildEngagingWelcomeMessage } from "../../lib/engaging-welcome";

export type CompanionNudge = {
  id: string;
  kind: "break" | "work" | "wellness" | "celebration" | "tip";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  dismissKey?: string;
};

export type WorkspaceCompanionData = {
  firstName: string;
  sessionStartedAt: string;
  serverSessionMinutes: number;
  work: {
    pendingCheckIns: number;
    criticalProjects: number;
    atRiskProjects: number;
    overdueMilestones: number;
    reportsToday: number;
    openTasks: number;
    orgHealth: number;
    activeProjects: number;
  };
  companionLine: string;
  nudges: CompanionNudge[];
  aiLine: string | null;
  aiGenerated: boolean;
};

const NUDGE_SHELL: Record<CompanionNudge["kind"], string> = {
  break: "border-violet-500/35 bg-gradient-to-br from-violet-950/40 via-[#141a22] to-[#0e1319]",
  work: "border-rose-500/35 bg-gradient-to-br from-rose-950/40 via-[#141a22] to-[#0e1319]",
  wellness: "border-cyan-400/35 bg-gradient-to-br from-cyan-950/35 via-[#141a22] to-[#0e1319]",
  celebration: "border-emerald-400/35 bg-gradient-to-br from-emerald-950/35 via-[#141a22] to-[#0e1319]",
  tip: "border-teal-400/35 bg-gradient-to-br from-teal-950/30 via-[#141a22] to-[#0e1319]"
};

type InteractiveWelcomeHeroProps = {
  roleKeys: string[];
  roleLabel: string;
  companion: WorkspaceCompanionData | null;
  loading?: boolean;
  queueEmpty?: React.ReactNode;
  children?: React.ReactNode;
};

export function InteractiveWelcomeHero({
  roleKeys,
  roleLabel,
  companion,
  loading,
  queueEmpty,
  children
}: InteractiveWelcomeHeroProps) {
  const theme = resolveRoleTheme(roleKeys);
  const [activeMinutes, setActiveMinutes] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const cleanup = initWorkspaceActiveTimeTracker();
    const tick = () => setActiveMinutes(mergedActiveMinutes(companion?.serverSessionMinutes ?? 0));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearInterval(id);
      cleanup();
    };
  }, [companion?.serverSessionMinutes]);

  const firstName = companion?.firstName ?? "there";
  const sessionMinutes = Math.max(activeMinutes, companion?.serverSessionMinutes ?? 0);

  const welcomeLine = useMemo(() => {
    if (loading) return null;
    if (!companion) return `Hope you're having a great morning, ${firstName}.`;
    return buildEngagingWelcomeMessage({
      firstName,
      activeMinutes: sessionMinutes,
      pendingCheckIns: companion.work.pendingCheckIns,
      criticalProjects: companion.work.criticalProjects,
      overdueMilestones: companion.work.overdueMilestones,
      openTasks: companion.work.openTasks,
      orgHealth: companion.work.orgHealth,
      activeProjects: companion.work.activeProjects,
      reportsToday: companion.work.reportsToday
    });
  }, [loading, companion, firstName, sessionMinutes]);

  const visibleNudges = useMemo(() => {
    if (!companion) return [];
    return companion.nudges.filter((n) => {
      if (dismissedIds.has(n.id)) return false;
      if (n.dismissKey && isCompanionNudgeDismissed(n.dismissKey)) return false;
      return true;
    });
  }, [companion, dismissedIds]);

  const handleDismiss = useCallback((nudge: CompanionNudge) => {
    if (nudge.dismissKey) {
      const minutes = nudge.dismissKey.includes("emotional") ? 60 : 60;
      dismissCompanionNudge(nudge.dismissKey, minutes);
    }
    setDismissedIds((prev) => new Set(prev).add(nudge.id));
  }, []);

  const sessionBadge = formatActiveDuration(sessionMinutes);

  return (
    <div className={dashboardNeu.hero}>
      <div className={dashboardNeu.heroGlow} aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className={`font-display text-3xl font-bold leading-snug tracking-tight text-slate-50 sm:text-4xl lg:text-[2.75rem] lg:leading-tight`}
          >
            {loading ? (
              <span className="text-slate-500">Reading your workspace…</span>
            ) : (
              welcomeLine
            )}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-0.5 font-label text-[10px] font-semibold uppercase tracking-widest ${theme.rolePill}`}
            >
              {roleLabel}
            </span>
            {!loading ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-[#0e1319] px-3 py-1 text-[11px] text-slate-400 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4)]"
                title="Visible time in workspace this session"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Active {sessionBadge}
              </span>
            ) : null}
          </div>
        </div>
        {companion && !loading ? (
          <div className="hidden shrink-0 rounded-2xl border border-white/[0.05] bg-[#0e1319]/80 px-4 py-3 text-right shadow-[inset_3px_3px_8px_rgba(0,0,0,0.4)] sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Org health</p>
            <p className="font-display text-3xl font-bold tabular-nums text-teal-300">{companion.work.orgHealth}</p>
            <p className="text-[10px] text-slate-500">{companion.work.activeProjects} active projects</p>
          </div>
        ) : null}
      </div>

      {visibleNudges.length > 0 ? (
        <ul className="relative mt-5 grid gap-2.5 sm:grid-cols-2">
          {visibleNudges.map((nudge) => (
            <li
              key={nudge.id}
              className={`rounded-xl border p-4 shadow-[4px_4px_14px_rgba(0,0,0,0.45)] ${NUDGE_SHELL[nudge.kind]}`}
            >
              <p className="font-display text-sm font-semibold text-slate-50">{nudge.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{nudge.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {nudge.actionHref && nudge.actionLabel ? (
                  <Link href={nudge.actionHref} className={`${dashboardNeu.btnPrimary} px-3 py-1.5 text-xs`}>
                    {nudge.actionLabel}
                  </Link>
                ) : null}
                {nudge.dismissKey ? (
                  <button type="button" onClick={() => handleDismiss(nudge)} className={dashboardNeu.btnGhost}>
                    {!nudge.actionHref && nudge.actionLabel ? nudge.actionLabel : "Dismiss"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {children ? (
        <div className="relative mt-6 border-t border-white/[0.1] pt-5">{children}</div>
      ) : null}
      {!children && queueEmpty ? (
        <div className="relative mt-6 border-t border-white/[0.1] pt-5">{queueEmpty}</div>
      ) : null}
    </div>
  );
}

export function usePmWorkspaceCompanion(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>,
  enabled: boolean
) {
  const [companion, setCompanion] = useState<WorkspaceCompanionData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/pm/companion");
      if (res.ok) setCompanion((await res.json()) as WorkspaceCompanionData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch, enabled]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  return { companion, loading, refresh: load };
}
