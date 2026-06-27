"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { financeNeu } from "./finance-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: "border-brand/15 bg-[#10141a]",
    value: "text-brand",
    label: "text-slate-400"
  },
  emerald: {
    shell: financeNeu.statEmerald,
    value: "text-emerald-400",
    label: "text-slate-400"
  },
  amber: {
    shell: financeNeu.statAmber,
    value: "text-amber-400",
    label: "text-slate-400"
  },
  rose: {
    shell: financeNeu.statRose,
    value: "text-rose-400",
    label: "text-slate-400"
  },
  sky: {
    shell: "border-sky-500/15 bg-[#10141a]",
    value: "text-sky-400",
    label: "text-slate-400"
  },
  violet: {
    shell: financeNeu.statViolet,
    value: "text-violet-400",
    label: "text-slate-400"
  }
};

export function FinanceNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? financeNeu.panelInset : financeNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function FinanceStatCard({
  label,
  value,
  hint,
  tone = "emerald",
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
  const s = statToneClass[tone];
  return (
    <div
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-2xl border p-4 ${s.shell} ${className}`.trim()}
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

export function FinanceStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function FinanceStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-6 gap-y-4 border-b border-white/[0.06] pb-6 sm:grid-cols-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function FinanceStatInline({
  label,
  value,
  hint,
  tone = "emerald",
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
    <div className={`min-w-0 ${className}`.trim()}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
    </div>
  );
}

export function FinanceNeuListRow({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <li className={`${financeNeu.listRow} ${className}`.trim()}>{children}</li>;
}

export { financeNeu };
