"use client";

type BarItem = { label: string; value: number; color?: string };

export function HorizontalBarChart({
  items,
  emptyLabel = "No data yet",
  valueSuffix = ""
}: {
  items: BarItem[];
  emptyLabel?: string;
  valueSuffix?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-[10px] sm:text-xs">
            <span className="truncate text-slate-300">{item.label}</span>
            <span className="shrink-0 font-medium text-slate-100">
              {item.value}
              {valueSuffix}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800/90">
            <div
              className={`h-full rounded-full transition-all ${item.color ?? "bg-emerald-500"}`}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VerticalBarChart({
  items,
  emptyLabel = "No data yet"
}: {
  items: BarItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex h-44 items-end justify-between gap-1.5 border-b border-slate-700/60 pb-1 pt-2 sm:h-52 sm:gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[9px] font-medium text-slate-200 sm:text-[10px]">{item.value}</span>
          <div
            className={`w-full max-w-[2.5rem] rounded-t-md ${item.color ?? "bg-sky-500"}`}
            style={{ height: `${Math.max(8, (item.value / max) * 100)}%`, minHeight: 8 }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="max-w-full truncate text-center text-[8px] text-slate-500 sm:text-[9px]" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "slate"
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "emerald" | "sky" | "amber" | "rose" | "violet" | "slate";
}) {
  const toneClass = {
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    violet: "text-violet-400",
    slate: "text-slate-100"
  }[tone];
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">{hint}</p>}
    </div>
  );
}

export function MiniLineTrend({
  points,
  stroke = "#34d399"
}: {
  points: number[];
  stroke?: string;
}) {
  if (points.length === 0) return null;
  const w = 200;
  const h = 48;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full text-emerald-400" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
}
