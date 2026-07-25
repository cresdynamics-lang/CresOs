"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { adminNeu } from "./admin-theme";

const statToneClass: Record<StatTone, { value: string; label: string }> = {
  brand: { value: "text-brand", label: "text-slate-500" },
  emerald: { value: "text-emerald-700", label: "text-slate-500" },
  amber: { value: "text-amber-700", label: "text-slate-500" },
  rose: { value: "text-rose-700", label: "text-slate-500" },
  sky: { value: "text-brand", label: "text-slate-500" },
  violet: { value: "text-violet-700", label: "text-slate-500" }
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
  return <input className={`w-full ${adminNeu.input} ${className}`.trim()} {...props} />;
}

export function AdminSelect({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <select className={`w-full ${adminNeu.input} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function AdminTextarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea className={`w-full ${adminNeu.input} ${className}`.trim()} {...props} />;
}
