"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { financeNeu } from "./finance-theme";

const statToneClass: Record<StatTone, { solid: string; border: string }> = {
  brand: { solid: "#005CAB", border: "#B4CDE8" },
  emerald: { solid: "#0B6A0B", border: "#A8D5A8" },
  amber: { solid: "#C19C00", border: "#E8D48A" },
  rose: { solid: "#C50F1F", border: "#E8A0A6" },
  sky: { solid: "#005CAB", border: "#B4CDE8" },
  violet: { solid: "#5C2D91", border: "#C5B0DF" }
};

export function FinanceNeuPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? financeNeu.panelInset : financeNeu.panel} ${className}`.trim()}>{children}</div>
  );
}

export function FinanceStatCard({
  label,
  value,
  hint,
  tone = "emerald",
  icon,
  className = ""
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  icon?: ReactNode;
  className?: string;
}) {
  const s = statToneClass[tone];
  return (
    <div
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-lg border bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] ${className}`.trim()}
      style={{ borderColor: s.border, borderLeftWidth: 4, borderLeftColor: s.solid }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#605E5C]">{label}</p>
        {icon ? <span style={{ color: s.solid }}>{icon}</span> : null}
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem]" style={{ color: s.solid }}>
          {value}
        </p>
        {hint ? <p className="mt-1 text-[11px] font-medium text-[#8A8886] sm:text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

export function FinanceStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function FinanceStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-6 gap-y-4 border-b border-[#E1DFDD] pb-6 sm:grid-cols-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function FinanceStatInline({
  label,
  value,
  hint,
  tone = "emerald",
  className = ""
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  const s = statToneClass[tone];
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <p className="text-[11px] font-semibold tracking-wide text-[#605E5C]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem]" style={{ color: s.solid }}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] font-medium text-[#8A8886] sm:text-xs">{hint}</p> : null}
    </div>
  );
}

export function FinanceNeuListRow({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <li className={`${financeNeu.listRow} ${className}`.trim()}>{children}</li>;
}

/** Flat full-bleed data table — no card shells per row. */
export function FinanceFlatTable({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 overflow-x-auto ${className}`.trim()}>
      <table className="w-full min-w-[52rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function FinanceFlatTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className={`border-b border-[#E1DFDD] ${financeNeu.tableHead}`}>{children}</tr>
    </thead>
  );
}

export function FinanceFlatTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[#F5F5F5]">{children}</tbody>;
}

export function FinanceFlatTableRow({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={`${financeNeu.tableCell} ${className}`.trim()}>{children}</tr>;
}

export function FinanceFlatTh({
  children,
  align = "left",
  className = ""
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`py-2.5 pr-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#605E5C] last:pr-0 ${align === "right" ? "text-right" : "text-left"} ${className}`.trim()}
    >
      {children}
    </th>
  );
}

export function FinanceFlatTd({
  children,
  align = "left",
  className = "",
  colSpan
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`py-3 pr-4 align-middle text-sm text-[#242424] last:pr-0 ${align === "right" ? "text-right" : "text-left"} ${className}`.trim()}
    >
      {children}
    </td>
  );
}

const statusTone: Record<string, string> = {
  sent: "text-[#005CAB]",
  paid: "text-[#0B6A0B]",
  partial: "text-[#8A7000]",
  draft: "text-[#605E5C]",
  overdue: "text-[#C50F1F]"
};

export function FinanceStatusLabel({ status }: { status: string }) {
  const tone = statusTone[status.toLowerCase()] ?? "text-[#605E5C]";
  return (
    <span className={`text-xs font-semibold capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function FinanceTextAction({
  children,
  onClick,
  href,
  tone = "default",
  className = ""
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
  className?: string;
}) {
  const cls =
    tone === "danger"
      ? "text-[#C50F1F] hover:text-[#A50D1A]"
      : "text-[#605E5C] hover:text-[#005CAB]";
  if (href) {
    return (
      <a href={href} className={`text-xs font-semibold transition-colors ${cls} ${className}`.trim()}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold transition-colors ${cls} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export { financeNeu };
