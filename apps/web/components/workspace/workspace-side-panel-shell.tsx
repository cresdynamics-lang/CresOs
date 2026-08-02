"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppBackButton } from "../navigation/app-back-button";
import { HeaderProfileMenu } from "./header-profile-menu";
import { NotificationBell } from "../../app/notification-bell";

export type SidePanelControls = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  closeSidebarMobile: () => void;
};

/** Hamburger / close for workspace side panels. */
export function SidePanelHamburgerButton({
  open,
  onClick,
  className = "",
  tone = "light"
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
  tone?: "light" | "dark";
}) {
  const toneClass =
    tone === "dark"
      ? "border-white/15 bg-transparent text-[#C8CDD8] hover:bg-white/10 hover:text-white"
      : "border-[#E1DFDD] bg-white text-[#242424] hover:bg-[#F5F5F5]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${toneClass} ${className}`.trim()}
      aria-label={open ? "Close side panel" : "Open side panel"}
      aria-expanded={open}
    >
      {open ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  );
}

export function useWorkspaceSidePanel(storageKey: string): SidePanelControls {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1") setSidebarOpen(true);
      else if (stored === "0") setSidebarOpen(false);
      else if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(true);
      else setSidebarOpen(false);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, sidebarOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarOpen, hydrated, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen((v) => !v);
  const closeSidebarMobile = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  };

  return { sidebarOpen, setSidebarOpen, toggleSidebar, closeSidebarMobile };
}

type WorkspaceSidePanelShellProps = {
  storageKey: string;
  shellClassName: string;
  pageTitle: string;
  fallbackHref: string;
  /** Side panel. Receives controls so the hamburger can live in the panel header. */
  renderPanel: (controls: SidePanelControls) => ReactNode;
  children: ReactNode;
  topBarClassName?: string;
  contentClassName?: string;
  overlayClassName?: string;
  titleClassName?: string;
  trailing?: ReactNode;
  fab?: ReactNode;
  panelWidthClassName?: string;
};

/**
 * Shared chrome for admin / sales / developer:
 * hamburger opens/collapses the left side panel.
 */
export function WorkspaceSidePanelShell({
  storageKey,
  shellClassName,
  pageTitle,
  fallbackHref,
  renderPanel,
  children,
  topBarClassName = "border-b border-[#E1DFDD] bg-white",
  contentClassName = "bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-5",
  overlayClassName = "bg-[#242424]/35",
  titleClassName = "min-w-0 shrink truncate text-[15px] font-semibold tracking-tight text-[#242424] sm:text-base",
  trailing,
  fab,
  panelWidthClassName = "w-[15rem]"
}: WorkspaceSidePanelShellProps) {
  const controls = useWorkspaceSidePanel(storageKey);
  const { sidebarOpen, setSidebarOpen, toggleSidebar, closeSidebarMobile } = controls;

  return (
    <div className={`${shellClassName} flex h-full min-h-0 w-full flex-1 overflow-hidden`}>
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close side panel"
          className={`fixed inset-0 z-40 md:hidden ${overlayClassName}`}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {sidebarOpen ? (
        <div
          className={[
            "flex h-full max-h-[100dvh] shrink-0 flex-col",
            panelWidthClassName,
            "md:relative md:z-0",
            "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-xl"
          ].join(" ")}
        >
          <div
            className="flex h-full min-h-0 w-full flex-col"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest("a")) closeSidebarMobile();
            }}
            role="presentation"
          >
            {renderPanel(controls)}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className={`flex shrink-0 items-center gap-2 px-3 py-2 sm:gap-2.5 sm:px-4 ${topBarClassName}`}>
          <AppBackButton tone="light" fallbackHref={fallbackHref} />
          {/* Always available so you can re-open a collapsed panel */}
          <SidePanelHamburgerButton open={sidebarOpen} onClick={toggleSidebar} />
          <h1 className={titleClassName}>{pageTitle}</h1>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {trailing}
            <NotificationBell />
            <HeaderProfileMenu />
          </div>
        </header>

        <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${contentClassName}`}>
          {children}
        </div>
      </div>

      {fab}
    </div>
  );
}
