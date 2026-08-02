"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { salesNeu } from "./sales-theme";

/** Same solid Fluent tones as developer KPIs. */
const statToneSolid: Record<StatTone, { solid: string; border: string }> = {
  brand: { solid: "#005CAB", border: "#B4CDE8" },
  sky: { solid: "#005CAB", border: "#B4CDE8" },
  emerald: { solid: "#0B6A0B", border: "#A8D5A8" },
  amber: { solid: "#C19C00", border: "#E8D48A" },
  rose: { solid: "#C50F1F", border: "#E8A0A6" },
  violet: { solid: "#5C2D91", border: "#C5B0DF" }
};

export function SalesNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? salesNeu.panelInset : salesNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function SalesStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

export function SalesStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-4 ${className}`.trim()}>{children}</div>
  );
}

/** Compact left-edge KPI card — matches developer dashboard stats. */
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
  const s = statToneSolid[tone];
  return (
    <div
      className="flex min-h-[3.75rem] h-full flex-col justify-between rounded-md border bg-white px-2.5 py-2"
      style={{ borderColor: s.border, borderLeftWidth: 3, borderLeftColor: s.solid }}
    >
      <p className="text-[10px] font-semibold leading-tight tracking-wide text-[#605E5C]">{label}</p>
      <div>
        <p
          className="text-lg font-semibold tabular-nums leading-none tracking-tight sm:text-xl"
          style={{ color: s.solid }}
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[10px] font-medium leading-tight text-[#8A8886]">{hint}</p> : null}
      </div>
    </div>
  );
}

export function SalesStatCard({
  label,
  value,
  hint,
  tone = "brand",
  className = ""
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={className}>
      <SalesStatInline label={label} value={value} hint={hint} tone={tone} />
    </div>
  );
}

export { salesNeu };
