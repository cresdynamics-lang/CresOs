"use client";

import Link from "next/link";
import type { StatTone } from "./stat-card";

const toneStyles: Record<
  StatTone,
  {
    border: string;
    bg: string;
    hover: string;
    title: string;
    iconBg: string;
    button: string;
    buttonHover: string;
    arrow: string;
  }
> = {
  brand: {
    border: "border-brand/40",
    bg: "bg-gradient-to-br from-brand/15 via-slate-900/80 to-slate-950",
    hover: "hover:border-brand/60 hover:shadow-[0_8px_32px_-8px_rgba(99,102,241,0.45)]",
    title: "text-brand",
    iconBg: "bg-brand/20 text-brand",
    button: "bg-brand text-white",
    buttonHover: "hover:bg-brand/90",
    arrow: "text-brand/80"
  },
  emerald: {
    border: "border-emerald-500/40",
    bg: "bg-gradient-to-br from-emerald-500/12 via-slate-900/80 to-slate-950",
    hover: "hover:border-emerald-500/60 hover:shadow-[0_8px_32px_-8px_rgba(16,185,129,0.4)]",
    title: "text-emerald-400",
    iconBg: "bg-emerald-500/20 text-emerald-400",
    button: "bg-emerald-600 text-white",
    buttonHover: "hover:bg-emerald-500",
    arrow: "text-emerald-400/80"
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-gradient-to-br from-amber-500/12 via-slate-900/80 to-slate-950",
    hover: "hover:border-amber-500/60 hover:shadow-[0_8px_32px_-8px_rgba(245,158,11,0.4)]",
    title: "text-amber-400",
    iconBg: "bg-amber-500/20 text-amber-400",
    button: "bg-amber-600 text-white",
    buttonHover: "hover:bg-amber-500",
    arrow: "text-amber-400/80"
  },
  rose: {
    border: "border-rose-500/40",
    bg: "bg-gradient-to-br from-rose-500/12 via-slate-900/80 to-slate-950",
    hover: "hover:border-rose-500/60 hover:shadow-[0_8px_32px_-8px_rgba(244,63,94,0.4)]",
    title: "text-rose-400",
    iconBg: "bg-rose-500/20 text-rose-400",
    button: "bg-rose-600 text-white",
    buttonHover: "hover:bg-rose-500",
    arrow: "text-rose-400/80"
  },
  sky: {
    border: "border-sky-500/40",
    bg: "bg-gradient-to-br from-sky-500/12 via-slate-900/80 to-slate-950",
    hover: "hover:border-sky-500/60 hover:shadow-[0_8px_32px_-8px_rgba(14,165,233,0.4)]",
    title: "text-sky-400",
    iconBg: "bg-sky-500/20 text-sky-400",
    button: "bg-sky-600 text-white",
    buttonHover: "hover:bg-sky-500",
    arrow: "text-sky-400/80"
  },
  violet: {
    border: "border-violet-500/40",
    bg: "bg-gradient-to-br from-violet-500/12 via-slate-900/80 to-slate-950",
    hover: "hover:border-violet-500/60 hover:shadow-[0_8px_32px_-8px_rgba(139,92,246,0.4)]",
    title: "text-violet-400",
    iconBg: "bg-violet-500/20 text-violet-400",
    button: "bg-violet-600 text-white",
    buttonHover: "hover:bg-violet-500",
    arrow: "text-violet-400/80"
  }
};

export type WorkspaceHubCardProps = {
  href: string;
  title: string;
  description: string;
  action: string;
  tone?: StatTone;
  icon: string;
};

export function WorkspaceHubCard({
  href,
  title,
  description,
  action,
  tone = "brand",
  icon
}: WorkspaceHubCardProps) {
  const s = toneStyles[tone];

  return (
    <Link
      href={href}
      className={`group relative flex h-full min-h-[11rem] flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-200 sm:min-h-[12.5rem] sm:p-6 ${s.border} ${s.bg} ${s.hover} hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl ${s.iconBg.split(" ")[0]}`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold ${s.iconBg}`}
        >
          {icon}
        </span>
        <span className={`mt-1 text-xl opacity-0 transition-opacity group-hover:opacity-100 ${s.arrow}`} aria-hidden>
          →
        </span>
      </div>
      <h2 className={`relative mt-4 font-display text-xl font-bold tracking-tight sm:text-2xl ${s.title}`}>
        {title}
      </h2>
      <p className="relative mt-2 flex-1 text-sm leading-relaxed text-slate-400 group-hover:text-slate-300">
        {description}
      </p>
      <span
        className={`relative mt-5 inline-flex w-fit items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${s.button} ${s.buttonHover}`}
      >
        {action}
      </span>
    </Link>
  );
}
