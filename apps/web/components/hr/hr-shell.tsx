"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { StatTone } from "../stat-card";
import { hrNeu } from "./hr-theme";

const kpiValueTone: Record<StatTone, string> = {
  brand: "text-rose-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
  violet: "text-violet-300"
};

/** Full-bleed page shell — no card padding, edge-to-edge sections. */
export function HrFullscreenPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>;
}

export function HrPageHero({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "HR overview",
  actions
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={`${hrNeu.pageHero} px-5 py-6 lg:px-8`}>
      {backHref ? (
        <Link href={backHref} className="mb-3 inline-block text-xs font-medium text-rose-400/80 hover:text-rose-300">
          ← {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-400/90">{eyebrow}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Inline KPI band — no cards, divided columns. */
export function HrKpiBand({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass =
    cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4";
  return <div className={`${hrNeu.kpiBand} grid ${colClass}`}>{children}</div>;
}

export function HrKpiCell({
  label,
  value,
  hint,
  tone = "rose"
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className={hrNeu.kpiCell}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${kpiValueTone[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function HrSection({
  label,
  description,
  children,
  action
}: {
  label: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={hrNeu.section}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-5 lg:px-8">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400/85">{label}</h2>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HrQuickNav({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <nav
      aria-label="Quick links"
      className="flex flex-wrap gap-2 border-b border-white/[0.06] px-5 py-4 lg:px-8"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`${hrNeu.navIdle} rounded-lg px-3 py-2 text-sm font-medium touch-manipulation`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Chart zone — flat, border-only, no rounded card chrome. */
export function HrChartZone({
  title,
  subtitle,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${hrNeu.chartZone} ${className}`.trim()}>
      <div className="mb-4 px-5 lg:px-8">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400/80">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex min-h-[min(16rem,36vh)] flex-1 flex-col justify-center px-5 pb-6 lg:px-8">{children}</div>
    </div>
  );
}

/** Full-width data block — tables and lists without card wrapper. */
export function HrDataBlock({
  title,
  description,
  toolbar,
  children
}: {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={hrNeu.dataBlock}>
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        {toolbar}
      </div>
      {children}
    </div>
  );
}

export function HrBanner({
  children,
  tone = "danger"
}: {
  children: ReactNode;
  tone?: "danger" | "success" | "info";
}) {
  const cls =
    tone === "danger"
      ? "border-rose-500/30 bg-rose-950/25 text-rose-200"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-950/25 text-emerald-200"
        : "border-rose-500/20 bg-rose-950/15 text-rose-100";
  return <p className={`border-y px-5 py-3 text-sm lg:px-8 ${cls}`}>{children}</p>;
}
