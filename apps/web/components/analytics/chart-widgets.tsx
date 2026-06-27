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

const PIE_COLORS = [
  "#34d399",
  "#38bdf8",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#94a3b8"
];

export function PieChart({
  items,
  emptyLabel = "No data yet",
  size = 140,
  valuePrefix = ""
}: {
  items: { label: string; value: number }[];
  emptyLabel?: string;
  size?: number;
  valuePrefix?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">{emptyLabel}</p>;
  }
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;
  const slices = items.map((item, idx) => {
    const slice = (item.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const color = PIE_COLORS[idx % PIE_COLORS.length];
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...item, d, color, pct: Math.round((item.value / total) * 100) };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg width={size} height={size} className="shrink-0" aria-hidden>
        {slices.map((s) => (
          <path key={s.label} d={s.d} fill={s.color} opacity={0.92} />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.45} className="fill-slate-950/80" />
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-slate-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate capitalize">{s.label.replace(/_/g, " ")}</span>
            </span>
            <span className="shrink-0 text-slate-400">
              {valuePrefix}
              {typeof s.value === "number" && s.value >= 1000
                ? s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : s.value}{" "}
              ({s.pct}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DualBarChart({
  items,
  labelA = "In",
  labelB = "Out",
  emptyLabel = "No data yet"
}: {
  items: { label: string; a: number; b: number }[];
  labelA?: string;
  labelB?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <p className="text-xs text-slate-500">{emptyLabel}</p>;
  const max = Math.max(...items.flatMap((i) => [i.a, i.b]), 1);
  return (
    <div>
      <div className="mb-2 flex gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> {labelA}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-rose-500" /> {labelB}
        </span>
      </div>
      <div className="flex h-40 items-end justify-between gap-1 sm:h-48 sm:gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full max-w-[2.5rem] items-end justify-center gap-0.5">
              <div
                className="w-[42%] rounded-t bg-emerald-500/90"
                style={{ height: `${Math.max(6, (item.a / max) * 100)}%` }}
                title={`${labelA}: ${item.a}`}
              />
              <div
                className="w-[42%] rounded-t bg-rose-500/80"
                style={{ height: `${Math.max(6, (item.b / max) * 100)}%` }}
                title={`${labelB}: ${item.b}`}
              />
            </div>
            <span className="max-w-full truncate text-[8px] text-slate-500 sm:text-[9px]" title={item.label}>
              {item.label.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
