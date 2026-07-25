"use client";

import type { ReactNode } from "react";

export type WorkspaceAsideTheme = {
  panel: string;
  border: string;
  title: string;
  subtitle: string;
};

/** Side panels — unified GemMatrix teal system across all workspaces. */
const GEMMATRIX_ASIDE: WorkspaceAsideTheme = {
  panel: "bg-white",
  border: "border-[#E5E9EF]",
  title: "font-display text-brand",
  subtitle: "font-body text-[#5B6472]"
};

export const WORKSPACE_THEMES: Record<string, WorkspaceAsideTheme> = {
  finance: GEMMATRIX_ASIDE,
  sales: GEMMATRIX_ASIDE,
  developer: GEMMATRIX_ASIDE,
  director: GEMMATRIX_ASIDE,
  admin: GEMMATRIX_ASIDE,
  client: GEMMATRIX_ASIDE,
  hr: GEMMATRIX_ASIDE,
  pm: GEMMATRIX_ASIDE,
  global: GEMMATRIX_ASIDE
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
        <p className={`font-label text-[10px] font-bold uppercase tracking-[0.2em] ${theme.title}`}>
          {title}
        </p>
        {subtitle ? (
          <p className={`mt-1.5 text-xs font-medium leading-relaxed ${theme.subtitle}`}>{subtitle}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      {footer ? <div className={`shrink-0 border-t ${theme.border} p-2`}>{footer}</div> : null}
    </aside>
  );
}
