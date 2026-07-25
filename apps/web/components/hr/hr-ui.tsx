"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { hrNeu } from "./hr-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: "border-rose-500/15 bg-[#1a1014]",
    value: "text-[#C62828]",
    label: "text-[#5B6472]"
  },
  emerald: {
    shell: hrNeu.statEmerald,
    value: "text-[#1B6B3A]",
    label: "text-[#5B6472]"
  },
  amber: {
    shell: hrNeu.statAmber,
    value: "text-[#B45309]",
    label: "text-[#5B6472]"
  },
  rose: {
    shell: hrNeu.statRose,
    value: "text-[#C62828]",
    label: "text-[#5B6472]"
  },
  sky: {
    shell: "border-sky-500/15 bg-white",
    value: "text-[#2563EB]",
    label: "text-[#5B6472]"
  },
  violet: {
    shell: hrNeu.statViolet,
    value: "text-[#6D28D9]",
    label: "text-[#5B6472]"
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
        {hint ? <p className="mt-1 text-[11px] text-[#5B6472] sm:text-xs">{hint}</p> : null}
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
      ? "bg-slate-700/80 text-[#1A1D26]"
      : variant === "dept"
        ? "bg-[#FEF2F2] text-[#C62828] border border-rose-500/20"
        : variant === "status"
          ? "bg-[#F2F9EF] text-[#1B6B3A] border border-emerald-500/20"
          : "bg-[#F4F7F9] text-[#5B6472]";
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
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600/30 to-pink-700/20 text-sm font-bold text-[#C62828] ring-1 ring-rose-500/25"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function HrFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5B6472]">
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
      className={`w-full rounded-xl border border-[#E5E9EF] bg-white px-3 py-2.5 text-sm text-[#1A1D26] shadow-[inset_3px_3px_8px_rgba(15,23,42,0.06)] focus:border-rose-500/35 focus:outline-none focus:ring-2 focus:ring-rose-500/15 ${className}`}
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
      className={`w-full rounded-xl border border-[#E5E9EF] bg-white px-3 py-2.5 text-sm text-[#1A1D26] shadow-[inset_3px_3px_8px_rgba(15,23,42,0.06)] focus:border-rose-500/35 focus:outline-none focus:ring-2 focus:ring-rose-500/15 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
