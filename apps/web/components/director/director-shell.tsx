"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { directorNeu } from "./director-theme";

/** Edge-to-edge within the director workspace scroll area (cancels route shell padding). */
export function DirectorFullscreenPage({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-3 -my-4 flex min-h-0 w-auto min-w-0 flex-1 flex-col sm:-mx-5 sm:-my-5 lg:-mx-6">
      {children}
    </div>
  );
}

export function DirectorPageHero({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Projects",
  badges,
  actions
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={`${directorNeu.pageHero} px-5 py-6 lg:px-8`}>
      {backHref ? (
        <Link href={backHref} className="mb-3 inline-block text-xs font-medium text-sky-400/90 hover:text-sky-300">
          ← {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-400/90">{eyebrow}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 text-sm capitalize text-slate-400">{description}</p> : null}
          {badges ? <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function DirectorSection({
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
    <section className={`${directorNeu.section} px-5 lg:px-8`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">{label}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DirectorBanner({
  tone = "info",
  children,
  action
}: {
  tone?: "info" | "warning" | "danger";
  children: ReactNode;
  action?: ReactNode;
}) {
  const cls =
    tone === "warning" ? directorNeu.alertWarning : tone === "danger" ? directorNeu.alertDanger : directorNeu.alertInfo;
  return (
    <div className={`${cls} mx-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:mx-8`}>
      <div className="min-w-0 text-sm text-slate-200">{children}</div>
      {action}
    </div>
  );
}
