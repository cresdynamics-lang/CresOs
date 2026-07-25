"use client";

import type { ReactNode } from "react";
import type { StatTone } from "../stat-card";
import { financeNeu } from "./finance-theme";

const statToneClass: Record<StatTone, { shell: string; value: string; label: string }> = {
  brand: {
    shell: "border-brand/25 bg-brand-light/70",
    value: "text-brand",
    label: "text-slate-500"
  },
  emerald: {
    shell: financeNeu.statEmerald,
    value: "text-emerald-700",
    label: "text-slate-500"
  },
  amber: {
    shell: financeNeu.statAmber,
    value: "text-amber-700",
    label: "text-slate-500"
  },
  rose: {
    shell: financeNeu.statRose,
    value: "text-rose-700",
    label: "text-slate-500"
  },
  sky: {
    shell: "border-[#E5E9EF] bg-sky-50",
    value: "text-sky-700",
    label: "text-slate-500"
  },
  violet: {
    shell: financeNeu.statViolet,
    value: "text-violet-700",
    label: "text-slate-500"
  }
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
      className={`flex min-h-[5.5rem] h-full flex-col justify-between rounded-2xl border p-4 ${s.shell} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-medium uppercase tracking-wide ${s.label}`}>{label}</p>
        {icon ? <span className="text-lg opacity-80">{icon}</span> : null}
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
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
      className={`grid grid-cols-2 gap-x-6 gap-y-4 border-b border-[#E5E9EF] pb-6 sm:grid-cols-4 ${className}`.trim()}
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
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.label}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${s.value}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
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
      <tr className="border-b border-[#E5E9EF] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {children}
      </tr>
    </thead>
  );
}

export function FinanceFlatTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-sky-100">{children}</tbody>;
}

export function FinanceFlatTableRow({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={`text-slate-700 ${className}`.trim()}>{children}</tr>;
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
      className={`py-2.5 pr-4 font-medium last:pr-0 ${align === "right" ? "text-right" : "text-left"} ${className}`.trim()}
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
      className={`py-3 pr-4 align-middle last:pr-0 ${align === "right" ? "text-right" : "text-left"} ${className}`.trim()}
    >
      {children}
    </td>
  );
}

const statusTone: Record<string, string> = {
  sent: "text-sky-700",
  paid: "text-emerald-700",
  partial: "text-amber-700",
  draft: "text-slate-500",
  overdue: "text-rose-700"
};

export function FinanceStatusLabel({ status }: { status: string }) {
  const tone = statusTone[status.toLowerCase()] ?? "text-slate-500";
  return <span className={`text-xs font-medium capitalize ${tone}`}>{status.replace(/_/g, " ")}</span>;
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
      ? "text-rose-600 hover:text-rose-700"
      : "text-slate-500 hover:text-emerald-700";
  if (href) {
    return (
      <a href={href} className={`text-xs font-medium transition-colors ${cls} ${className}`.trim()}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium transition-colors ${cls} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export { financeNeu };
