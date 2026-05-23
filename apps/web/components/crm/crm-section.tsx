"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { StatTone } from "../stat-card";

const tonePanel: Record<
  StatTone,
  { border: string; bg: string; title: string; label: string; tabActive: string; tabIdle: string }
> = {
  brand: {
    border: "border-brand/35",
    bg: "bg-gradient-to-br from-brand/10 via-slate-950/90 to-slate-950",
    title: "text-brand",
    label: "text-brand/90",
    tabActive: "border-brand/50 bg-brand/15 text-brand shadow-[0_0_20px_-6px_rgba(99,102,241,0.4)]",
    tabIdle: "border-slate-700/80 text-slate-400 hover:border-brand/30 hover:bg-brand/5 hover:text-slate-200"
  },
  sky: {
    border: "border-sky-500/35",
    bg: "bg-gradient-to-br from-sky-500/10 via-slate-950/90 to-slate-950",
    title: "text-sky-400",
    label: "text-sky-400/90",
    tabActive: "border-sky-500/50 bg-sky-500/15 text-sky-300 shadow-[0_0_20px_-6px_rgba(14,165,233,0.35)]",
    tabIdle: "border-slate-700/80 text-slate-400 hover:border-sky-500/30 hover:bg-sky-500/5 hover:text-slate-200"
  },
  amber: {
    border: "border-amber-500/35",
    bg: "bg-gradient-to-br from-amber-500/10 via-slate-950/90 to-slate-950",
    title: "text-amber-400",
    label: "text-amber-400/90",
    tabActive: "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_20px_-6px_rgba(245,158,11,0.35)]",
    tabIdle: "border-slate-700/80 text-slate-400 hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-slate-200"
  },
  emerald: {
    border: "border-emerald-500/35",
    bg: "bg-gradient-to-br from-emerald-500/10 via-slate-950/90 to-slate-950",
    title: "text-emerald-400",
    label: "text-emerald-400/90",
    tabActive: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.35)]",
    tabIdle: "border-slate-700/80 text-slate-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-slate-200"
  },
  violet: {
    border: "border-violet-500/35",
    bg: "bg-gradient-to-br from-violet-500/10 via-slate-950/90 to-slate-950",
    title: "text-violet-400",
    label: "text-violet-400/90",
    tabActive: "border-violet-500/50 bg-violet-500/15 text-violet-300 shadow-[0_0_20px_-6px_rgba(139,92,246,0.35)]",
    tabIdle: "border-slate-700/80 text-slate-400 hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-slate-200"
  },
  rose: {
    border: "border-rose-500/35",
    bg: "bg-gradient-to-br from-rose-500/10 via-slate-950/90 to-slate-950",
    title: "text-rose-400",
    label: "text-rose-400/90",
    tabActive: "border-rose-500/50 bg-rose-500/15 text-rose-300 shadow-[0_0_20px_-6px_rgba(244,63,94,0.35)]",
    tabIdle: "border-slate-700/80 text-slate-400 hover:border-rose-500/30 hover:bg-rose-500/5 hover:text-slate-200"
  }
};

export type CrmTabDef = {
  key: string;
  label: string;
  tone: StatTone;
  icon: string;
};

export function CrmTabBar({
  tabs,
  active,
  onChange
}: {
  tabs: CrmTabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 sm:p-4">
      <p className="mb-3 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
        CRM sections
      </p>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const s = tonePanel[t.tone];
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                isActive ? s.tabActive : s.tabIdle
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  isActive ? s.tabActive : "bg-slate-800/80 text-slate-300"
                }`}
              >
                {t.icon}
              </span>
              <span className="font-display tracking-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CrmSectionPanel({
  title,
  tone = "sky",
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  tone?: StatTone;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const s = tonePanel[tone];
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5 ${s.border} ${s.bg} ${className}`.trim()}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`font-display text-lg font-bold tracking-tight sm:text-xl ${s.title}`}>{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function CrmDataTable({
  children,
  emptyMessage,
  isEmpty
}: {
  children: ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 px-4 py-10 text-center">
        <p className="font-display text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/40">{children}</div>
  );
}

export function CrmTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-700/80 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {children}
      </tr>
    </thead>
  );
}

/** Colored info card (guidelines, policies) — not a navigation link. */
export function WorkspaceGuidelineCard({
  title,
  description,
  tone
}: {
  title: string;
  description: string;
  tone: StatTone;
}) {
  const s = tonePanel[tone];
  return (
    <div
      className={`flex h-full min-h-[9rem] flex-col rounded-2xl border p-4 sm:p-5 ${s.border} ${s.bg}`}
    >
      <h4 className={`font-display text-base font-bold tracking-tight ${s.title}`}>{title}</h4>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

export function WorkspaceFilterPills<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string; tone: StatTone }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const s = tonePanel[opt.tone];
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
              active ? s.tabActive : s.tabIdle
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CrmSectionQuickCard({
  label,
  description,
  tone,
  icon,
  active,
  onClick
}: {
  label: string;
  description: string;
  tone: StatTone;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  const s = tonePanel[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full min-h-[7.5rem] w-full min-w-[9.5rem] flex-col rounded-2xl border p-4 text-left transition-all ${s.border} ${s.bg} ${
        active ? s.tabActive : s.tabIdle
      }`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${s.tabActive}`}>
        {icon}
      </span>
      <span className={`mt-3 font-display text-base font-bold ${s.title}`}>{label}</span>
      <span className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{description}</span>
      {active ? (
        <span className={`mt-2 text-[10px] font-semibold uppercase tracking-wide ${s.label}`}>Active</span>
      ) : null}
    </button>
  );
}

export function CrmActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
    >
      {children}
    </Link>
  );
}
