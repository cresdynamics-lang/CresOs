import { StatCard, StatCardGrid } from "./stat-card";

export type ScheduleKpiStats = { total: number; completed: number; pending: number };

/** Colored KPI row for schedule accountability. */
export function ScheduleKpiStrip({ stats, className = "" }: { stats: ScheduleKpiStats; className?: string }) {
  return (
    <div className={className}>
    <StatCardGrid>
      <StatCard label="Total" value={stats.total} hint="scheduled in period" tone="sky" />
      <StatCard label="Done" value={stats.completed} hint="completed" tone="emerald" />
      <StatCard label="Pending" value={stats.pending} hint="not done" tone="amber" />
    </StatCardGrid>
    </div>
  );
}
