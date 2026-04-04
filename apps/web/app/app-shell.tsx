"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { OnboardingPrompt } from "./onboarding-prompt";
import { SettingsPanel } from "./settings-panel";
import { HeaderStatusStrip } from "./header-status";
import { ALL_APP_ROLE_KEYS } from "../lib/app-roles";

type NavSection = {
  title: string;
  items: { href: string; label: string; roles: string[] }[];
};

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: [...ALL_APP_ROLE_KEYS] },
      { href: "/schedule", label: "Tasks", roles: ["admin", "director_admin", "developer", "sales", "analyst"] }
    ]
  },
  {
    title: "Community",
    items: [
      { href: "/community", label: "Community", roles: [...ALL_APP_ROLE_KEYS] }
    ]
  },
  {
    title: "Sales",
    items: [
      { href: "/sales/invoices", label: "Invoices", roles: ["admin", "sales"] },
      { href: "/reports", label: "Sales reports", roles: ["admin", "director_admin", "sales"] },
      { href: "/leads", label: "Leads", roles: ["admin", "director_admin", "sales", "finance"] },
      { href: "/crm", label: "CRM", roles: ["admin", "sales"] },
      { href: "/meeting-requests", label: "Director meeting", roles: ["admin", "sales"] }
    ]
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"] },
      { href: "/developer-reports", label: "Reports", roles: ["admin", "director_admin", "developer"] },
      { href: "/meeting-requests", label: "Director meeting", roles: ["admin", "director_admin", "developer"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Finance", roles: ["admin", "finance", "analyst"] },
      { href: "/finance/invoices", label: "Invoice Approvals", roles: ["admin", "finance"] },
      { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"] },
      { href: "/voice", label: "Voice", roles: ["admin", "finance"] }
    ]
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", roles: ["admin", "director_admin", "finance", "analyst"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/users", label: "Users", roles: ["admin", "director_admin"] },
      { href: "/admin", label: "Users & org", roles: ["admin"] },
      { href: "/activity", label: "Activity log", roles: ["admin"] }
    ]
  }
];

function roleLabel(key: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    director_admin: "Director",
    finance: "Finance",
    developer: "Developer",
    sales: "Sales",
    analyst: "Analyst",
    client: "Client"
  };
  return labels[key] ?? key;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { auth, setAuth, apiFetch } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const roles = auth.roleKeys;
  const [overdueCount, setOverdueCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"preferences" | "account">("account");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!roles.includes("sales")) return;
    let cancelled = false;
    apiFetch("/reports/alarms/overdue")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.overdue?.length != null) setOverdueCount(data.overdue.length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [roles, apiFetch]);

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.roles.some((r) => roles.includes(r))
    )
  })).filter((s) => s.items.length > 0);

  const handleLogout = () => {
    setAuth({
      accessToken: null,
      refreshToken: null,
      roleKeys: [],
      userId: undefined,
      userEmail: undefined,
      userName: undefined,
      orgId: undefined,
      orgName: undefined,
      orgSlug: undefined
    });
    router.replace("/login");
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Check if current page should be fullscreen
  const isFullscreenPage = pathname === '/community' || pathname === '/voice';

  return (
    <div className={`flex h-screen overflow-hidden ${isFullscreenPage && isFullscreen ? 'bg-slate-950' : ''}`}>
      {/* Side panel */}
      <aside className={`flex flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 transition-all duration-300 ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      } ${isFullscreenPage && isFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
          <span className="h-9 w-9 rounded-xl bg-brand/20 ring-2 ring-brand/60" />
          {!isSidebarCollapsed && (
            <div>
              <p className="text-sm font-semibold tracking-wide text-brand">CresOS</p>
              <p className="text-[10px] text-slate-400">Operating System for Growth</p>
            </div>
          )}
        </div>

        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {visibleSections.map((section) => (
              <div key={section.title} className="mb-6">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
                <nav className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href === "/reports" && pathname.startsWith("/reports")) ||
                      (item.href === "/leads" && pathname.startsWith("/leads")) ||
                      (item.href === "/crm" && pathname.startsWith("/crm"));
                    const showAlarm = item.href === "/reports" && overdueCount > 0;
                    return (
                      <Link
                        key={`${section.title}-${item.href}-${item.label}`}
                        href={item.href}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-brand/15 text-brand border border-brand/40"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {item.label}
                        {showAlarm && (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {overdueCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        )}

        {/* Collapsed sidebar icons */}
        {isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-2 py-4">
            {visibleSections.map((section) => (
              <div key={section.title} className="mb-4">
                <div className="mb-2 text-center text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.title.charAt(0)}
                </div>
                <nav className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href === "/reports" && pathname.startsWith("/reports")) ||
                      (item.href === "/leads" && pathname.startsWith("/leads")) ||
                      (item.href === "/crm" && pathname.startsWith("/crm"));
                    const showAlarm = item.href === "/reports" && overdueCount > 0;
                    return (
                      <Link
                        key={`${section.title}-${item.href}-${item.label}`}
                        href={item.href}
                        className={`flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors relative ${
                          isActive
                            ? "bg-brand/15 text-brand border border-brand/40"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                        title={item.label}
                      >
                        {item.label.charAt(0)}
                        {showAlarm && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 w-2 h-2"></span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-800 p-3">
          {!isSidebarCollapsed && (
            <div className="mb-2 flex flex-wrap gap-1">
              {roles.map((r) => (
                <span
                  key={r}
                  className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                >
                  {roleLabel(r)}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Settings"
              title={isSidebarCollapsed ? "Settings" : ""}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {!isSidebarCollapsed && <span>Settings</span>}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title={isSidebarCollapsed ? "Sign out" : ""}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Sidebar Toggle Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed left-${isSidebarCollapsed ? '16' : '64'} top-4 z-20 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all duration-300 ${
          isFullscreenPage && isFullscreen ? 'hidden' : ''
        }`}
        style={{ left: isSidebarCollapsed ? '4rem' : '16rem' }}
        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isSidebarCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          )}
        </svg>
      </button>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsInitialTab} />

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${
        isFullscreenPage && isFullscreen ? 'max-w-none' : ''
      }`}>
        <header className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-3 ${
          isFullscreenPage && isFullscreen ? 'hidden' : ''
        }`}>
          <div className="min-w-0 text-xs font-medium uppercase tracking-wide text-slate-500">
            <span className="text-slate-400">{auth.orgName?.trim() || "Workspace"}</span>
          </div>
          <div className="flex items-center gap-2">
            <HeaderStatusStrip />
            
            {/* Fullscreen Toggle */}
            {isFullscreenPage && (
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </header>
        <OnboardingPrompt
          onOpenAccountSettings={() => {
            setSettingsOpen(true);
            setSettingsInitialTab("account");
          }}
        />
        <div className={`mx-auto px-6 py-6 ${
          isFullscreenPage && isFullscreen ? 'max-w-none' : 'max-w-5xl'
        }`}>
          {children}
        </div>
      </main>
    </div>
  );
}
