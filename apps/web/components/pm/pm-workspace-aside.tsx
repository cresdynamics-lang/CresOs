"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { pmNeu } from "./pm-theme";
import { WorkspaceAccountFooter } from "../workspace/workspace-account-footer";
import { PmBrandMark } from "./pm-nav-icons";

export function PmWorkspaceAside({
  children,
  footer,
  className = "",
  showQuickAction = true
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  showQuickAction?: boolean;
}) {
  return (
    <aside className={`pm-neu ${pmNeu.sidePanel} ${className}`.trim()}>
      <div className={pmNeu.sideHeader}>
        <div className="flex items-start gap-3">
          <PmBrandMark />
          <div className="min-w-0 flex-1">
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-400/90">
              Project Management
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-100">Delivery workspace</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Agile · milestones · team success</p>
          </div>
        </div>
        {showQuickAction ? (
          <Link href="/pm/check-ins" className={`${pmNeu.sideCta} mt-4`}>
            <span className="text-base leading-none" aria-hidden>
              ↗
            </span>
            Send daily check-ins
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

export function PmSideNavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <div className={`${pmNeu.sideGroup} flex flex-col gap-1`}>{children}</div>
    </div>
  );
}

export function PmSideNavDivider() {
  return <div className="mx-1 my-4 border-t border-white/[0.05]" aria-hidden />;
}

export function PmSideNavLink({
  href,
  label,
  description,
  icon,
  active = false,
  onClick,
  badge
}: {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
  badge?: string | number;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={active ? pmNeu.sideNavActive : pmNeu.sideNavIdle}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-teal-400 to-cyan-600 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
          aria-hidden
        />
      ) : null}
      <span className={active ? pmNeu.sideIconActive : pmNeu.sideIconIdle}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-medium ${active ? "text-teal-100" : "text-slate-300"}`}>
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-[10px] text-slate-500">{description}</span>
        ) : null}
      </span>
      {badge != null && Number(badge) > 0 ? (
        <span className="shrink-0 rounded-full bg-teal-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function PmWorkspaceAsideFooter({ onLogout }: { onLogout: () => void }) {
  return <WorkspaceAccountFooter themeKey="pm" onLogout={onLogout} showAccountLink showIdentity />;
}
