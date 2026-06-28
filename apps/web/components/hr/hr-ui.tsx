"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { hrNeu } from "./hr-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: "border-rose-500/15 bg-[#1a1014]",
    value: "text-rose-300",
    label: "text-slate-400"
  },
  emerald: {
    shell: hrNeu.statEmerald,
    value: "text-emerald-400",
    label: "text-slate-400"
  },
  amber: {
    shell: hrNeu.statAmber,
    value: "text-amber-400",
    label: "text-slate-400"
  },
  rose: {
    shell: hrNeu.statRose,
    value: "text-rose-400",
    label: "text-slate-400"
  },
  sky: {
    shell: "border-sky-500/15 bg-[#10141a]",
    value: "text-sky-400",
    label: "text-slate-400"
  },
  violet: {
    shell: hrNeu.statViolet,
    value: "text-violet-400",
    label: "text-slate-400"
  }
};

export function HrNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? hrNeu.panelInset : hrNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function HrStatCard({
  label,
  value,
  hint,
  tone = "rose",
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

export function HrStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function HrBadge({
  children,
  variant = "default"
}: {
  children: ReactNode;
  variant?: "default" | "role" | "dept" | "status";
}) {
  const cls =
    variant === "role"
      ? "bg-slate-700/80 text-slate-200"
      : variant === "dept"
        ? "bg-rose-950/60 text-rose-200 border border-rose-500/20"
        : variant === "status"
          ? "bg-emerald-950/50 text-emerald-200 border border-emerald-500/20"
          : "bg-slate-800/80 text-slate-300";
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function HrAvatar({ name, email }: { name: string | null; email: string }) {
  const initial = (name?.trim() || email).charAt(0).toUpperCase();
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600/30 to-pink-700/20 text-sm font-bold text-rose-200 ring-1 ring-rose-500/25"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function HrFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </label>
  );
}

export function HrInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={`w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] focus:border-rose-500/35 focus:outline-none focus:ring-2 focus:ring-rose-500/15 ${className}`}
      {...props}
    />
  );
}

export function HrSelect({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <select
      className={`w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] focus:border-rose-500/35 focus:outline-none focus:ring-2 focus:ring-rose-500/15 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
