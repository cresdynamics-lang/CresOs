"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { adminNeu } from "./admin-theme";

const statToneClass: Record<StatTone, { value: string; label: string }> = {
  brand: { value: "text-brand", label: "text-slate-400" },
  emerald: { value: "text-emerald-400", label: "text-slate-400" },
  amber: { value: "text-amber-400", label: "text-slate-400" },
  rose: { value: "text-rose-400", label: "text-slate-400" },
  sky: { value: "text-indigo-400", label: "text-slate-400" },
  violet: { value: "text-violet-400", label: "text-slate-400" }
};

export function AdminStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AdminStatInline({
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

export function AdminPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? adminNeu.panelInset : adminNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function AdminFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </label>
  );
}

export function AdminInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={`w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] focus:border-indigo-500/35 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 ${className}`}
      {...props}
    />
  );
}

export function AdminSelect({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <select
      className={`w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] focus:border-indigo-500/35 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
