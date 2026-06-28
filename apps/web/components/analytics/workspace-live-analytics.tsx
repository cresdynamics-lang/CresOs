"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { formatMoney } from "../../app/format-money";
import { subscribeDataRefresh } from "../../app/data-refresh";
import {
  DualBarChart,
  HorizontalBarChart,
  PieChart,
  StatTile,
  VerticalBarChart
} from "./chart-widgets";

export type LiveInsights = {
  generatedAt: string;
  view: "admin" | "director" | "finance";
  money: {
    pie: { label: string; value: number }[];
    cashFlowWeeks: { week: string; in: number; out: number }[];
    totalOutstanding: number;
    overdueDebt: number;
    debtAlerts: {
      clientId: string;
      clientName: string;
      amountDue: number;
      overdueInvoices: number;
    }[];
  };
  projects: {
    byStatus: { status: string; count: number }[];
    successRate: number;
    completionPie: { label: string; value: number }[];
    slowProjects: {
      id: string;
      name: string;
      status: string;
      daysActive: number;
      completionRate: number;
      overdueTasks: number;
      pastEndDate: boolean;
    }[];
  };
  team?: {
    engagement: { label: string; value: number }[];
    reportActivity: { week: string; sales: number; developer: number }[];
    velocity: { name: string; tasks14d: number; activeTasks: number }[];
    messages30d: number;
    handoffs30d: number;
  };
  aiPredictions: { label: string; detail: string; tone: "emerald" | "amber" | "rose" | "sky" }[];
};

const toneBorder: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-950/20",
  amber: "border-amber-500/30 bg-amber-950/20",
  rose: "border-rose-500/30 bg-rose-950/20",
  sky: "border-sky-500/30 bg-sky-950/20"
};

const POLL_MS = 30_000;

