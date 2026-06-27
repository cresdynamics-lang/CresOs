"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { salesWs } from "./sales-theme";

const toneClass: Record<StatTone, { value: string; label: string }> = {
  brand: { value: "text-brand", label: "text-slate-400" },
  emerald: { value: "text-emerald-400", label: "text-slate-400" },
  amber: { value: "text-amber-400", label: "text-slate-400" },
  rose: { value: "text-rose-400", label: "text-slate-400" },
  sky: { value: "text-sky-400", label: "text-slate-400" },
  violet: { value: "text-violet-400", label: "text-slate-400" }
};

export function SalesStatRow({ children }: { children: ReactNode }) {
  return <div className={salesWs.statRow}>{children}</div>;
}

export function SalesStatInline({
  label,
  value,
  hint,
  tone = "brand"
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
}) {
  const s = toneClass[tone];
  return (
    <div className="min-w-0">
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
    </div>
  );
}
