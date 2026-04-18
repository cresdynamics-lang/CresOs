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

/** Admin-only: what the extended analytics API covers (shown as cards on the analytics page). */
const ADMIN_ANALYTICS_SCOPE_GROUPS: {
  key: string;
  title: string;
  titleClass: string;
  borderClass: string;
  items: string[];
}[] = [
  {
    key: "project",
    title: "Project analytics",
    titleClass: "text-emerald-300",
    borderClass: "border-l-emerald-500/60",
    items: [
      "Completion rates per project",
      "Average days to close",
      "Module velocity per developer",
      "Delay frequency by project type"
    ]
  },
  {
    key: "finance",
    title: "Finance analytics",
    titleClass: "text-amber-300",
    borderClass: "border-l-amber-500/60",
    items: [
      "Approval turnaround time",
      "Decline rate and reasons",
      "Outstanding vs collected",
      "Cash flow trend (rolling windows)"
    ]
  },
  {
    key: "team",
    title: "Team analytics",
    titleClass: "text-sky-300",
    borderClass: "border-l-sky-500/60",
    items: [
      "Developer utilisation signals",
      "Swap / handoff frequency",
      "Overload vs underutilised patterns",
      "Report streak per user"
    ]
  },
  {
    key: "risk",
    title: "Risk analytics",
    titleClass: "text-rose-300",
    borderClass: "border-l-rose-500/50",
    items: ["Projects with no update in 72h+", "Blocked tasks above threshold"]
  }
];

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
    <section className="flex flex-col gap-4 text-[11px] leading-snug text-slate-300 max-sm:gap-3 max-sm:text-[10px] sm:gap-6 sm:text-sm sm:leading-normal">
      <div className="max-sm:[&_h1]:text-base max-sm:[&_p]:leading-snug sm:[&_h1]:text-xl [&_p]:text-[10px] sm:[&_p]:text-sm">
        <PageHeader
          title="Analytics"
          description="CEO-level signals across revenue, delivery, and pipeline. Aggregates only — no raw client PII in exports unless your role allows it."
        />
      </div>

      {isAdmin && (
        <>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-200 max-sm:text-[10px] sm:mb-3 sm:text-sm">
              Admin analytics scope
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
              {ADMIN_ANALYTICS_SCOPE_GROUPS.map((g) => (
                <div
                  key={g.key}
                  className={`rounded-xl border border-slate-700/70 border-l-4 bg-slate-900/45 p-2.5 shadow-sm sm:p-3 ${g.borderClass}`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-wide max-sm:leading-tight sm:text-xs ${g.titleClass}`}>
                    {g.title}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1 sm:gap-1.5">
                    {g.items.map((item) => (
                      <div
                        key={item}
                        className="rounded-lg border border-slate-600/35 bg-slate-950/50 px-2 py-1.5 text-[10px] text-slate-400 max-sm:py-1 max-sm:leading-snug sm:text-xs sm:text-slate-400"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-600/80 bg-slate-900/35 p-2.5 sm:p-4">
            <h3 className="text-xs font-semibold text-slate-200 max-sm:text-[10px] sm:text-sm">
              What Admin cannot see in analytics
            </h3>
            <p className="mt-1.5 text-[10px] text-slate-500 sm:mt-2 sm:text-xs">Hard exclusions (PII / commercial sensitivity):</p>
            <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:mt-2 sm:gap-1.5">
              {[
                "Individual client names tied to revenue line items",
                "Client contact details in CRM exports",
                "Sales call transcripts and developer–client comms"
              ].map((line) => (
                <li
                  key={line}
                  className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-2 py-1.5 text-[10px] text-slate-400 sm:text-xs"
                >
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-2 py-1 text-[10px] text-slate-500 sm:px-3 sm:py-1.5 sm:text-xs">
                Design the analytics charts ↗
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-2 py-1 text-[10px] text-slate-500 sm:px-3 sm:py-1.5 sm:text-xs">
                Export logic ↗
              </span>
            </div>
          </div>

          {adminExtended && (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-2.5 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <h3 className="text-xs font-semibold text-slate-200 max-sm:text-[10px] sm:text-sm">
                  Admin extended analytics
                </h3>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {adminSectionButtons.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setAdminSection(b.key)}
                      className={
                        adminSection === b.key
                          ? "rounded-md bg-slate-600 px-2 py-1.5 text-[10px] text-white sm:px-3 sm:py-2 sm:text-sm"
                          : "rounded-md border border-slate-600 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-slate-800 sm:px-3 sm:py-2 sm:text-sm"
                      }
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {adminSection === "project" && (
                <div className="mt-3 sm:mt-4">
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 max-sm:mb-1.5 sm:mb-3 sm:text-xs sm:text-slate-300">
                    Project analytics
                  </h4>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                        Completion rates per project
                      </p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-[10px] sm:text-sm">
                          <thead>
                            <tr className="border-b border-slate-700 text-[9px] text-slate-500 sm:text-xs sm:text-slate-400">
                              <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Project</th>
                              <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Approval</th>
                              <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Done/Total</th>
                              <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminExtended.projectAnalytics.completionRates.map((p) => (
                              <tr key={p.projectId} className="border-b border-slate-800/80">
                                <td className="py-1.5 pr-2 text-slate-200 max-sm:max-w-[7rem] max-sm:truncate sm:py-2 sm:pr-3">
                                  {p.name}
                                </td>
                                <td className="py-1.5 pr-2 text-[10px] text-slate-400 sm:py-2 sm:pr-3 sm:text-xs">
                                  {p.approvalStatus ?? "—"}
                                </td>
                                <td className="py-1.5 pr-2 text-slate-300 sm:py-2 sm:pr-3">
                                  {p.doneTasks}/{p.totalTasks}
                                </td>
                                <td className="py-1.5 pr-2 text-slate-100 sm:py-2 sm:pr-3">
                                  {(p.completionRate * 100).toFixed(0)}%
                                </td>
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
                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Average days to close
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-100 max-sm:text-base sm:mt-2 sm:text-2xl">
                          {adminExtended.projectAnalytics.avgDaysToClose.toFixed(1)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Module velocity per developer (14d)
                        </p>
                        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[10px] text-slate-200 sm:max-h-none sm:text-sm">
                          {adminExtended.projectAnalytics.moduleVelocityPerDeveloper.slice(0, 10).map((u) => (
                            <li key={u.userId} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                              <span className="truncate text-slate-300">{u.name ?? u.email}</span>
                              <span className="shrink-0 text-slate-100">{u.tasksCompleted14d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Delay frequency by project type
                        </p>
                        <ul className="mt-2 space-y-1 text-[10px] text-slate-200 sm:text-sm">
                          {Object.entries(adminExtended.projectAnalytics.delayFrequencyByProjectType)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10)
                            .map(([k, v]) => (
                              <li key={k} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                                <span className="truncate text-slate-300">{k}</span>
                                <span className="shrink-0 text-amber-300">{v}</span>
                              </li>
                            ))}
                          {Object.keys(adminExtended.projectAnalytics.delayFrequencyByProjectType).length === 0 && (
                            <li className="text-slate-500">No delays detected.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {adminSection === "finance" && (
                <div className="mt-3 sm:mt-4">
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 max-sm:mb-1.5 sm:mb-3 sm:text-xs sm:text-slate-300">
                    Finance analytics
                  </h4>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Approval turnaround (hours)
                        </p>
                        <ul className="mt-2 space-y-1 text-[10px] text-slate-200 sm:text-sm">
                          <li className="flex justify-between rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            <span className="text-slate-400">Avg</span>
                            <span className="text-slate-100">
                              {adminExtended.financeAnalytics.approvalTurnaroundHours.avg.toFixed(1)}
                            </span>
                          </li>
                          <li className="flex justify-between rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            <span className="text-slate-400">P50</span>
                            <span className="text-slate-100">
                              {adminExtended.financeAnalytics.approvalTurnaroundHours.p50.toFixed(1)}
                            </span>
                          </li>
                          <li className="flex justify-between rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            <span className="text-slate-400">P90</span>
                            <span className="text-slate-100">
                              {adminExtended.financeAnalytics.approvalTurnaroundHours.p90.toFixed(1)}
                            </span>
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Decline rate
                        </p>
                        <p className="mt-1 text-lg font-semibold text-rose-300 max-sm:text-base sm:text-xl">
                          {(adminExtended.financeAnalytics.declineRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Top decline reasons
                        </p>
                        <ul className="mt-2 space-y-1 text-[10px] text-slate-200 sm:text-sm">
                          {adminExtended.financeAnalytics.topDeclineReasons.slice(0, 10).map((r, i) => (
                            <li key={i} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                              <span className="truncate text-slate-300">{r.reason}</span>
                              <span className="shrink-0 text-slate-100">{r.count}</span>
                            </li>
                          ))}
                          {adminExtended.financeAnalytics.topDeclineReasons.length === 0 && (
                            <li className="text-slate-500">No declines recorded.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Outstanding vs collected
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[10px] text-slate-200 sm:text-sm">
                          <li className="rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            Outstanding:{" "}
                            <span className="text-amber-300">
                              {formatMoney(adminExtended.financeAnalytics.outstandingVsCollected.outstandingInvoices)}
                            </span>
                          </li>
                          <li className="rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            Collected:{" "}
                            <span className="text-emerald-400">
                              {formatMoney(adminExtended.financeAnalytics.outstandingVsCollected.collectedPayments)}
                            </span>
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Cash flow trend (rolling windows)
                        </p>
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full text-left text-[10px] sm:text-sm">
                            <thead>
                              <tr className="border-b border-slate-700 text-[9px] text-slate-500 sm:text-xs sm:text-slate-400">
                                <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Window</th>
                                <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">In</th>
                                <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Out</th>
                                <th className="py-1.5 pr-2 sm:py-2 sm:pr-3">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminExtended.financeAnalytics.cashFlowTrend.map((w) => (
                                <tr key={w.window} className="border-b border-slate-800/80">
                                  <td className="py-1.5 pr-2 text-slate-300 sm:py-2 sm:pr-3">{w.window}</td>
                                  <td className="py-1.5 pr-2 text-emerald-300 sm:py-2 sm:pr-3">{formatMoney(w.in)}</td>
                                  <td className="py-1.5 pr-2 text-amber-300 sm:py-2 sm:pr-3">{formatMoney(w.out)}</td>
                                  <td
                                    className={`py-1.5 pr-2 sm:py-2 sm:pr-3 ${
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
                </div>
              )}

              {adminSection === "team" && (
                <div className="mt-3 sm:mt-4">
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 max-sm:mb-1.5 sm:mb-3 sm:text-xs sm:text-slate-300">
                    Team analytics
                  </h4>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                        Developer utilisation (active tasks)
                      </p>
                      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[10px] text-slate-200 sm:max-h-none sm:text-sm">
                        {adminExtended.teamAnalytics.developerUtilisationSignals.slice(0, 15).map((u) => (
                          <li key={u.userId} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            <span className="truncate text-slate-300">{u.name ?? u.email}</span>
                            <span className="shrink-0 text-slate-100">{u.activeTasks}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                        Swap / handoff frequency (30d, accepted)
                      </p>
                      <p className="mt-1 text-lg font-semibold text-sky-300 max-sm:text-base sm:text-xl">
                        {adminExtended.teamAnalytics.swapHandoffFrequency30d}
                      </p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                        Overload vs underutilised (median {adminExtended.teamAnalytics.overloadPatterns.medianActiveTasks}{" "}
                        active tasks)
                      </p>
                      <p className="mt-2 text-[9px] font-semibold uppercase text-slate-500 sm:text-[10px]">Overloaded</p>
                      <ul className="mt-1 space-y-1 text-[10px] text-slate-200 sm:text-sm">
                        {adminExtended.teamAnalytics.overloadPatterns.overloaded.map((u) => (
                          <li key={u.userId} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            <span className="truncate text-slate-300">{u.name ?? u.email}</span>
                            <span className="shrink-0 text-rose-300">{u.activeTasks}</span>
                          </li>
                        ))}
                        {adminExtended.teamAnalytics.overloadPatterns.overloaded.length === 0 && (
                          <li className="text-slate-500">None</li>
                        )}
                      </ul>
                      <p className="mt-2 text-[9px] font-semibold uppercase text-slate-500 sm:text-[10px]">Underutilised</p>
                      <ul className="mt-1 space-y-1 text-[10px] text-slate-200 sm:text-sm">
                        {adminExtended.teamAnalytics.overloadPatterns.underutilised.map((u) => (
                          <li key={u.userId} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                            <span className="truncate text-slate-300">{u.name ?? u.email}</span>
                            <span className="shrink-0 text-amber-300">{u.activeTasks}</span>
                          </li>
                        ))}
                        {adminExtended.teamAnalytics.overloadPatterns.underutilised.length === 0 && (
                          <li className="text-slate-500">None</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                      Report streak per user
                    </p>
                    <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                      {adminExtended.teamAnalytics.reportStreakPerUser.slice(0, 12).map((u) => (
                        <li
                          key={u.userId}
                          className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-2 py-1.5 text-[10px] text-slate-200 sm:px-3 sm:py-2 sm:text-sm"
                        >
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
                            <span className="truncate text-slate-300">{u.name ?? u.email}</span>
                            <span className="shrink-0 text-slate-100">
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
                <div className="mt-3 sm:mt-4">
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 max-sm:mb-1.5 sm:mb-3 sm:text-xs sm:text-slate-300">
                    Risk analytics
                  </h4>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                        Projects with no update in 72h+
                      </p>
                      <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-[10px] text-slate-200 sm:max-h-none sm:text-sm">
                        {adminExtended.riskAnalytics.projectsNoUpdate72h.slice(0, 12).map((p) => (
                          <li key={p.id} className="flex flex-col gap-0.5 rounded-md bg-slate-900/50 px-1.5 py-1 sm:flex-row sm:justify-between sm:gap-2 sm:px-2">
                            <span className="truncate text-slate-300">{p.name}</span>
                            <span className="shrink-0 text-[9px] text-slate-500 sm:text-xs">
                              {new Date(p.updatedAt).toLocaleString()}
                            </span>
                          </li>
                        ))}
                        {adminExtended.riskAnalytics.projectsNoUpdate72h.length === 0 && (
                          <li className="text-slate-500">None</li>
                        )}
                      </ul>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Blocked tasks above threshold (72h)
                        </p>
                        <p className="mt-1 text-lg font-semibold text-amber-300 max-sm:text-base sm:text-xl">
                          {adminExtended.riskAnalytics.blockedTasksAbove72h.length}
                        </p>
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[10px] text-slate-300 sm:max-h-40 sm:text-xs">
                          {adminExtended.riskAnalytics.blockedTasksAbove72h.slice(0, 8).map((t) => (
                            <li key={t.id} className="truncate rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Stalled deals (14d)
                        </p>
                        <p className="mt-1 text-lg font-semibold text-rose-300 max-sm:text-base sm:text-xl">
                          {adminExtended.riskAnalytics.stalledDeals14d.length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2 sm:p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                          Repeat swap patterns (90d)
                        </p>
                        <ul className="mt-2 space-y-1 text-[10px] text-slate-200 sm:text-sm">
                          {adminExtended.riskAnalytics.repeatSwapPatterns.slice(0, 12).map((r) => (
                            <li key={r.projectId} className="flex justify-between gap-2 rounded-md bg-slate-900/50 px-1.5 py-1 sm:px-2">
                              <span className="truncate text-slate-300">{r.projectName}</span>
                              <span className="shrink-0 text-slate-100">{r.count90d}</span>
                            </li>
                          ))}
                          {adminExtended.riskAnalytics.repeatSwapPatterns.length === 0 && (
                            <li className="text-slate-500">None</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 sm:p-4">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:mb-2 sm:text-xs">
              Revenue health
            </p>
            <ul className="space-y-1 text-[10px] text-slate-200 sm:text-sm">
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 sm:p-4">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:mb-2 sm:text-xs">
              Project health
            </p>
            <ul className="space-y-1 text-[10px] text-slate-200 sm:text-sm">
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 sm:p-4">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:mb-2 sm:text-xs">
              Lead conversion
            </p>
            <ul className="space-y-1 text-[10px] text-slate-200 sm:text-sm">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-[10px] text-slate-400 sm:text-sm">
          Loading analytics…
        </div>
      )}
    </section>
  );
}
