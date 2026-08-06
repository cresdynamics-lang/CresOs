"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { adminAccents, type AdminAccent } from "../admin/admin-theme";
import { directorNeu } from "./director-theme";

const toneToAccent: Record<StatTone, AdminAccent> = {
  brand: "blue",
  sky: "blue",
  emerald: "green",
  amber: "yellow",
  rose: "red",
  violet: "purple"
};

export function DirectorStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 ${className}`.trim()}>
      {children}
    </div>
  );
}

/** Same compact Fluent KPI card as Admin — solid left accent, white body. */
export function DirectorStatInline({
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
  const accent = adminAccents[toneToAccent[tone] ?? "blue"];
  return (
    <div
      className="relative flex min-h-[4.25rem] min-w-0 flex-col justify-between overflow-hidden rounded-md border bg-white px-2.5 py-2 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06),0_1.2px_2.8px_rgba(0,0,0,0.06)]"
      style={{ borderColor: accent.border, borderLeftWidth: 3, borderLeftColor: accent.solid }}
    >
      <p className="font-label text-[10px] font-semibold leading-tight tracking-wide text-[#605E5C]">{label}</p>
      <div>
        <p
          className="font-display text-lg font-bold tabular-nums leading-none tracking-tight sm:text-xl"
          style={{ color: accent.solid }}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 font-body text-[10px] font-medium leading-tight text-[#8A8886]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DirectorPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return <div className={`${inset ? directorNeu.panelInset : directorNeu.panel} ${className}`.trim()}>{children}</div>;
}

export { directorNeu };
