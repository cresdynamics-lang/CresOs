"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { salesNeu } from "./sales-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: "border-brand/15 bg-[#10141a]",
    value: "text-brand",
    label: "text-slate-400"
  },
  emerald: {
    shell: salesNeu.statEmerald,
    value: "text-emerald-400",
    label: "text-slate-400"
  },
  amber: {
    shell: salesNeu.statAmber,
    value: "text-amber-400",
    label: "text-slate-400"
  },
  rose: {
    shell: salesNeu.statRose,
    value: "text-rose-400",
    label: "text-slate-400"
  },
  sky: {
    shell: salesNeu.statSky,
    value: "text-sky-400",
    label: "text-slate-400"
  },
  violet: {
    shell: salesNeu.statViolet,
    value: "text-violet-400",
    label: "text-slate-400"
  }
};

export function SalesNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? salesNeu.panelInset : salesNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function SalesStatCard({
  label,
  value,
  hint,
  tone = "amber",
  className = ""
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  const s = statToneClass[tone];
  return (
    <div
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-2xl border p-4 ${s.shell} ${className}`.trim()}
    >
      <p className={`text-xs font-medium uppercase tracking-wide ${s.label}`}>{label}</p>
      <div>
        <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

export function SalesStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function SalesStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid w-full grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function SalesStatInline({
  label,
  value,
  hint,
  tone = "amber"
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
}) {
  const s = statToneClass[tone];
  return (
    <div className="min-w-0">
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
    </div>
  );
}
