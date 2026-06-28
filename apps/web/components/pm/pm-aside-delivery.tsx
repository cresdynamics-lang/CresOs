"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../app/auth-context";
import { pmNeu } from "./pm-theme";

type IntelSummary = {
  orgSummary: { averageHealth: number; atRiskCount: number; overdueMilestones: number };
  priorities: { projectId: string; projectName: string; healthScore: number }[];
};

export function PmAsideDeliverySnapshot() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<IntelSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/pm/intelligence?brief=0");
      if (res.ok) setData((await res.json()) as IntelSummary);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!data) return null;

  const top = data.priorities[0];

  return (
    <div className={`${pmNeu.panelInset} mx-1 mb-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Smart pulse</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-teal-300">{data.orgSummary.averageHealth}</p>
          <p className="text-[10px] text-slate-500">Health avg</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-300">{data.orgSummary.atRiskCount}</p>
          <p className="text-[10px] text-slate-500">At risk</p>
        </div>
      </div>
      {top ? (
        <Link
          href={`/pm/projects/${top.projectId}`}
          className="mt-2 block text-center text-[11px] text-teal-400 hover:text-teal-300"
        >
          Focus: {top.projectName} ({top.healthScore})
        </Link>
      ) : null}
    </div>
  );
}
