"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import {
  PmBanner,
  PmDataBlock,
  PmFullscreenPage,
  PmKpiBand,
  PmKpiCell,
  PmPageHero,
  PmSection
} from "../../components/pm/pm-shell";
import { PmSmartBriefPanel, type PmIntelligenceData } from "../../components/pm/pm-smart-brief";
import { PmHealthBadge } from "../../components/pm/pm-health-badge";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";

type Overview = {
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  overdueMilestones: number;
  pendingCheckIns: number;
  reportsToday: number;
};

export function PmOverviewDashboard() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [intel, setIntel] = useState<PmIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [intelLoading, setIntelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchSending, setBatchSending] = useState(false);

  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ovRes, intelRes] = await Promise.all([
        apiFetch("/pm/overview"),
        apiFetch("/pm/intelligence")
      ]);
      if (!ovRes.ok) throw new Error("Failed to load overview");
      setOverview((await ovRes.json()) as Overview);
      if (intelRes.ok) setIntel((await intelRes.json()) as PmIntelligenceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PM data");
    } finally {
      setLoading(false);
      setIntelLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  const sendDailyBatch = async () => {
    setBatchSending(true);
    try {
      const res = await apiFetch("/pm/check-ins/daily-batch", { method: "POST" });
      if (!res.ok) throw new Error("Batch send failed");
      await load();
    } catch {
      setError("Could not send daily check-ins");
    } finally {
      setBatchSending(false);
    }
  };

  if (!canAccess) return null;

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Project Management"
        title={welcomeHeadline}
        description="Smart delivery cockpit — health scores, AI briefs, agile recovery, and developer pulse without financial noise."
        actions={
          <>
            <button type="button" className={pmNeu.btnGhost} onClick={() => void load()}>
              Refresh intel
            </button>
            <button type="button" className={pmNeu.btnPrimary} disabled={batchSending} onClick={() => void sendDailyBatch()}>
              {batchSending ? "Sending…" : "Run daily check-ins"}
            </button>
          </>
        }
      />

      {error ? <PmBanner tone="warning" title={error} /> : null}

      <PmSmartBriefPanel data={intel} loading={intelLoading} />

      {overview ? (
        <PmKpiBand cols={5}>
          <PmKpiCell
            label="Org health"
            value={intel?.orgSummary.averageHealth ?? "—"}
            hint="Smart score"
            tone="teal"
          />
          <PmKpiCell label="Active projects" value={overview.activeProjects} hint={`${overview.totalProjects} total`} />
          <PmKpiCell label="Open tasks" value={overview.openTasks} tone="emerald" />
          <PmKpiCell label="Overdue milestones" value={overview.overdueMilestones} tone="amber" />
          <PmKpiCell label="Pending check-ins" value={overview.pendingCheckIns} tone="rose" />
        </PmKpiBand>
      ) : loading ? (
        <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">Loading delivery snapshot…</p>
      ) : null}

      {(intel?.orgSummary.criticalCount ?? 0) > 0 ? (
        <PmBanner
          tone="warning"
          title={`${intel!.orgSummary.criticalCount} project${intel!.orgSummary.criticalCount === 1 ? "" : "s"} in critical delivery state`}
          detail="Open priority queue items and run sprint recovery suggestions on each project."
          action={
            <Link href="/pm/projects" className={pmNeu.btnGhost}>
              Review projects
            </Link>
          }
        />
      ) : null}

      <PmSection label="Priority delivery queue" description="Sorted by health — lowest scores need you first.">
        <PmDataBlock>
          {intelLoading ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading priorities…</p>
          ) : (intel?.priorities ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">
              {intel?.orgSummary.averageHealth === 100
                ? "All projects look healthy. Keep check-ins flowing."
                : "No approved projects yet."}
            </p>
          ) : (
            (intel?.priorities ?? []).map((p) => (
              <Link key={p.projectId} href={`/pm/projects/${p.projectId}`} className={`${pmNeu.listRow} block`}>
                <div className="flex items-center gap-4">
                  <PmHealthBadge score={p.healthScore} riskLevel={p.riskLevel} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100">{p.projectName}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {p.recommendedActions[0] ?? p.signals[0]?.message}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </PmDataBlock>
      </PmSection>
    </PmFullscreenPage>
  );
}