export function WorkspaceLiveAnalytics({
  variant,
  className = "",
  compact = false
}: {
  variant: "finance" | "director" | "admin";
  className?: string;
  /** Tighter layout for finance overview — fewer duplicate charts. */
  compact?: boolean;
}) {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<LiveInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/analytics/live-insights");
      if (!res.ok) {
        setError("Could not load analytics");
        return;
      }
      setData((await res.json()) as LiveInsights);
      setError(null);
    } catch {
      setError("Could not reach analytics");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsubRefresh = subscribeDataRefresh(() => void load());
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      unsubRefresh();
    };
  }, [load]);

  const showTeam = variant === "director" || variant === "admin";

  return (
    <section className={`space-y-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            {compact ? "Insights & trends" : "Analytics & AI predictions"}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Live · updates on payment/expense · 30s refresh
            {data?.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08]"
        >
          Refresh
        </button>
      </div>

      {loading && !data && <p className="text-sm text-slate-500">Loading analytics…</p>}
      {error && !data && <p className="text-sm text-rose-300">{error}</p>}

      {data && (
        <>
          {data.aiPredictions.length > 0 && (
            <div className={`grid gap-3 ${compact ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
              {data.aiPredictions.map((p) => (
                <div
                  key={p.label}
                  className={`rounded-xl border p-3 ${toneBorder[p.tone] ?? toneBorder.sky}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{p.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{p.detail}</p>
                </div>
              ))}
            </div>
          )}

          <div className={`grid gap-6 ${compact ? "xl:grid-cols-12" : "lg:grid-cols-2"}`}>
            <div className={`space-y-4 ${compact ? "xl:col-span-5" : ""}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Money · invoice mix</p>
              <PieChart items={data.money.pie} valuePrefix="KES " emptyLabel="No invoice data yet" />
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Outstanding" value={formatMoney(data.money.totalOutstanding)} tone="amber" />
                <StatTile label="Overdue debt" value={formatMoney(data.money.overdueDebt)} tone="rose" />
              </div>
            </div>

            <div className={`space-y-4 ${compact ? "xl:col-span-7" : ""}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Cash flow (8 weeks)
              </p>
              <DualBarChart
                items={data.money.cashFlowWeeks.map((w) => ({
                  label: w.week,
                  a: w.in,
                  b: w.out
                }))}
                labelA="In"
                labelB="Out"
              />
            </div>
          </div>

          {(variant === "finance" || variant === "admin") && data.money.debtAlerts.length > 0 && (
            <div className={compact ? "rounded-xl border border-rose-500/15 bg-rose-950/10 p-4" : ""}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400/90">
                  Clients due
                </p>
                {compact && (
                  <a href="/finance/clients-due" className="text-xs text-rose-300/90 hover:text-rose-200">
                    View all →
                  </a>
                )}
              </div>
              <ul className={`space-y-2 ${compact ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
                {data.money.debtAlerts.slice(0, compact ? 6 : undefined).map((d) => (
                  <li
                    key={d.clientId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-950/15 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-200">{d.clientName}</span>
                    <span className="text-rose-300">
                      {formatMoney(d.amountDue)} due
                      {d.overdueInvoices > 0 ? ` · ${d.overdueInvoices} overdue` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`grid gap-6 ${compact ? "lg:grid-cols-2" : "lg:grid-cols-2"}`}>
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Projects · status
              </p>
              <PieChart items={data.projects.byStatus.map((s) => ({ label: s.status, value: s.count }))} />
              <StatTile
                label="Project success rate"
                value={`${data.projects.successRate}%`}
                hint="Active projects ≥80% tasks done"
                tone={data.projects.successRate >= 70 ? "emerald" : "amber"}
              />
            </div>

            {!compact && (
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Delivery health
                </p>
                <PieChart items={data.projects.completionPie} emptyLabel="No active task data" />
                <VerticalBarChart
                  items={data.projects.byStatus.map((s) => ({
                    label: s.status.slice(0, 6),
                    value: s.count,
                    color: "bg-sky-500"
                  }))}
                />
              </div>
            )}

            {compact && data.projects.completionPie.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Delivery health
                </p>
                <PieChart items={data.projects.completionPie} emptyLabel="No active task data" />
              </div>
            )}
          </div>

          {data.projects.slowProjects.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
                Projects taking longer · overdue or stalled
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Project</th>
                      <th className="py-2 pr-3">Days active</th>
                      <th className="py-2 pr-3">Progress</th>
                      <th className="py-2">Overdue tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.slowProjects.map((p) => (
                      <tr key={p.id} className="border-t border-white/[0.06] text-slate-300">
                        <td className="py-2 pr-3">
                          {p.name}
                          {p.pastEndDate && (
                            <span className="ml-1 text-[10px] text-rose-400">past end date</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">{p.daysActive}d</td>
                        <td className="py-2 pr-3">{p.completionRate}%</td>
                        <td className="py-2 text-amber-300">{p.overdueTasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showTeam && data.team && (
            <>
              <div className="border-t border-white/[0.06] pt-6">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Team engagement & success
                </p>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Engagement signals
                    </p>
                    <HorizontalBarChart
                      items={data.team.engagement.map((e) => ({
                        label: e.label,
                        value: e.value,
                        color: "bg-violet-500"
                      }))}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Report activity (8 weeks)
                    </p>
                    <DualBarChart
                      items={data.team.reportActivity.map((w) => ({
                        label: w.week,
                        a: w.sales,
                        b: w.developer
                      }))}
                      labelA="Sales"
                      labelB="Dev"
                    />
                  </div>
                </div>
                {data.team.velocity.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Developer velocity (14d tasks done vs active load)
                    </p>
                    <HorizontalBarChart
                      items={data.team.velocity.map((v) => ({
                        label: `${v.name} (${v.activeTasks} active)`,
                        value: v.tasks14d,
                        color: "bg-emerald-500"
                      }))}
                      valueSuffix=" tasks"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
