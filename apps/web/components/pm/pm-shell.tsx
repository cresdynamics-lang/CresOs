"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { pmNeu } from "./pm-theme";

export function PmFullscreenPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>;
}

export function PmPageHero({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "PM overview",
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
    <header className={`${pmNeu.pageHero} px-5 py-6 lg:px-8`}>
      {backHref ? (
        <Link href={backHref} className="mb-3 inline-block text-xs font-medium text-teal-400/80 hover:text-teal-300">
          ← {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-400/90">{eyebrow}</p>
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

export function PmKpiBand({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const colClass =
    cols === 2
      ? "grid-cols-2"
      : cols === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : cols === 5
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : "grid-cols-2 lg:grid-cols-4";
  return <div className={`${pmNeu.kpiBand} grid ${colClass}`}>{children}</div>;
}

export function PmKpiCell({
  label,
  value,
  hint,
  tone = "teal"
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "teal" | "amber" | "rose" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-300"
      : tone === "rose"
        ? "text-rose-300"
        : tone === "emerald"
          ? "text-emerald-300"
          : "text-teal-300";
  return (
    <div className={pmNeu.kpiCell}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${toneClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function PmSection({
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
    <section className={`${pmNeu.section} px-5 lg:px-8`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PmDataBlock({ children }: { children: ReactNode }) {
  return <div className={pmNeu.dataBlock}>{children}</div>;
}

export function PmBanner({
  tone = "info",
  title,
  detail,
  action
}: {
  tone?: "info" | "warning";
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  const cls = tone === "warning" ? pmNeu.alertWarning : pmNeu.alertInfo;
  return (
    <div className={`${cls} mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:mx-8`}>
      <div>
        <p className="text-sm font-medium text-slate-100">{title}</p>
        {detail ? <p className="mt-0.5 text-xs text-slate-400">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}
