"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { adminNeu } from "./admin-theme";

const statToneClass: Record<StatTone, { value: string; label: string }> = {
  brand: { value: "text-[#0b4a8f]", label: "text-[#424242]" },
  emerald: { value: "text-[#0b5c15]", label: "text-[#424242]" },
  amber: { value: "text-[#8a5300]", label: "text-[#424242]" },
  rose: { value: "text-[#a4262c]", label: "text-[#424242]" },
  sky: { value: "text-[#0b4a8f]", label: "text-[#424242]" },
  violet: { value: "text-[#5c2e91]", label: "text-[#424242]" }
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
      <p className={`text-[10px] font-bold uppercase tracking-wide ${s.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] font-medium text-[#616161] sm:text-xs">{hint}</p> : null}
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
    <label className="mb-1 block text-xs font-semibold text-[#242424]">{children}</label>
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
