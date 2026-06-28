"use client";

import Link from "next/link";
import { pmNeu } from "./pm-theme";
import { PmHealthBadge, type PmRiskLevel } from "./pm-health-badge";

export type PmIntelligenceData = {
  generatedAt: string;
  brief?: string;
  briefAiGenerated?: boolean;
  orgSummary: {
    averageHealth: number;
    atRiskCount: number;
    criticalCount: number;
    overdueMilestones: number;
    silentDevelopers: number;
  };
  priorities: {
    projectId: string;
    projectName: string;
    healthScore: number;
    riskLevel: PmRiskLevel;
    signals: { message: string; tone: string }[];
    recommendedActions: string[];
  }[];
};

export function PmSmartBriefPanel({ data, loading }: { data: PmIntelligenceData | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className={`${pmNeu.panelInset} mx-5 mb-6 animate-pulse lg:mx-8`}>
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="mt-3 h-16 rounded bg-white/5" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <section className="mx-5 mb-6 lg:mx-8">
      <div className={`${pmNeu.panel} border-teal-500/15 bg-gradient-to-br from-[#121820] to-teal-950/20`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/90">
              Smart delivery brief
              {data.briefAiGenerated ? (
                <span className="ml-2 rounded bg-teal-500/10 px-1.5 py-0.5 text-teal-300">AI</span>
              ) : null}
            </p>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {data.brief ?? "Loading delivery intelligence…"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Org health</p>
            <p className="font-display text-3xl font-bold text-teal-300">{data.orgSummary.averageHealth}</p>
            <p className="text-xs text-slate-500">/ 100 avg</p>
          </div>
        </div>

        {data.priorities.length > 0 ? (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Priority queue
            </p>
            <div className="space-y-2">
              {data.priorities.slice(0, 4).map((p) => (
                <Link
                  key={p.projectId}
                  href={`/pm/projects/${p.projectId}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[#0e1319]/80 px-3 py-2.5 transition-colors hover:border-teal-500/20 hover:bg-teal-950/10"
                >
                  <PmHealthBadge score={p.healthScore} riskLevel={p.riskLevel} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{p.projectName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {p.signals[0]?.message ?? p.recommendedActions[0]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
