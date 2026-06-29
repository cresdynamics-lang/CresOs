"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { dashboardNeu } from "./dashboard-theme";

const toneValue: Record<StatTone, string> = {
  brand: "text-brand",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  sky: "text-sky-400",
  violet: "text-violet-400"
};

const toneBar: Record<StatTone, string> = {
  brand: "bg-brand",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500"
};

const toneAccent: Record<StatTone, string> = {
  brand: "from-brand/20 to-transparent",
  emerald: "from-emerald-500/15 to-transparent",
  amber: "from-amber-500/15 to-transparent",
  rose: "from-rose-500/15 to-transparent",
  sky: "from-sky-500/15 to-transparent",
  violet: "from-violet-500/15 to-transparent"
};

export function DashboardNeuKpiTile({
  label,
  value,
  hint,
  tone = "brand",
  href,
  active = false,
  visual
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  href?: string;
  active?: boolean;
  visual?: "number" | "bar";
}) {
  const numeric =
    typeof value === "number" ? value : parseInt(String(value).replace(/%/g, ""), 10) || 0;
  const display = visual === "bar" ? `${numeric}%` : value;

  const inner = (
    <div
      className={`${dashboardNeu.kpiTile} ${active ? dashboardNeu.kpiTileActive : ""} h-full`.trim()}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b ${toneAccent[tone]}`}
        aria-hidden
      />
      <p className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`relative text-2xl font-bold tabular-nums sm:text-3xl ${toneValue[tone]}`}>{display}</p>
      {visual === "bar" ? (
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800/90">
          <div
            className={`h-full rounded-full transition-all ${toneBar[tone]}`}
            style={{ width: `${Math.min(100, Math.max(0, numeric))}%` }}
          />
        </div>
      ) : null}
      {hint ? <p className="relative text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full min-h-[6.25rem]">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function DashboardQueueEmpty({ children }: { children?: ReactNode }) {
  return (
    <div className={dashboardNeu.queueEmpty}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.35)]"
        aria-hidden
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-emerald-100">You&apos;re all caught up</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          {children ?? "Nothing urgent in your automatic queue — explore the command center below for the full picture."}
        </p>
      </div>
    </div>
  );
}

export function DashboardQueueList({ children }: { children: ReactNode }) {
  return <ul className="grid gap-2.5 sm:grid-cols-2">{children}</ul>;
}

export function DashboardQueueItem({ children }: { children: ReactNode }) {
  return <li className={`${dashboardNeu.queueItem} text-sm leading-relaxed text-slate-300`}>{children}</li>;
}
