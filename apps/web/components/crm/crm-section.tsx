"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { StatTone } from "../stat-card";

const tonePanel: Record<
  StatTone,
  { border: string; bg: string; title: string; label: string; tabActive: string; tabIdle: string; accent: string }
> = {
  brand: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    title: "text-[#1A1D26]",
    label: "text-[#2D5A5A]",
    accent: "bg-[#E8F0F0] text-[#2D5A5A]",
    tabActive: "border-[#2D5A5A] bg-[#2D5A5A] text-white",
    tabIdle: "border-[#E5E9EF] bg-white text-[#5B6472] hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
  },
  sky: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    title: "text-[#1A1D26]",
    label: "text-[#2D5A5A]",
    accent: "bg-[#E8F0F0] text-[#2D5A5A]",
    tabActive: "border-[#2D5A5A] bg-[#2D5A5A] text-white",
    tabIdle: "border-[#E5E9EF] bg-white text-[#5B6472] hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
  },
  amber: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    title: "text-[#1A1D26]",
    label: "text-[#5B6472]",
    accent: "bg-[#FEF3E8] text-[#B45309]",
    tabActive: "border-[#2D5A5A] bg-[#2D5A5A] text-white",
    tabIdle: "border-[#E5E9EF] bg-white text-[#5B6472] hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
  },
  emerald: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    title: "text-[#1A1D26]",
    label: "text-[#5B6472]",
    accent: "bg-[#E8F5EE] text-[#1B6B3A]",
    tabActive: "border-[#2D5A5A] bg-[#2D5A5A] text-white",
    tabIdle: "border-[#E5E9EF] bg-white text-[#5B6472] hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
  },
  violet: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    title: "text-[#1A1D26]",
    label: "text-[#5B6472]",
    accent: "bg-[#E8F0F0] text-[#2D5A5A]",
    tabActive: "border-[#2D5A5A] bg-[#2D5A5A] text-white",
    tabIdle: "border-[#E5E9EF] bg-white text-[#5B6472] hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
  },
  rose: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    title: "text-[#1A1D26]",
    label: "text-[#5B6472]",
    accent: "bg-[#FEF2F2] text-[#C62828]",
    tabActive: "border-[#2D5A5A] bg-[#2D5A5A] text-white",
    tabIdle: "border-[#E5E9EF] bg-white text-[#5B6472] hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
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
    <div className="rounded-2xl border border-[#E5E9EF] bg-white p-3 sm:p-4">
      <p className="mb-3 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-[#5B6472]">
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
                  isActive ? "bg-white/20 text-white" : s.accent
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
      className={`min-w-0 overflow-hidden rounded-2xl border border-[#E5E9EF] bg-white p-4 shadow-sm sm:p-5 ${className}`.trim()}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`font-display text-lg font-bold tracking-tight sm:text-xl ${s.title}`}>{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-[#5B6472]">{description}</p> : null}
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
      <div className="rounded-xl border border-dashed border-[#E5E9EF] bg-[#F4F7F9] px-4 py-10 text-center">
        <p className="font-display text-sm font-medium text-[#5B6472]">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5E9EF] bg-white">{children}</div>
  );
}

export function CrmTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[#E5E9EF] bg-[#F4F7F9] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5B6472]">
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
    <div className={`flex h-full min-h-[9rem] flex-col rounded-2xl border border-[#E5E9EF] bg-white p-4 shadow-sm sm:p-5`}>
      <h4 className={`font-display text-base font-bold tracking-tight ${s.title}`}>{title}</h4>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#5B6472]">{description}</p>
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
      className={`flex h-full min-h-[7.5rem] w-full min-w-[9.5rem] flex-col rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-[#2D5A5A] bg-[#E8F0F0]"
          : "border-[#E5E9EF] bg-white hover:border-[#2D5A5A]/40 hover:bg-[#F4F7F9]"
      }`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${s.accent}`}>
        {icon}
      </span>
      <span className={`mt-3 font-display text-base font-bold ${s.title}`}>{label}</span>
      <span className="mt-1 flex-1 text-xs leading-relaxed text-[#5B6472]">{description}</span>
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
      className="inline-flex rounded-lg border border-[#E5E9EF] bg-[#E8F0F0] px-2.5 py-1 text-xs font-medium text-[#2D5A5A] transition-colors hover:bg-[#2D5A5A] hover:text-white"
    >
      {children}
    </Link>
  );
}
