"use client";

import Link from "next/link";
import { useAuth } from "../../app/auth-context";
import { hrNeu } from "./hr-theme";
import { buildHrAnalyticsSummary, computeTeamByRole } from "../../lib/hr-analytics";
import { useWorkforceAnalytics } from "../../lib/use-workforce-analytics";

/** Compact live workforce stats for the HR side panel (from database). */
export function HrAsideWorkforceSnapshot() {
  const { apiFetch } = useAuth();
  const { data, loading } = useWorkforceAnalytics(apiFetch, true);

  const employees = data?.employees ?? [];
  const summary = buildHrAnalyticsSummary(employees, data?.salaryExpenses ?? []);
  const topRoles = computeTeamByRole(employees).slice(0, 4);

  return (
    <div className={`mx-1 mb-4 ${hrNeu.sideGroup} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400/85">Live workforce</p>
        <Link href="/hr/analytics" className="text-[10px] font-medium text-rose-300/90 hover:text-rose-200">
          Charts →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AsideStat label="Org readiness" value={loading ? "…" : `${summary.readiness.overall}%`} />
        <AsideStat label="Managers set" value={loading ? "…" : `${summary.readiness.managerAssigned}%`} />
        <AsideStat label="Payroll on file" value={loading ? "…" : `${summary.readiness.salarySet}%`} />
        <AsideStat label="Profiles done" value={loading ? "…" : `${summary.readiness.profileComplete}%`} />
      </div>

      <div className="mt-3 border-t border-white/[0.05] pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Team mix</p>
        {loading ? (
          <p className="mt-1 text-[11px] text-slate-600">Loading…</p>
        ) : topRoles.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-600">No roles assigned</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {topRoles.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-slate-400">{r.label}</span>
                <span className="shrink-0 tabular-nums text-slate-300">{r.value}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-slate-600">
          {loading ? "…" : `${summary.headcount} people · ${summary.teams} teams`}
        </p>
      </div>
    </div>
  );
}

function AsideStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-[#0a0e13]/80 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-rose-200">{value}</p>
    </div>
  );
}
