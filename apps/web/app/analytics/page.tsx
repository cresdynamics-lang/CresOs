"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type AdminExtendedAnalytics = {
  projectAnalytics: {
    completionRates: {
      projectId: string;
      name: string;
      approvalStatus: string | null;
      status: string;
      totalTasks: number;
      doneTasks: number;
      completionRate: number;
    }[];
    avgDaysToClose: number;
    moduleVelocityPerDeveloper: { userId: string; name: string | null; email: string; tasksCompleted14d: number }[];
    delayFrequencyByProjectType: Record<string, number>;
  };
  financeAnalytics: {
    approvalTurnaroundHours: { avg: number; p50: number; p90: number };
    declineRate: number;
    topDeclineReasons: { reason: string; count: number }[];
    outstandingVsCollected: { outstandingInvoices: number; collectedPayments: number };
    cashFlowTrend: { window: string; in: number; out: number; net: number }[];
  };
  teamAnalytics: {
    developerUtilisationSignals: { userId: string; name: string | null; email: string; activeTasks: number }[];
    swapHandoffFrequency30d: number;
    overloadPatterns: {
      medianActiveTasks: number;
      overloaded: { userId: string; name: string | null; email: string; activeTasks: number }[];
      underutilised: { userId: string; name: string | null; email: string; activeTasks: number }[];
    };
    reportStreakPerUser: { userId: string; name: string | null; email: string; salesReportStreakDays: number; developerReportStreakDays: number }[];
  };
  riskAnalytics: {
    projectsNoUpdate72h: { id: string; name: string; updatedAt: string; status: string }[];
    blockedTasksAbove72h: { id: string; title: string; projectId: string; updatedAt: string }[];
    stalledDeals14d: { id: string; title: string; stage: string; updatedAt: string; value: any }[];
    repeatSwapPatterns: { projectId: string; projectName: string; count90d: number }[];
  };
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const [data, setData] = useState<CeoAnalytics | null>(null);
  const [adminExtended, setAdminExtended] = useState<AdminExtendedAnalytics | null>(null);
  const isAdmin = auth.roleKeys.includes("admin");
  const canAccessAnalytics = auth.roleKeys.some((r) =>
    ["admin", "director_admin", "finance", "analyst"].includes(r)
  );
  const [adminSection, setAdminSection] = useState<"project" | "finance" | "team" | "risk">("project");

  const adminSectionButtons = useMemo(
    () =>
      [
        { key: "project" as const, label: "Project analytics" },
        { key: "finance" as const, label: "Finance analytics" },
        { key: "team" as const, label: "Team analytics" },
        { key: "risk" as const, label: "Risk analytics" }
      ],
    []
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessAnalytics) {
      router.replace("/dashboard");
    }
  }, [hydrated, auth.accessToken, canAccessAnalytics, router]);

  useEffect(() => {
    if (!canAccessAnalytics) return;
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
    void load();
  }, [apiFetch, canAccessAnalytics]);

  useEffect(() => {
    if (!isAdmin) return;
    async function loadAdmin() {
      try {
        const res = await apiFetch("/analytics/admin-extended");
        if (!res.ok) return;
        setAdminExtended((await res.json()) as AdminExtendedAnalytics);
      } catch {
        // ignore
      }
    }
    void loadAdmin();
  }, [apiFetch, isAdmin]);

  if (hydrated && auth.accessToken && !canAccessAnalytics) {
    return (
      <section className="shell">
        <p className="text-slate-400">Redirecting…</p>
      </section>
    );
  }

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

          {adminExtended && (
            <div className="shell border border-slate-700/70 bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-200">Admin extended analytics</h3>
                <div className="flex flex-wrap gap-2">
                  {adminSectionButtons.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setAdminSection(b.key)}
                      className={
                        adminSection === b.key
                          ? "rounded bg-slate-600 px-3 py-2 text-sm text-white"
                          : "rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      }
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {adminSection === "project" && (
                <div className="mt-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-200">PROJECT ANALYTICS</h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">Completion rates per project</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-700 text-xs text-slate-400">
                              <th className="py-2 pr-3">Project</th>
                              <th className="py-2 pr-3">Approval</th>
                              <th className="py-2 pr-3">Done/Total</th>
                              <th className="py-2 pr-3">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminExtended.projectAnalytics.completionRates.map((p) => (
                              <tr key={p.projectId} className="border-b border-slate-800">
                                <td className="py-2 pr-3 text-slate-200">{p.name}</td>
                                <td className="py-2 pr-3 text-xs text-slate-400">{p.approvalStatus ?? "—"}</td>
                                <td className="py-2 pr-3 text-slate-300">
                                  {p.doneTasks}/{p.totalTasks}
                                </td>
                                <td className="py-2 pr-3 text-slate-100">{(p.completionRate * 100).toFixed(0)}%</td>
                              </tr>
                            ))}
                            {adminExtended.projectAnalytics.completionRates.length === 0 && (
                              <tr>
                                <td className="py-2 text-slate-500" colSpan={4}>
                                  No projects yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Average days to close</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">
                        {adminExtended.projectAnalytics.avgDaysToClose.toFixed(1)}
                      </p>
                      <p className="mt-4 text-xs text-slate-400">Module velocity per developer (tasks completed in 14d)</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.projectAnalytics.moduleVelocityPerDeveloper.slice(0, 10).map((u) => (
                          <li key={u.userId} className="flex justify-between">
                            <span className="text-slate-300">{u.name ?? u.email}</span>
                            <span className="text-slate-100">{u.tasksCompleted14d}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 text-xs text-slate-400">Delay frequency by project type</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {Object.entries(adminExtended.projectAnalytics.delayFrequencyByProjectType)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 10)
                          .map(([k, v]) => (
                            <li key={k} className="flex justify-between">
                              <span className="text-slate-300">{k}</span>
                              <span className="text-amber-300">{v}</span>
                            </li>
                          ))}
                        {Object.keys(adminExtended.projectAnalytics.delayFrequencyByProjectType).length === 0 && (
                          <li className="text-slate-500">No delays detected.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {adminSection === "finance" && (
                <div className="mt-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-200">FINANCE ANALYTICS</h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">Approval turnaround time (hours)</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        <li>
                          Avg:{" "}
                          <span className="text-slate-100">
                            {adminExtended.financeAnalytics.approvalTurnaroundHours.avg.toFixed(1)}
                          </span>
                        </li>
                        <li>
                          P50:{" "}
                          <span className="text-slate-100">
                            {adminExtended.financeAnalytics.approvalTurnaroundHours.p50.toFixed(1)}
                          </span>
                        </li>
                        <li>
                          P90:{" "}
                          <span className="text-slate-100">
                            {adminExtended.financeAnalytics.approvalTurnaroundHours.p90.toFixed(1)}
                          </span>
                        </li>
                      </ul>
                      <p className="mt-4 text-xs text-slate-400">Decline rate</p>
                      <p className="mt-1 text-xl font-semibold text-rose-300">
                        {(adminExtended.financeAnalytics.declineRate * 100).toFixed(1)}%
                      </p>
                      <p className="mt-3 text-xs text-slate-400">Top decline reasons</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.financeAnalytics.topDeclineReasons.slice(0, 10).map((r, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate text-slate-300">{r.reason}</span>
                            <span className="shrink-0 text-slate-100">{r.count}</span>
                          </li>
                        ))}
                        {adminExtended.financeAnalytics.topDeclineReasons.length === 0 && (
                          <li className="text-slate-500">No declines recorded.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Outstanding vs collected</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        <li>
                          Outstanding:{" "}
                          <span className="text-amber-300">
                            {formatMoney(adminExtended.financeAnalytics.outstandingVsCollected.outstandingInvoices)}
                          </span>
                        </li>
                        <li>
                          Collected:{" "}
                          <span className="text-emerald-400">
                            {formatMoney(adminExtended.financeAnalytics.outstandingVsCollected.collectedPayments)}
                          </span>
                        </li>
                      </ul>
                      <p className="mt-4 text-xs text-slate-400">Cash flow trend (rolling windows)</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-700 text-xs text-slate-400">
                              <th className="py-2 pr-3">Window</th>
                              <th className="py-2 pr-3">In</th>
                              <th className="py-2 pr-3">Out</th>
                              <th className="py-2 pr-3">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminExtended.financeAnalytics.cashFlowTrend.map((w) => (
                              <tr key={w.window} className="border-b border-slate-800">
                                <td className="py-2 pr-3 text-slate-300">{w.window}</td>
                                <td className="py-2 pr-3 text-emerald-300">{formatMoney(w.in)}</td>
                                <td className="py-2 pr-3 text-amber-300">{formatMoney(w.out)}</td>
                                <td
                                  className={`py-2 pr-3 ${
                                    w.net >= 0 ? "text-emerald-400" : "text-rose-300"
                                  }`}
                                >
                                  {formatMoney(w.net)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {adminSection === "team" && (
                <div className="mt-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-200">TEAM ANALYTICS</h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">Developer utilisation signals (active tasks)</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.teamAnalytics.developerUtilisationSignals.slice(0, 15).map((u) => (
                          <li key={u.userId} className="flex justify-between">
                            <span className="text-slate-300">{u.name ?? u.email}</span>
                            <span className="text-slate-100">{u.activeTasks}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 text-xs text-slate-400">Swap / handoff frequency (accepted, 30d)</p>
                      <p className="mt-1 text-xl font-semibold text-sky-300">
                        {adminExtended.teamAnalytics.swapHandoffFrequency30d}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">
                        Overload vs underutilised (median active tasks: {adminExtended.teamAnalytics.overloadPatterns.medianActiveTasks})
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Overloaded</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.teamAnalytics.overloadPatterns.overloaded.map((u) => (
                          <li key={u.userId} className="flex justify-between">
                            <span className="text-slate-300">{u.name ?? u.email}</span>
                            <span className="text-rose-300">{u.activeTasks}</span>
                          </li>
                        ))}
                        {adminExtended.teamAnalytics.overloadPatterns.overloaded.length === 0 && <li className="text-slate-500">None</li>}
                      </ul>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Underutilised</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.teamAnalytics.overloadPatterns.underutilised.map((u) => (
                          <li key={u.userId} className="flex justify-between">
                            <span className="text-slate-300">{u.name ?? u.email}</span>
                            <span className="text-amber-300">{u.activeTasks}</span>
                          </li>
                        ))}
                        {adminExtended.teamAnalytics.overloadPatterns.underutilised.length === 0 && <li className="text-slate-500">None</li>}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-slate-400">Report streak per user (top)</p>
                    <ul className="mt-2 grid gap-2 md:grid-cols-2">
                      {adminExtended.teamAnalytics.reportStreakPerUser.slice(0, 12).map((u) => (
                        <li
                          key={u.userId}
                          className="rounded border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="truncate text-slate-300">{u.name ?? u.email}</span>
                            <span className="text-slate-100">
                              Sales {u.salesReportStreakDays}d · Dev {u.developerReportStreakDays}d
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {adminSection === "risk" && (
                <div className="mt-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-200">RISK ANALYTICS</h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">Projects with no update in 72h+</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.riskAnalytics.projectsNoUpdate72h.slice(0, 12).map((p) => (
                          <li key={p.id} className="flex justify-between gap-2">
                            <span className="truncate text-slate-300">{p.name}</span>
                            <span className="shrink-0 text-slate-500">{new Date(p.updatedAt).toLocaleString()}</span>
                          </li>
                        ))}
                        {adminExtended.riskAnalytics.projectsNoUpdate72h.length === 0 && <li className="text-slate-500">None</li>}
                      </ul>
                      <p className="mt-4 text-xs text-slate-400">Blocked tasks above threshold (72h)</p>
                      <p className="mt-1 text-xl font-semibold text-amber-300">
                        {adminExtended.riskAnalytics.blockedTasksAbove72h.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Stalled deals in pipeline (14d)</p>
                      <p className="mt-1 text-xl font-semibold text-rose-300">
                        {adminExtended.riskAnalytics.stalledDeals14d.length}
                      </p>
                      <p className="mt-4 text-xs text-slate-400">Repeat swap patterns (90d)</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-200">
                        {adminExtended.riskAnalytics.repeatSwapPatterns.slice(0, 12).map((r) => (
                          <li key={r.projectId} className="flex justify-between gap-2">
                            <span className="truncate text-slate-300">{r.projectName}</span>
                            <span className="shrink-0 text-slate-100">{r.count90d}</span>
                          </li>
                        ))}
                        {adminExtended.riskAnalytics.repeatSwapPatterns.length === 0 && <li className="text-slate-500">None</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
