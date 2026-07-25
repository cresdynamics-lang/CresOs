"use client";

type BarItem = { label: string; value: number; color?: string };

/** Professional chart palette — readable on light admin surfaces. */
const CHART = {
  track: "bg-slate-200",
  label: "text-slate-800",
  value: "text-slate-900",
  muted: "text-slate-600",
  axis: "border-slate-300",
  barDefault: "bg-[#2D5A5A]",
  barAlt: "bg-[#2067B0]"
};

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
    return <p className={`font-body text-xs font-medium ${CHART.muted}`}>{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between gap-2 font-body text-xs sm:text-sm">
            <span className={`truncate font-semibold ${CHART.label}`}>{item.label}</span>
            <span className={`shrink-0 font-bold tabular-nums ${CHART.value}`}>
              {item.value}
              {valueSuffix}
            </span>
          </div>
          <div className={`h-2.5 overflow-hidden rounded-full ${CHART.track}`}>
            <div
              className={`h-full rounded-full transition-all ${item.color ?? CHART.barDefault}`}
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
    return <p className={`font-body text-xs font-medium ${CHART.muted}`}>{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className={`flex h-48 items-end justify-between gap-2 border-b pb-1 pt-2 sm:h-56 sm:gap-3 ${CHART.axis}`}>
      {items.map((item) => (
        <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center">
          <span className={`mb-1 shrink-0 font-label text-[10px] font-bold tabular-nums ${CHART.value}`}>
            {item.value}
          </span>
          <div className="flex min-h-0 w-full flex-1 items-end justify-center">
            <div
              className={`w-full max-w-[2.75rem] rounded-t-md ${item.color ?? CHART.barDefault}`}
              style={{ height: `${Math.max(10, (item.value / max) * 100)}%` }}
              title={`${item.label}: ${item.value}`}
            />
          </div>
          <span
            className={`chart-label mt-1.5 max-w-full shrink-0 truncate text-center font-label text-[9px] font-semibold ${CHART.muted}`}
            title={item.label}
          >
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
    emerald: "text-emerald-800",
    sky: "text-[#2067B0]",
    amber: "text-amber-900",
    rose: "text-rose-900",
    violet: "text-violet-900",
    slate: "text-slate-900"
  }[tone];
  const tileBg = {
    emerald: "border-emerald-300 bg-emerald-50",
    sky: "border-sky-300 bg-sky-50",
    amber: "border-amber-300 bg-amber-50",
    rose: "border-rose-300 bg-rose-50",
    violet: "border-violet-300 bg-violet-50",
    slate: "border-slate-300 bg-white"
  }[tone];
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${tileBg}`}>
      <p className={`font-label text-[10px] font-bold uppercase tracking-[0.1em] ${CHART.muted} sm:text-xs`}>
        {label}
      </p>
      <p className={`mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl ${toneClass}`}>{value}</p>
      {hint && <p className={`mt-1 font-body text-[10px] font-medium ${CHART.muted} sm:text-xs`}>{hint}</p>}
    </div>
  );
}

export function MiniLineTrend({
  points,
  stroke = "#2067B0"
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

/** Modern area + line chart with grid and month labels. */
export function AreaTrendChart({
  items,
  stroke = "#2067B0",
  emptyLabel = "No trend data yet",
  valueSuffix = ""
}: {
  items: { label: string; value: number }[];
  stroke?: string;
  emptyLabel?: string;
  valueSuffix?: string;
}) {
  if (items.length === 0) {
    return <p className={`font-body text-xs font-medium ${CHART.muted}`}>{emptyLabel}</p>;
  }
  const w = 320;
  const h = 140;
  const padX = 8;
  const padY = 12;
  const max = Math.max(...items.map((i) => i.value), 1);
  const min = 0;
  const range = max - min || 1;
  const gradId = `area-grad-${stroke.replace("#", "")}`;

  const points = items.map((item, i) => {
    const x = padX + (i / Math.max(items.length - 1, 1)) * (w - padX * 2);
    const y = padY + (h - padY * 2) - ((item.value - min) / range) * (h - padY * 2);
    return { x, y, ...item };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h - padY} L ${points[0].x} ${h - padY} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full sm:h-40" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={padX}
            x2={w - padX}
            y1={padY + (h - padY * 2) * (1 - pct)}
            y2={padY + (h - padY * 2) * (1 - pct)}
            stroke="#d1d5db"
            strokeWidth="1"
          />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="3.5" fill={stroke} stroke="#ffffff" strokeWidth="1.5" />
        ))}
      </svg>
      <div className={`mt-2 flex justify-between gap-1 font-label text-[10px] font-semibold ${CHART.muted}`}>
        {items.map((item) => (
          <span
            key={item.label}
            className="chart-label min-w-0 truncate text-center"
            title={`${item.label}: ${item.value}${valueSuffix}`}
          >
            {item.label}
          </span>
        ))}
      </div>
      <p className={`mt-2 text-center font-body text-sm font-bold ${CHART.value}`}>
        Latest: {items[items.length - 1].value.toLocaleString()}
        {valueSuffix}
      </p>
    </div>
  );
}

const PIE_COLORS = [
  "#F8B042",
  "#2067B0",
  "#AF52BF",
  "#4DB6AC",
  "#7BB45D",
  "#E85D5D",
  "#2D5A5A",
  "#8B93A1"
];

export function PieChart({
  items,
  emptyLabel = "No data yet",
  size = 140,
  valuePrefix = "",
  variant = "pie",
  centerLabel,
  showLegend = true
}: {
  items: { label: string; value: number }[];
  emptyLabel?: string;
  size?: number;
  valuePrefix?: string;
  variant?: "pie" | "donut";
  centerLabel?: string;
  showLegend?: boolean;
}) {
  if (items.length === 0) {
    return <p className={`font-body text-xs font-medium ${CHART.muted}`}>{emptyLabel}</p>;
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
    <div className={`flex flex-col items-center gap-3 ${showLegend ? "sm:flex-row sm:items-start" : ""}`}>
      <div className="relative shrink-0">
        <svg width={size} height={size} aria-hidden>
          {slices.map((s) => (
            <path key={s.label} d={s.d} fill={s.color} opacity={0.95} />
          ))}
          <circle cx={cx} cy={cy} r={variant === "donut" ? r * 0.58 : r * 0.45} fill="#ffffff" />
        </svg>
        {variant === "donut" && centerLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-lg font-bold tabular-nums text-[#1A1D26]">{centerLabel}</span>
          </div>
        ) : null}
      </div>
      {showLegend ? (
        <ul className="min-w-0 flex-1 space-y-1.5 font-body text-xs">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2">
              <span className={`flex min-w-0 items-center gap-2 font-semibold ${CHART.label}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate capitalize">{s.label.replace(/_/g, " ")}</span>
              </span>
              <span className={`shrink-0 font-bold tabular-nums ${CHART.muted}`}>
                {valuePrefix}
                {typeof s.value === "number" && s.value >= 1000
                  ? s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : s.value}{" "}
                ({s.pct}%)
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Circular progress ring — org readiness, completion %, etc. */
export function RadialProgress({
  value,
  label,
  sublabel,
  color = "#2D5A5A",
  size = 132
}: {
  value: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={center} cy={center} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums text-slate-900">{pct}%</span>
        </div>
      </div>
      <p className={`mt-2 font-body text-sm font-bold ${CHART.label}`}>{label}</p>
      {sublabel ? <p className={`mt-0.5 font-body text-[10px] font-medium ${CHART.muted}`}>{sublabel}</p> : null}
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
  if (items.length === 0) return <p className={`font-body text-xs font-medium ${CHART.muted}`}>{emptyLabel}</p>;
  const max = Math.max(...items.flatMap((i) => [i.a, i.b]), 1);
  return (
    <div>
      <div className={`mb-2 flex gap-3 font-label text-[10px] font-bold ${CHART.muted}`}>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> {labelA}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" /> {labelB}
        </span>
      </div>
      <div className="flex h-40 items-end justify-between gap-1 sm:h-48 sm:gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full max-w-[2.5rem] items-end justify-center gap-0.5">
              <div
                className="w-[42%] rounded-t bg-emerald-600"
                style={{ height: `${Math.max(6, (item.a / max) * 100)}%` }}
                title={`${labelA}: ${item.a}`}
              />
              <div
                className="w-[42%] rounded-t bg-rose-600"
                style={{ height: `${Math.max(6, (item.b / max) * 100)}%` }}
                title={`${labelB}: ${item.b}`}
              />
            </div>
            <span
              className={`chart-label max-w-full truncate font-label text-[9px] font-semibold ${CHART.muted}`}
              title={item.label}
            >
              {item.label.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dual line trend — GemMatrix “This month / Last month” style. */
export function DualLineChart({
  items,
  labelA = "This period",
  labelB = "Prior",
  colorA = "#2067B0",
  colorB = "#E85D5D",
  emptyLabel = "No trend data yet"
}: {
  items: { label: string; a: number; b: number }[];
  labelA?: string;
  labelB?: string;
  colorA?: string;
  colorB?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className={`font-body text-xs font-medium ${CHART.muted}`}>{emptyLabel}</p>;
  }
  const w = 360;
  const h = 160;
  const padX = 12;
  const padY = 16;
  const max = Math.max(...items.flatMap((i) => [i.a, i.b]), 1);

  const toPoint = (value: number, i: number) => {
    const x = padX + (i / Math.max(items.length - 1, 1)) * (w - padX * 2);
    const y = padY + (h - padY * 2) - (value / max) * (h - padY * 2);
    return { x, y };
  };

  const pathFor = (key: "a" | "b") =>
    items
      .map((item, i) => {
        const p = toPoint(item[key], i);
        return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
      })
      .join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full sm:h-44" aria-hidden>
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={padX}
            x2={w - padX}
            y1={padY + (h - padY * 2) * (1 - pct)}
            y2={padY + (h - padY * 2) * (1 - pct)}
            stroke="#E5E9EF"
            strokeWidth="1"
          />
        ))}
        <path d={pathFor("a")} fill="none" stroke={colorA} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor("b")} fill="none" stroke={colorB} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {items.map((item, i) => {
          const pa = toPoint(item.a, i);
          const pb = toPoint(item.b, i);
          return (
            <g key={item.label}>
              <circle cx={pa.x} cy={pa.y} r="3.5" fill={colorA} stroke="#fff" strokeWidth="1.5" />
              <circle cx={pb.x} cy={pb.y} r="3.5" fill={colorB} stroke="#fff" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
      <div className={`mt-1 flex justify-between gap-1 font-label text-[10px] font-semibold ${CHART.muted}`}>
        {items.map((item) => (
          <span key={item.label} className="min-w-0 truncate text-center">
            {item.label}
          </span>
        ))}
      </div>
      <div className={`mt-3 flex justify-center gap-6 font-label text-[11px] font-bold ${CHART.muted}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorA }} />
          {labelA}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorB }} />
          {labelB}
        </span>
      </div>
    </div>
  );
}
