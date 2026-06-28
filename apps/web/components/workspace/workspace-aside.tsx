"use client";

import type { ReactNode } from "react";

export type WorkspaceAsideTheme = {
  panel: string;
  border: string;
  title: string;
  subtitle: string;
};

export const WORKSPACE_THEMES: Record<string, WorkspaceAsideTheme> = {
  finance: {
    panel: "bg-[#0e1319]/95",
    border: "border-white/[0.04]",
    title: "text-emerald-500/90",
    subtitle: "text-slate-500"
  },
  sales: {
    panel: "bg-[#0e1118]/95",
    border: "border-white/[0.06]",
    title: "text-amber-400/90",
    subtitle: "text-slate-500"
  },
  developer: {
    panel: "bg-black/30 backdrop-blur-xl",
    border: "border-white/10",
    title: "text-violet-400/90",
    subtitle: "text-slate-500"
  },
  admin: {
    panel: "bg-slate-900/95",
    border: "border-slate-800",
    title: "text-sky-400/90",
    subtitle: "text-slate-500"
  },
  client: {
    panel: "bg-[#0a0d14]/95",
    border: "border-white/[0.06]",
    title: "text-teal-400/90",
    subtitle: "text-slate-500"
  },
  global: {
    panel: "bg-slate-950/95",
    border: "border-slate-800",
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
