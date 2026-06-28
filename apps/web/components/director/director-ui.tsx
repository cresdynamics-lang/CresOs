"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { directorNeu } from "./director-theme";

const statToneClass: Record<StatTone, { value: string; label: string }> = {
  brand: { value: "text-brand", label: "text-slate-400" },
  emerald: { value: "text-emerald-400", label: "text-slate-400" },
  amber: { value: "text-amber-400", label: "text-slate-400" },
  rose: { value: "text-rose-400", label: "text-slate-400" },
  sky: { value: "text-sky-400", label: "text-slate-400" },
  violet: { value: "text-violet-400", label: "text-slate-400" }
};

export function DirectorStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DirectorStatInline({
  label,
  value,
  hint,
  tone = "sky"
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

export function DirectorPanel({ children, className = "", inset = false }: { children: ReactNode; className?: string; inset?: boolean }) {
  return <div className={`${inset ? directorNeu.panelInset : directorNeu.panel} ${className}`.trim()}>{children}</div>;
}
