"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";

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
  const { apiFetch } = useAuth();
  const [data, setData] = useState<CeoAnalytics | null>(null);

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
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">
          Analytics
        </h2>
        <p className="text-sm text-slate-300">
          CEO-level view across revenue, projects, pipeline, and workload.
        </p>
      </div>
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
          Analytics not available yet.
        </div>
      )}
    </section>
  );
}

