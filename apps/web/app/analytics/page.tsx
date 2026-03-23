"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";
import { PageHeader } from "../page-header";

type CeoAnalytics = {
  revenueHealth: {
    revenueReceivedThisMonth: number;
    outstandingInvoices: number;
    overdueInvoiceCount: number;
    expensesThisMonth: number;
  };
  projectHealth: {
    activeProjects: number;
    overdueTasks: number;
    blockedTasks: number;
    milestonesDone: number;
    milestonesPending: number;
  };
  leadConversion: {
    leadsThisMonth: number;
    dealsWon: number;
    dealsLost: number;
    winRate: number;
    avgTimeToCloseDays: number;
  };
};

export default function AnalyticsPage() {
  const { apiFetch, auth } = useAuth();
  const [data, setData] = useState<CeoAnalytics | null>(null);
  const isAdmin = auth.roleKeys.includes("admin");

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/analytics/ceo");
        if (!res.ok) return;
        const json = (await res.json()) as CeoAnalytics;
        setData(json);
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="CEO-level signals across revenue, delivery, and pipeline. Aggregates only — no raw client PII in exports unless your role allows it."
      />

      {isAdmin && (
        <>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Admin analytics scope</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="shell border-l-4 border-emerald-500/60 bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Project analytics</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
                  <li>Completion rates per project</li>
                  <li>Average days to close</li>
                  <li>Module velocity per developer</li>
                  <li>Delay frequency by project type</li>
                </ul>
              </div>
              <div className="shell border-l-4 border-amber-500/60 bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Finance analytics</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
                  <li>Approval turnaround time</li>
                  <li>Decline rate and reasons</li>
                  <li>Outstanding vs collected</li>
                  <li>Cash flow trend (rolling windows)</li>
                </ul>
              </div>
              <div className="shell border-l-4 border-sky-500/60 bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Team analytics</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
                  <li>Developer utilisation signals</li>
                  <li>Swap / handoff frequency</li>
                  <li>Overload vs underutilised patterns</li>
                  <li>Report streak per user</li>
                </ul>
              </div>
              <div className="shell border-l-4 border-rose-500/50 bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Risk analytics</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
                  <li>Projects with no update in 72h+</li>
                  <li>Blocked tasks above threshold</li>
                  <li>Stalled deals in pipeline</li>
                  <li>Repeat swap patterns</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="shell border border-slate-600/80">
            <h3 className="text-sm font-semibold text-slate-200">What Admin cannot see in analytics</h3>
            <p className="mt-2 text-sm text-slate-500">Hard exclusions (PII / commercial sensitivity):</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
              <li>Individual client names tied to revenue line items</li>
              <li>Client contact details in CRM exports</li>
              <li>Sales call transcripts and developer–client comms</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-500">
                Design the analytics charts ↗
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-500">
                Export logic ↗
              </span>
            </div>
          </div>
        </>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="shell">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Revenue health
            </p>
            <ul className="space-y-1 text-sm text-slate-200">
              <li>
                Revenue this month:{" "}
                <span className="text-emerald-400">
                  {formatMoney(data.revenueHealth.revenueReceivedThisMonth)}
                </span>
              </li>
              <li>
                Outstanding invoices:{" "}
                <span className="text-amber-400">
                  {formatMoney(data.revenueHealth.outstandingInvoices)}
                </span>
              </li>
              <li>
                Overdue invoices:{" "}
                <span className="text-rose-400">
                  {data.revenueHealth.overdueInvoiceCount}
                </span>
              </li>
              <li>
                Expenses this month:{" "}
                {formatMoney(data.revenueHealth.expensesThisMonth)}
              </li>
            </ul>
          </div>
          <div className="shell">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Project health
            </p>
            <ul className="space-y-1 text-sm text-slate-200">
              <li>Active projects: {data.projectHealth.activeProjects}</li>
              <li>Overdue tasks: {data.projectHealth.overdueTasks}</li>
              <li>Blocked tasks: {data.projectHealth.blockedTasks}</li>
              <li>
                Milestones done / pending:{" "}
                {data.projectHealth.milestonesDone} /{" "}
                {data.projectHealth.milestonesPending}
              </li>
            </ul>
          </div>
          <div className="shell">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Lead conversion
            </p>
            <ul className="space-y-1 text-sm text-slate-200">
              <li>Leads this month: {data.leadConversion.leadsThisMonth}</li>
              <li>Deals won: {data.leadConversion.dealsWon}</li>
              <li>Deals lost: {data.leadConversion.dealsLost}</li>
              <li>
                Win rate:{" "}
                {(data.leadConversion.winRate * 100).toFixed(1)}%
              </li>
              <li>
                Avg time to close:{" "}
                {data.leadConversion.avgTimeToCloseDays.toFixed(1)} days
              </li>
            </ul>
          </div>
        </div>
      )}
      {!data && (
        <div className="shell text-sm text-slate-400">
          Loading analytics…
        </div>
      )}
    </section>
  );
}
