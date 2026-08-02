"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { StatTone } from "../stat-card";

/** Deep solid accents — match admin dashboard (no fades / gradients). */
const DEEP: Record<
  StatTone,
  { solid: string; border: string; idleBorder: string }
> = {
  brand: { solid: "#005CAB", border: "#B4CDE8", idleBorder: "#E1DFDD" },
  sky: { solid: "#005CAB", border: "#B4CDE8", idleBorder: "#E1DFDD" },
  emerald: { solid: "#0B6A0B", border: "#A8D5A8", idleBorder: "#E1DFDD" },
  amber: { solid: "#C19C00", border: "#E8D48A", idleBorder: "#E1DFDD" },
  violet: { solid: "#5C2D91", border: "#C5B0DF", idleBorder: "#E1DFDD" },
  rose: { solid: "#C50F1F", border: "#E8A0A6", idleBorder: "#E1DFDD" }
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
    <div className="relative overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-4">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#005CAB]" aria-hidden />
      <p className="mb-3 font-label text-[11px] font-semibold tracking-wide text-[#8A8886]">Sections</p>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const d = DEEP[t.tone];
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition"
              style={
                isActive
                  ? { backgroundColor: d.solid, borderColor: d.solid, color: "#fff" }
                  : { backgroundColor: "#fff", borderColor: d.border, color: "#242424" }
              }
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold"
                style={
                  isActive
                    ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                    : { backgroundColor: d.solid, color: "#fff" }
                }
              >
                {t.icon}
              </span>
              <span className="font-body tracking-tight">{t.label}</span>
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
  const d = DEEP[tone];
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5 ${className}`.trim()}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: d.solid }} aria-hidden />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-body text-[15px] font-semibold tracking-tight sm:text-base" style={{ color: d.solid }}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl font-body text-[13px] font-medium text-[#8A8886]">{description}</p>
          ) : null}
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
      <div className="rounded-lg border border-dashed border-[#E1DFDD] bg-white px-4 py-10 text-center">
        <p className="font-body text-sm font-medium text-[#8A8886]">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E1DFDD] bg-white">{children}</div>
  );
}

export function CrmTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[#E1DFDD] bg-white text-[10px] font-semibold uppercase tracking-[0.14em] text-[#605E5C]">
        {children}
      </tr>
    </thead>
  );
}

export function WorkspaceGuidelineCard({
  title,
  description,
  tone
}: {
  title: string;
  description: string;
  tone: StatTone;
}) {
  const d = DEEP[tone];
  return (
    <div
      className="flex h-full min-h-[9rem] flex-col rounded-lg border bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5"
      style={{ borderColor: d.border, borderLeftWidth: 4, borderLeftColor: d.solid }}
    >
      <h4 className="font-body text-[14px] font-semibold tracking-tight" style={{ color: d.solid }}>
        {title}
      </h4>
      <p className="mt-2 flex-1 font-body text-[13px] leading-relaxed text-[#605E5C]">{description}</p>
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
        const d = DEEP[opt.tone];
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="rounded-md border px-3 py-2 text-sm font-semibold transition"
            style={
              active
                ? { backgroundColor: d.solid, borderColor: d.solid, color: "#fff" }
                : { backgroundColor: "#fff", borderColor: d.border, color: "#242424" }
            }
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
  const d = DEEP[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full min-h-[7.5rem] w-full min-w-[9.5rem] flex-col rounded-lg border bg-white p-4 text-left transition shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] hover:-translate-y-px"
      style={{
        borderColor: active ? d.solid : d.border,
        borderTopWidth: 3,
        borderTopColor: d.solid
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-white"
        style={{ backgroundColor: d.solid }}
      >
        {icon}
      </span>
      <span className="mt-3 font-body text-[14px] font-semibold text-[#242424]">{label}</span>
      <span className="mt-1 flex-1 font-body text-[12px] leading-relaxed text-[#605E5C]">{description}</span>
      {active ? (
        <span className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: d.solid }}>
          Active
        </span>
      ) : null}
    </button>
  );
}

export function CrmActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-md border border-[#005CAB] bg-white px-2.5 py-1 text-xs font-semibold text-[#005CAB] transition-colors hover:bg-[#005CAB] hover:text-white"
    >
      {children}
    </Link>
  );
}
