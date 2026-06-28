"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { DirectorAnalyticsOverview } from "../../components/analytics/director-analytics-overview";
import {
  HorizontalBarChart,
  MiniLineTrend,
  StatTile,
  VerticalBarChart
} from "../../components/analytics/chart-widgets";

type DirectorAnalytics = {
  overview: {
    activeProjects: number;
    overdueTasks: number;
    blockedTasks: number;
    leadsThisMonth: number;
    dealsWon: number;
    dealsLost: number;
    winRate: number;
    salesReportsThisMonth: number;
    developerReportsThisMonth: number;
    handoffs30d: number;
  };
  projects: {
    byStatus: { status: string; count: number }[];
    completionTop: {
      projectId: string;
      name: string;
      status: string;
      completionRate: number;
      totalTasks: number;
      doneTasks: number;
    }[];
    createdByWeek: { week: string; count: number }[];
    moving: {
      id: string;
      name: string;
      status: string;
      approvalStatus: string | null;
      completionRate: number;
      updatedAt: string;
    }[];
  };
  leads: {
    byStatus: { status: string; count: number }[];
    byApproval: { approvalStatus: string; count: number }[];
    createdByWeek: { week: string; count: number }[];
  };
  pipeline: {
    dealsByStage: { stage: string; count: number }[];
    wonLost: { won: number; lost: number };
  };
  team: {
    developerVelocity: { userId: string; name: string | null; email: string; tasksCompleted14d: number }[];
    developerLoad: { userId: string; name: string | null; email: string; activeTasks: number }[];
    reportStreaks: {
      userId: string;
      name: string | null;
      email: string;
      salesReportStreakDays: number;
      developerReportStreakDays: number;
    }[];
  };
  reports: {
    salesByWeek: { week: string; count: number }[];
    developerByWeek: { week: string; count: number }[];
  };
  risks: {
    staleProjects72h: number;
    blockedTasks72h: number;
    stalledDeals14d: number;
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
  teamAnalytics: {
    developerUtilisationSignals: { userId: string; name: string | null; email: string; activeTasks: number }[];
    swapHandoffFrequency30d: number;
    overloadPatterns: {
      medianActiveTasks: number;
      overloaded: { userId: string; name: string | null; email: string; activeTasks: number }[];
      underutilised: { userId: string; name: string | null; email: string; activeTasks: number }[];
    };
    reportStreakPerUser: {
      userId: string;
      name: string | null;
      email: string;
      salesReportStreakDays: number;
      developerReportStreakDays: number;
    }[];
  };
  riskAnalytics: {
    projectsNoUpdate72h: { id: string; name: string; updatedAt: string; status: string }[];
    blockedTasksAbove72h: { id: string; title: string; projectId: string; updatedAt: string }[];
    stalledDeals14d: { id: string; title: string; stage: string; updatedAt: string; value: unknown }[];
    repeatSwapPatterns: { projectId: string; projectName: string; count90d: number }[];
  };
};

function formatWeekLabel(week: string): string {
  const d = new Date(week + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function labelStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const [director, setDirector] = useState<DirectorAnalytics | null>(null);
  const [adminExtended, setAdminExtended] = useState<AdminExtendedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = auth.roleKeys.includes("admin");
  const isFinanceOnly =
    auth.roleKeys.includes("finance") &&
    !auth.roleKeys.some((r) => ["admin", "director_admin", "analyst"].includes(r));
  const canAccessAnalytics = auth.roleKeys.some((r) =>
    ["admin", "director_admin", "finance", "analyst"].includes(r)
  );
  const showOperational = !isFinanceOnly;

  const [adminSection, setAdminSection] = useState<"project" | "team" | "risk">("project");
  const adminSectionButtons = useMemo(
    () => [
      { key: "project" as const, label: "Projects" },
      { key: "team" as const, label: "Team & reports" },
      { key: "risk" as const, label: "Risks" }
    ],
    []
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessAnalytics) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccessAnalytics, router]);

  useEffect(() => {
    if (!canAccessAnalytics || !showOperational) {
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch("/analytics/director");
        if (res.ok) setDirector((await res.json()) as DirectorAnalytics);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [apiFetch, canAccessAnalytics, showOperational]);

  useEffect(() => {
    if (!isAdmin) return;
    async function loadAdmin() {
      try {
        const res = await apiFetch("/analytics/admin-extended");
        if (res.ok) setAdminExtended((await res.json()) as AdminExtendedAnalytics);
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

  if (isFinanceOnly) {
    return (
      <section className="flex flex-col gap-4 text-sm text-slate-300">
        <WorkspaceDashboardIntro
          title="Analytics"
          description="Operational analytics (projects, sales, developers, leads) live here for directors and analysts. Finance metrics are in the Finance workspace."
          eyebrow="Insights"
        />
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4 text-slate-400">
          Open <strong className="text-slate-200">Finance</strong> from the sidebar for invoices, payments, and cash
          flow.
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 text-[11px] leading-snug text-slate-300 max-sm:gap-3 sm:gap-6 sm:text-sm sm:leading-normal">
      <WorkspaceDashboardIntro
        title="Director analytics"
        description="Delivery, sales pipeline, developer performance, and reporting — operational data only. No revenue or invoice metrics on this page."
        eyebrow="Insights"
      />

      {loading && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-4 text-slate-400">Loading analytics…</div>
      )}

      {director && (
        <>
          <DirectorAnalyticsOverview
            overview={director.overview}
            projects={director.projects}
            leads={director.leads}
            pipeline={director.pipeline}
            reports={director.reports}
            risks={director.risks}
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Projects by status</h3>
              <div className="mt-3">
                <VerticalBarChart
                  items={director.projects.byStatus.map((x) => ({
                    label: labelStatus(x.status),
                    value: x.count,
                    color: "bg-emerald-500"
                  }))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">New projects (weekly)</h3>
              <div className="mt-2">
                <MiniLineTrend points={director.projects.createdByWeek.map((w) => w.count)} stroke="#34d399" />
              </div>
              <div className="mt-3">
                <VerticalBarChart
                  items={director.projects.createdByWeek.map((w) => ({
                    label: formatWeekLabel(w.week),
                    value: w.count,
                    color: "bg-teal-500"
                  }))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Leads pipeline</h3>
              <p className="mt-1 text-[10px] text-slate-500">By status</p>
              <div className="mt-2">
                <HorizontalBarChart
                  items={director.leads.byStatus.map((x) => ({
                    label: labelStatus(x.status),
                    value: x.count,
                    color: "bg-sky-500"
                  }))}
                />
              </div>
              <p className="mt-4 text-[10px] text-slate-500">Director approval</p>
              <div className="mt-2">
                <HorizontalBarChart
                  items={director.leads.byApproval.map((x) => ({
                    label: labelStatus(x.approvalStatus),
                    value: x.count,
                    color: "bg-violet-500"
                  }))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Deals by stage</h3>
              <div className="mt-3">
                <HorizontalBarChart
                  items={director.pipeline.dealsByStage.map((x) => ({
                    label: labelStatus(x.stage),
                    value: x.count,
                    color: "bg-indigo-500"
                  }))}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <StatTile label="Won" value={director.pipeline.wonLost.won} tone="emerald" />
                <StatTile label="Lost" value={director.pipeline.wonLost.lost} tone="rose" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Developer velocity (14d)</h3>
              <div className="mt-3">
                <HorizontalBarChart
                  items={director.team.developerVelocity.map((u) => ({
                    label: u.name ?? u.email,
                    value: u.tasksCompleted14d,
                    color: "bg-cyan-500"
                  }))}
                  emptyLabel="No completed tasks logged yet"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Developer workload (active tasks)</h3>
              <div className="mt-3">
                <HorizontalBarChart
                  items={director.team.developerLoad.map((u) => ({
                    label: u.name ?? u.email,
                    value: u.activeTasks,
                    color: "bg-amber-500"
                  }))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Report submissions (weekly)</h3>
              <p className="mt-1 text-[10px] text-slate-500">Sales vs developer reports</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase text-sky-400">Sales</p>
                  <VerticalBarChart
                    items={director.reports.salesByWeek.map((w) => ({
                      label: formatWeekLabel(w.week),
                      value: w.count,
                      color: "bg-sky-500"
                    }))}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase text-emerald-400">Developers</p>
                  <VerticalBarChart
                    items={director.reports.developerByWeek.map((w) => ({
                      label: formatWeekLabel(w.week),
                      value: w.count,
                      color: "bg-emerald-500"
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
              <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Report streaks (performance)</h3>
              <div className="mt-3">
                <HorizontalBarChart
                  items={director.team.reportStreaks.slice(0, 10).map((u) => ({
                    label: u.name ?? u.email,
                    value: u.salesReportStreakDays + u.developerReportStreakDays,
                    color: "bg-violet-500"
                  }))}
                  valueSuffix=" d"
                  emptyLabel="No streak data"
                />
              </div>
              <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-[10px] text-slate-400 sm:text-xs">
                {director.team.reportStreaks.slice(0, 8).map((u) => (
                  <li key={u.userId} className="flex justify-between gap-2">
                    <span className="truncate">{u.name ?? u.email}</span>
                    <span className="shrink-0 text-slate-300">
                      Sales {u.salesReportStreakDays}d · Dev {u.developerReportStreakDays}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4">
            <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">Projects moving (recent activity)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-[10px] sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500">
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Progress</th>
                    <th className="py-2 pr-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {director.projects.moving.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/80">
                      <td className="max-w-[10rem] truncate py-2 pr-3 text-slate-200">{p.name}</td>
                      <td className="py-2 pr-3 text-slate-400">{labelStatus(p.status)}</td>
                      <td className="py-2 pr-3 text-emerald-300">{(p.completionRate * 100).toFixed(0)}%</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                        {new Date(p.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {director.projects.moving.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-slate-500">
                        No active projects yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {director.projects.completionTop.length > 0 && (
              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Top completion rates</p>
                <div className="mt-2">
                  <HorizontalBarChart
                    items={director.projects.completionTop.slice(0, 8).map((p) => ({
                      label: p.name,
                      value: Math.round(p.completionRate * 100),
                      color: "bg-emerald-600"
                    }))}
                    valueSuffix="%"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isAdmin && adminExtended && (
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-2.5 sm:p-4">
          <DashboardSectionLabel roleKeys={auth.roleKeys} tone="dashboard">
            Admin detail tables
          </DashboardSectionLabel>
          <div className="mt-2 flex flex-wrap gap-1 sm:gap-2">
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

          {adminSection === "project" && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[10px] sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500">
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Tasks</th>
                    <th className="py-2 pr-3">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {adminExtended.projectAnalytics.completionRates.map((p) => (
                    <tr key={p.projectId} className="border-b border-slate-800/80">
                      <td className="py-2 pr-3 text-slate-200">{p.name}</td>
                      <td className="py-2 pr-3 text-slate-400">
                        {p.doneTasks}/{p.totalTasks}
                      </td>
                      <td className="py-2 pr-3">{(p.completionRate * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminSection === "team" && (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Utilisation</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {adminExtended.teamAnalytics.developerUtilisationSignals.slice(0, 12).map((u) => (
                    <li key={u.userId} className="flex justify-between">
                      <span>{u.name ?? u.email}</span>
                      <span>{u.activeTasks} active</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Report streaks</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {adminExtended.teamAnalytics.reportStreakPerUser.slice(0, 12).map((u) => (
                    <li key={u.userId} className="flex justify-between gap-2">
                      <span className="truncate">{u.name ?? u.email}</span>
                      <span className="shrink-0">
                        S {u.salesReportStreakDays}d · D {u.developerReportStreakDays}d
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {adminSection === "risk" && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatTile
                label="Projects stale 72h+"
                value={adminExtended.riskAnalytics.projectsNoUpdate72h.length}
                tone="amber"
              />
              <StatTile
                label="Blocked tasks 72h+"
                value={adminExtended.riskAnalytics.blockedTasksAbove72h.length}
                tone="rose"
              />
              <StatTile
                label="Stalled deals"
                value={adminExtended.riskAnalytics.stalledDeals14d.length}
                tone="rose"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
