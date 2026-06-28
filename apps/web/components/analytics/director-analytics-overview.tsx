"use client";

import type { ReactNode } from "react";
import {
  DualBarChart,
  HorizontalBarChart,
  MiniLineTrend,
  PieChart,
  VerticalBarChart
} from "./chart-widgets";
import { directorNeu } from "../director/director-theme";

type DirectorOverviewProps = {
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
    createdByWeek: { week: string; count: number }[];
  };
  leads: {
    byStatus: { status: string; count: number }[];
    createdByWeek: { week: string; count: number }[];
  };
  pipeline: {
    dealsByStage: { stage: string; count: number }[];
    wonLost: { won: number; lost: number };
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

function formatWeekLabel(week: string): string {
  const d = new Date(week + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function labelStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deliveryParagraph(d: DirectorOverviewProps): string {
  const { activeProjects, overdueTasks, blockedTasks } = d.overview;
  const { staleProjects72h } = d.risks;
  const parts: string[] = [];

  parts.push(
    activeProjects === 1
      ? "There is 1 active project in flight."
      : `There are ${activeProjects} active projects in flight.`
  );

  if (overdueTasks === 0 && blockedTasks === 0) {
    parts.push("Task queues look clear — no overdue or blocked work is flagged.");
  } else {
    const taskBits: string[] = [];
    if (overdueTasks > 0) taskBits.push(`${overdueTasks} overdue`);
    if (blockedTasks > 0) taskBits.push(`${blockedTasks} blocked`);
    parts.push(`${taskBits.join(" and ")} task${overdueTasks + blockedTasks === 1 ? "" : "s"} need attention.`);
  }

  if (staleProjects72h > 0) {
    parts.push(
      `${staleProjects72h} project${staleProjects72h === 1 ? " has" : "s have"} had no update in 72+ hours.`
    );
  }

  return parts.join(" ");
}

function pipelineParagraph(d: DirectorOverviewProps): string {
  const { leadsThisMonth, dealsWon, dealsLost, winRate } = d.overview;
  const parts: string[] = [];

  parts.push(
    leadsThisMonth === 0
      ? "No new leads were captured this month yet."
      : `${leadsThisMonth} lead${leadsThisMonth === 1 ? "" : "s"} entered the pipeline this month.`
  );

  const winPct = (winRate * 100).toFixed(0);
  if (dealsWon === 0 && dealsLost === 0) {
    parts.push("No deals have closed won or lost in the current window — win rate is not yet measurable.");
  } else {
    parts.push(
      `Win rate sits at ${winPct}% (${dealsWon} won · ${dealsLost} lost).`
    );
  }

  if (d.risks.stalledDeals14d > 0) {
    parts.push(
      `${d.risks.stalledDeals14d} deal${d.risks.stalledDeals14d === 1 ? "" : "s"} have been idle for 14+ days.`
    );
  }

  return parts.join(" ");
}

function reportingParagraph(d: DirectorOverviewProps): string {
  const { salesReportsThisMonth, developerReportsThisMonth, handoffs30d } = d.overview;
  const parts: string[] = [];

  parts.push(
    `Sales filed ${salesReportsThisMonth} report${salesReportsThisMonth === 1 ? "" : "s"} this month; developers submitted ${developerReportsThisMonth}.`
  );

  if (handoffs30d === 0) {
    parts.push("No project handoffs were recorded in the last 30 days.");
  } else {
    parts.push(
      `${handoffs30d} handoff${handoffs30d === 1 ? "" : "s"} crossed teams in the last 30 days.`
    );
  }

  return parts.join(" ");
}

function riskParagraph(d: DirectorOverviewProps): string {
  const { staleProjects72h, blockedTasks72h, stalledDeals14d } = d.risks;
  const total = staleProjects72h + blockedTasks72h + stalledDeals14d;

  if (total === 0) {
    return "Risk signals are quiet — no stale projects, long-blocked tasks, or stalled deals are flagged right now.";
  }

  const bits: string[] = [];
  if (staleProjects72h > 0) bits.push(`${staleProjects72h} stale project${staleProjects72h === 1 ? "" : "s"}`);
  if (blockedTasks72h > 0) bits.push(`${blockedTasks72h} blocked task${blockedTasks72h === 1 ? "" : "s"} (72h+)`);
  if (stalledDeals14d > 0) bits.push(`${stalledDeals14d} stalled deal${stalledDeals14d === 1 ? "" : "s"}`);

  return `Watch ${bits.join(", ")} — these are the main operational risks on the board today.`;
}

function taskHealthPie(d: DirectorOverviewProps): { label: string; value: number }[] {
  const { overdueTasks, blockedTasks } = d.overview;
  const clear = overdueTasks === 0 && blockedTasks === 0;
  if (clear) {
    return [{ label: "On schedule", value: 1 }];
  }
  const items: { label: string; value: number }[] = [];
  if (overdueTasks > 0) items.push({ label: "Overdue", value: overdueTasks });
  if (blockedTasks > 0) items.push({ label: "Blocked", value: blockedTasks });
  return items;
}

function pipelinePie(d: DirectorOverviewProps): { label: string; value: number }[] {
  const { won, lost } = d.pipeline.wonLost;
  const leadTotal = d.leads.byStatus.reduce((s, x) => s + x.count, 0);
  if (won === 0 && lost === 0 && leadTotal === 0) {
    return [{ label: "No pipeline data", value: 1 }];
  }
  const items: { label: string; value: number }[] = [];
  if (won > 0) items.push({ label: "Won", value: won });
  if (lost > 0) items.push({ label: "Lost", value: lost });
  for (const l of d.leads.byStatus) {
    if (l.count > 0) items.push({ label: labelStatus(l.status), value: l.count });
  }
  return items.length > 0 ? items : [{ label: "Pipeline empty", value: 1 }];
}

function reportingPie(d: DirectorOverviewProps): { label: string; value: number }[] {
  const { salesReportsThisMonth, developerReportsThisMonth } = d.overview;
  if (salesReportsThisMonth === 0 && developerReportsThisMonth === 0) {
    return [{ label: "No reports yet", value: 1 }];
  }
  return [
    { label: "Sales reports", value: salesReportsThisMonth || 0 },
    { label: "Dev reports", value: developerReportsThisMonth || 0 }
  ].filter((x) => x.value > 0);
}

function riskPie(d: DirectorOverviewProps): { label: string; value: number }[] {
  const { staleProjects72h, blockedTasks72h, stalledDeals14d } = d.risks;
  if (staleProjects72h === 0 && blockedTasks72h === 0 && stalledDeals14d === 0) {
    return [{ label: "All clear", value: 1 }];
  }
  return [
    { label: "Stale projects", value: staleProjects72h },
    { label: "Blocked 72h+", value: blockedTasks72h },
    { label: "Stalled deals", value: stalledDeals14d }
  ].filter((x) => x.value > 0);
}

function OverviewPanel({
  title,
  narrative,
  children
}: {
  title: string;
  narrative: string;
  children: ReactNode;
}) {
  return (
    <article className={directorNeu.chartPanel}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-300/90 sm:text-sm">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{narrative}</p>
      <div className="mt-4 flex flex-1 flex-col gap-4">{children}</div>
    </article>
  );
}

export function DirectorAnalyticsOverview(props: DirectorOverviewProps) {
  const projectWeeks = props.projects.createdByWeek;
  const leadWeeks = props.leads.createdByWeek;
  const reportWeeks = props.reports.salesByWeek.map((w, i) => ({
    week: w.week,
    sales: w.count,
    developer: props.reports.developerByWeek[i]?.count ?? 0
  }));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <OverviewPanel title="Delivery & projects" narrative={deliveryParagraph(props)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Projects by status
            </p>
            <PieChart
              items={props.projects.byStatus.map((s) => ({
                label: labelStatus(s.status),
                value: s.count
              }))}
              emptyLabel="No projects yet"
            />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Task health
            </p>
            <PieChart items={taskHealthPie(props)} emptyLabel="No task data" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            New projects (weekly trend)
          </p>
          <MiniLineTrend points={projectWeeks.map((w) => w.count)} stroke="#34d399" />
          <div className="mt-2">
            <VerticalBarChart
              items={projectWeeks.map((w) => ({
                label: formatWeekLabel(w.week),
                value: w.count,
                color: "bg-emerald-500"
              }))}
              emptyLabel="No weekly project data"
            />
          </div>
        </div>
      </OverviewPanel>

      <OverviewPanel title="Pipeline & sales" narrative={pipelineParagraph(props)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Won · lost · leads
            </p>
            <PieChart items={pipelinePie(props)} emptyLabel="No pipeline data" />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Deals by stage
            </p>
            <HorizontalBarChart
              items={props.pipeline.dealsByStage.map((x) => ({
                label: labelStatus(x.stage),
                value: x.count,
                color: "bg-indigo-500"
              }))}
              emptyLabel="No deals in pipeline"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Leads created (weekly trend)
          </p>
          <MiniLineTrend points={leadWeeks.map((w) => w.count)} stroke="#38bdf8" />
          <div className="mt-2">
            <VerticalBarChart
              items={leadWeeks.map((w) => ({
                label: formatWeekLabel(w.week),
                value: w.count,
                color: "bg-sky-500"
              }))}
              emptyLabel="No weekly lead data"
            />
          </div>
        </div>
      </OverviewPanel>

      <OverviewPanel title="Reporting & handoffs" narrative={reportingParagraph(props)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Reports this month
            </p>
            <PieChart items={reportingPie(props)} emptyLabel="No reports this month" />
          </div>
          <div className="flex flex-col justify-center gap-3">
            <div className={`rounded-xl border px-3 py-2.5 ${directorNeu.statSky}`}>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Sales reports (month)</p>
              <p className="mt-1 text-2xl font-bold text-sky-300">{props.overview.salesReportsThisMonth}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${directorNeu.statEmerald}`}>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Dev reports (month)</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{props.overview.developerReportsThisMonth}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${directorNeu.statViolet}`}>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Handoffs (30d)</p>
              <p className="mt-1 text-2xl font-bold text-violet-300">{props.overview.handoffs30d}</p>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Report submissions (weekly trend)
          </p>
          <DualBarChart
            items={reportWeeks.map((w) => ({
              label: w.week,
              a: w.sales,
              b: w.developer
            }))}
            labelA="Sales"
            labelB="Dev"
            emptyLabel="No weekly report data"
          />
        </div>
      </OverviewPanel>

      <OverviewPanel title="Risk signals" narrative={riskParagraph(props)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Risk mix
            </p>
            <PieChart items={riskPie(props)} emptyLabel="No risks flagged" />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Attention required
            </p>
            <HorizontalBarChart
              items={[
                {
                  label: "Stale projects (72h+)",
                  value: props.risks.staleProjects72h,
                  color: "bg-amber-500"
                },
                {
                  label: "Blocked tasks (72h+)",
                  value: props.risks.blockedTasks72h,
                  color: "bg-rose-500"
                },
                {
                  label: "Stalled deals (14d)",
                  value: props.risks.stalledDeals14d,
                  color: "bg-violet-500"
                }
              ]}
            />
          </div>
        </div>
      </OverviewPanel>
    </div>
  );
}
