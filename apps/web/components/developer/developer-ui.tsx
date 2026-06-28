"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { devNeu } from "./developer-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: "border-brand/15 bg-[#10141a]",
    value: "text-brand",
    label: "text-slate-400"
  },
  emerald: {
    shell: devNeu.statEmerald,
    value: "text-emerald-400",
    label: "text-slate-400"
  },
  amber: {
    shell: devNeu.statAmber,
    value: "text-amber-400",
    label: "text-slate-400"
  },
  rose: {
    shell: devNeu.statRose,
    value: "text-rose-400",
    label: "text-slate-400"
  },
  sky: {
    shell: devNeu.statSky,
    value: "text-sky-400",
    label: "text-slate-400"
  },
  violet: {
    shell: devNeu.statViolet,
    value: "text-violet-400",
    label: "text-slate-400"
  }
};

export function DevNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? devNeu.panelInset : devNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function DevStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DevStatInline({
  label,
  value,
  hint,
  tone = "violet"
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
