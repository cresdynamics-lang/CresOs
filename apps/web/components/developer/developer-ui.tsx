"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { devNeu } from "./developer-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: devNeu.statBrand,
    value: "text-[#2D5A5A]",
    label: "text-[#5B6472]"
  },
  emerald: {
    shell: devNeu.statEmerald,
    value: "text-[#1B6B3A]",
    label: "text-[#5B6472]"
  },
  amber: {
    shell: devNeu.statAmber,
    value: "text-[#B45309]",
    label: "text-[#5B6472]"
  },
  rose: {
    shell: devNeu.statRose,
    value: "text-[#C62828]",
    label: "text-[#5B6472]"
  },
  sky: {
    shell: devNeu.statSky,
    value: "text-[#2D5A5A]",
    label: "text-[#5B6472]"
  },
  violet: {
    shell: devNeu.statViolet,
    value: "text-[#2D5A5A]",
    label: "text-[#5B6472]"
  }
};

export function DevNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? devNeu.panelInset : devNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function DevStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DevStatInline({
  label,
  value,
  hint,
  tone = "violet"
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
      {hint ? <p className="mt-0.5 text-[11px] text-[#5B6472] sm:text-xs">{hint}</p> : null}
    </div>
  );
}
