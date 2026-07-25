"use client";

import type { ReactNode } from "react";

export type WorkspaceAsideTheme = {
  panel: string;
  border: string;
  title: string;
  subtitle: string;
};

/** Bright side panels — Cres Dynamics brand blue + role accents. */
export const WORKSPACE_THEMES: Record<string, WorkspaceAsideTheme> = {
  finance: {
    panel: "bg-white",
    border: "border-emerald-200",
    title: "text-emerald-700",
    subtitle: "text-slate-500"
  },
  sales: {
    panel: "bg-white",
    border: "border-amber-200",
    title: "text-amber-700",
    subtitle: "text-slate-500"
  },
  developer: {
    panel: "bg-white",
    border: "border-violet-200",
    title: "text-violet-700",
    subtitle: "text-slate-500"
  },
  director: {
    panel: "bg-white",
    border: "border-sky-200",
    title: "text-brand",
    subtitle: "text-slate-500"
  },
  admin: {
    panel: "bg-white",
    border: "border-[#e1dfdd]",
    title: "text-[#0b4a8f]",
    subtitle: "text-[#424242]"
  },
  client: {
    panel: "bg-white",
    border: "border-teal-200",
    title: "text-teal-700",
    subtitle: "text-slate-500"
  },
  hr: {
    panel: "bg-white",
    border: "border-rose-200",
    title: "text-rose-700",
    subtitle: "text-slate-500"
  },
  pm: {
    panel: "bg-white",
    border: "border-teal-200",
    title: "text-teal-700",
    subtitle: "text-slate-500"
  },
  global: {
    panel: "bg-white",
    border: "border-sky-200",
    title: "text-brand",
    subtitle: "text-slate-500"
  }
};

type WorkspaceAsideProps = {
  title: string;
  subtitle?: string;
  themeKey: keyof typeof WORKSPACE_THEMES;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function WorkspaceAside({
  title,
  subtitle,
  themeKey,
  children,
  footer,
  className = ""
}: WorkspaceAsideProps) {
  const theme = WORKSPACE_THEMES[themeKey] ?? WORKSPACE_THEMES.finance;

  return (
    <aside
      className={`flex h-full max-h-[100dvh] w-[min(18rem,92vw)] shrink-0 flex-col border-r ${theme.border} ${theme.panel} ${className}`.trim()}
    >
      <div className={`shrink-0 border-b ${theme.border} px-4 py-4`}>
        <p className={`font-label text-[10px] font-semibold uppercase tracking-[0.22em] ${theme.title}`}>
          {title}
        </p>
        {subtitle ? (
          <p className={`mt-1 text-xs leading-relaxed ${theme.subtitle}`}>{subtitle}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      {footer ? <div className={`shrink-0 border-t ${theme.border} p-2`}>{footer}</div> : null}
    </aside>
  );
}
