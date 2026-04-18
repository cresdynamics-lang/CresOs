export type ScheduleKpiStats = { total: number; completed: number; pending: number };

const SEGMENTS: {
  key: string;
  label: string;
  sub: string;
  valueKey: keyof ScheduleKpiStats;
  tone: string;
}[] = [
  { key: "total", label: "Total", sub: "scheduled in period", valueKey: "total", tone: "text-slate-100" },
  { key: "done", label: "Done", sub: "completed", valueKey: "completed", tone: "text-emerald-400" },
  { key: "pending", label: "Pending", sub: "not done", valueKey: "pending", tone: "text-amber-400" }
];

/**
 * One horizontal row per viewport: label, value, and subtitle sit on the same line in each third.
 */
export function ScheduleKpiStrip({ stats, className = "" }: { stats: ScheduleKpiStats; className?: string }) {
  return (
    <div
      className={`flex w-full min-w-0 flex-nowrap items-stretch divide-x divide-slate-700/70 overflow-x-auto ${className}`.trim()}
    >
      {SEGMENTS.map((s) => (
        <div
          key={s.key}
          className="flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-x-0.5 px-1 py-0.5 sm:gap-x-1.5 sm:px-2 sm:py-1"
        >
          <span className="shrink-0 text-[8px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">
            {s.label}
          </span>
          <span className={`shrink-0 text-xs font-semibold tabular-nums leading-none sm:text-base ${s.tone}`}>
            {stats[s.valueKey]}
          </span>
          <span className="min-w-0 truncate text-[8px] leading-tight text-slate-500 sm:text-[10px]">{s.sub}</span>
        </div>
      ))}
    </div>
  );
}
