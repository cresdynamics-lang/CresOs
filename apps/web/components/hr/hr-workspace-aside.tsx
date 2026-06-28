"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hrNeu } from "./hr-theme";
import { WorkspaceAccountFooter } from "../workspace/workspace-account-footer";
import { HrBrandMark } from "./hr-nav-icons";

type HrWorkspaceAsideProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  showQuickAction?: boolean;
};

export function HrWorkspaceAside({
  children,
  footer,
  className = "",
  showQuickAction = true
}: HrWorkspaceAsideProps) {
  return (
    <aside className={`hr-neu ${hrNeu.sidePanel} ${className}`.trim()}>
      <div className={hrNeu.sideHeader}>
        <div className="flex items-start gap-3">
          <HrBrandMark />
          <div className="min-w-0 flex-1">
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-400/90">
              Human Resources
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-100">People workspace</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Roster · payroll · reporting</p>
          </div>
        </div>
        {showQuickAction ? (
          <Link href="/hr/employees" className={`${hrNeu.sideCta} mt-4`}>
            <span className="text-base leading-none" aria-hidden>
              +
            </span>
            New employee
          </Link>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">{children}</div>

      {footer ? (
        <div className="shrink-0 border-t border-white/[0.04] bg-[#0a0e13]/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

export function HrSideNavGroup({
  title,
  children,
  className = ""
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 last:mb-0 ${className}`}>
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <div className={`${hrNeu.sideGroup} flex flex-col gap-1`}>{children}</div>
    </div>
  );
}

export function HrSideNavDivider() {
  return <div className="mx-1 my-4 border-t border-white/[0.05]" aria-hidden />;
}

type HrSideNavLinkProps = {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
  badge?: string | number;
};

export function HrSideNavLink({
  href,
  label,
  description,
  icon,
  active = false,
  onClick,
  badge
}: HrSideNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={active ? hrNeu.sideNavActive : hrNeu.sideNavIdle}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-rose-400 to-pink-600 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
          aria-hidden
        />
      ) : null}
      <span className={active ? hrNeu.sideIconActive : hrNeu.sideIconIdle}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-medium ${active ? "text-rose-100" : "text-slate-300"}`}>
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-[10px] text-slate-500">{description}</span>
        ) : null}
      </span>
      {badge != null && Number(badge) > 0 ? (
        <span className="shrink-0 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.4)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function HrWorkspaceAsideFooter({
  onLogout
}: {
  onLogout: () => void;
}) {
  return (
    <WorkspaceAccountFooter
      themeKey="hr"
      onLogout={onLogout}
      showAccountLink
      showIdentity
    />
  );
}
