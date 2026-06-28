"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmDataBlock, PmFullscreenPage, PmPageHero } from "../../components/pm/pm-shell";
import { PmHealthBadge, PmRiskPill, type PmRiskLevel } from "../../components/pm/pm-health-badge";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";

type PmProject = {
  id: string;
  name: string;
  status: string;
  successCriteria?: string | null;
  managementProgressPercent?: number | null;
  milestones?: { id: string; name: string; dueDate: string | null; status: string }[];
  _count?: { tasks: number };
};

type HealthRow = {
  projectId: string;
  projectName: string;
  healthScore: number;
  riskLevel: PmRiskLevel;
  overdueMilestones: number;
  openTasks: number;
  signals: { message: string }[];
};

export function PmProjectsConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, HealthRow>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [projRes, intelRes] = await Promise.all([
        apiFetch("/pm/projects"),
        apiFetch("/pm/intelligence?brief=0")
      ]);
      if (projRes.ok) setProjects((await projRes.json()) as PmProject[]);
      if (intelRes.ok) {
        const intel = (await intelRes.json()) as { projects: HealthRow[] };
        const map: Record<string, HealthRow> = {};
        for (const p of intel.projects ?? []) map[p.projectId] = p;
        setHealthMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const ha = healthMap[a.id]?.healthScore ?? 50;
      const hb = healthMap[b.id]?.healthScore ?? 50;
      return ha - hb;
    });
  }, [projects, healthMap]);

  if (!canAccess) return null;

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Projects"
        title="Smart project board"
        description="Ranked by delivery health — success criteria and milestones only, no owners or amounts."
        backHref="/pm"
      />

      <PmDataBlock>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">Loading projects…</p>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">No approved projects.</p>
        ) : (
          sorted.map((p) => {
            const h = healthMap[p.id];
            return (
              <Link key={p.id} href={`/pm/projects/${p.id}`} className={`${pmNeu.listRow} block`}>
                <div className="flex items-start gap-4">
                  {h ? (
                    <PmHealthBadge score={h.healthScore} riskLevel={h.riskLevel} size="sm" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-100">{p.name}</p>
                      {h ? <PmRiskPill riskLevel={h.riskLevel} /> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                      {p.successCriteria?.trim() || h?.signals[0]?.message || "Add success criteria"}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-600">
                      {h?.openTasks ?? p._count?.tasks ?? 0} open tasks · {h?.overdueMilestones ?? 0} overdue
                      {p.managementProgressPercent != null ? ` · ${p.managementProgressPercent}%` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs uppercase tracking-wide text-teal-400/80">{p.status}</span>
                </div>
              </Link>
            );
          })
        )}
      </PmDataBlock>
    </PmFullscreenPage>
  );
}
