"use client";

import type { ReactNode } from "react";

export type StatTone = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet";

const toneStyles: Record<
  StatTone,
  { border: string; bg: string; value: string; label: string }
> = {
  brand: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    value: "text-[#2D5A5A]",
    label: "text-[#5B6472]"
  },
  emerald: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    value: "text-[#1B6B3A]",
    label: "text-[#5B6472]"
  },
  amber: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    value: "text-[#B45309]",
    label: "text-[#5B6472]"
  },
  rose: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    value: "text-[#C62828]",
    label: "text-[#5B6472]"
  },
  sky: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    value: "text-[#1A1D26]",
    label: "text-[#5B6472]"
  },
  violet: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    value: "text-[#2D5A5A]",
    label: "text-[#5B6472]"
  }
};

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
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
  const s = toneStyles[tone];
  return (
    <div
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-xl border p-4 shadow-sm ${s.border} ${s.bg} ${className}`.trim()}
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

export function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
  );
}
