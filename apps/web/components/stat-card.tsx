"use client";

import type { ReactNode } from "react";

export type StatTone = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet";

const toneStyles: Record<
  StatTone,
  { border: string; bg: string; value: string; label: string }
> = {
  brand: {
    border: "border-brand/35",
    bg: "bg-brand/10",
    value: "text-brand",
    label: "text-slate-300"
  },
  emerald: {
    border: "border-emerald-500/35",
    bg: "bg-emerald-500/10",
    value: "text-emerald-400",
    label: "text-slate-300"
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    value: "text-amber-400",
    label: "text-slate-300"
  },
  rose: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    value: "text-rose-400",
    label: "text-slate-300"
  },
  sky: {
    border: "border-sky-500/35",
    bg: "bg-sky-500/10",
    value: "text-sky-400",
    label: "text-slate-300"
  },
  violet: {
    border: "border-violet-500/35",
    bg: "bg-violet-500/10",
    value: "text-violet-400",
    label: "text-slate-300"
  }
};

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
  icon,
  className = ""
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  icon?: ReactNode;
  className?: string;
}) {
  const s = toneStyles[tone];
  return (
    <div
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-xl border p-4 shadow-sm ${s.border} ${s.bg} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-medium uppercase tracking-wide ${s.label}`}>{label}</p>
        {icon ? <span className="text-lg opacity-80">{icon}</span> : null}
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

export function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
  );
}
