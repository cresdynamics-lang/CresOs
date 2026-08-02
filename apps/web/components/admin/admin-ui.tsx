"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { adminAccents, adminNeu, type AdminAccent } from "./admin-theme";

const toneToAccent: Record<StatTone, AdminAccent> = {
  brand: "blue",
  sky: "blue",
  emerald: "green",
  amber: "yellow",
  rose: "red",
  violet: "purple"
};

export function AdminStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AdminStatInline({
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
      className="relative min-w-0 overflow-hidden rounded-lg border bg-white p-3.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-4"
      style={{ borderColor: accent.border, borderLeftWidth: 4, borderLeftColor: accent.solid }}
    >
      <p className="font-label text-[11px] font-semibold tracking-wide text-[#605E5C]">{label}</p>
      <p
        className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]"
        style={{ color: accent.solid }}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 font-body text-[12px] font-medium text-[#8A8886]">{hint}</p> : null}
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className={adminNeu.eyebrow}>{eyebrow}</p> : null}
        <h1
          className={`font-display text-2xl font-bold tracking-tight text-[#1A1D26] sm:text-[1.75rem] ${eyebrow ? "mt-1" : ""}`}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl font-body text-sm font-medium leading-relaxed text-[#5B6472]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? adminNeu.panelInset : adminNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function AdminFieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block font-label text-xs font-bold text-[#1A1D26]">{children}</label>;
}

export function AdminInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input className={`w-full ${adminNeu.input} ${className}`.trim()} {...props} />;
}

export function AdminSelect({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <select className={`w-full ${adminNeu.input} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function AdminTextarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea className={`w-full ${adminNeu.input} ${className}`.trim()} {...props} />;
}

/** Mini dual-arc donut for KPI cards (GemMatrix Sale/Due style). */
export function AdminRingStat({
  label,
  value,
  pct,
  color,
  secondaryColor = "#F8B042",
  secondaryPct
}: {
  label: string;
  value: string | number;
  pct: number;
  color: string;
  secondaryColor?: string;
  /** When set, draws a second arc (remaining share); defaults to 100 − pct. */
  secondaryPct?: number;
}) {
  const size = 68;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const primary = Math.min(100, Math.max(0, pct));
  const secondary = Math.min(100 - primary, Math.max(0, secondaryPct ?? 100 - primary));
  const primaryLen = (primary / 100) * c;
  const secondaryLen = (secondary / 100) * c;
  const gap = Math.max(0, c - primaryLen - secondaryLen);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E9EF" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${primaryLen} ${c - primaryLen}`}
            strokeDashoffset={0}
            strokeLinecap="butt"
          />
          {secondary > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={stroke}
              strokeDasharray={`${secondaryLen} ${c - secondaryLen}`}
              strokeDashoffset={-(primaryLen + (gap > 0 ? 0 : 0))}
              strokeLinecap="butt"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[11px] font-bold tabular-nums text-[#1A1D26]">{value}</span>
        </div>
      </div>
      <p className="font-label text-[10px] font-semibold text-[#5B6472]">{label}</p>
    </div>
  );
}

export function AdminKpiLegend({
  items
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 font-label text-[10px] font-semibold text-[#5B6472]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
