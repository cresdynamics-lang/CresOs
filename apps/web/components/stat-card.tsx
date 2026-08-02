"use client";

import type { ReactNode } from "react";

export type StatTone = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet";

/** Deep solids matching admin dashboard palette. */
const toneStyles: Record<
  StatTone,
  { solid: string; border: string }
> = {
  brand: { solid: "#005CAB", border: "#B4CDE8" },
  sky: { solid: "#005CAB", border: "#B4CDE8" },
  emerald: { solid: "#0B6A0B", border: "#A8D5A8" },
  amber: { solid: "#C19C00", border: "#E8D48A" },
  rose: { solid: "#C50F1F", border: "#E8A0A6" },
  violet: { solid: "#5C2D91", border: "#C5B0DF" }
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
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-lg border bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] ${className}`.trim()}
      style={{ borderColor: s.border, borderLeftWidth: 4, borderLeftColor: s.solid }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#605E5C]">{label}</p>
        {icon ? <span className="text-lg" style={{ color: s.solid }}>{icon}</span> : null}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: s.solid }}>
          {value}
        </p>
        {hint ? <p className="mt-1 text-[11px] text-[#8A8886] sm:text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

export function StatCardGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`.trim()}>
      {children}
    </div>
  );
}
