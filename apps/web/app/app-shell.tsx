"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { OnboardingPrompt } from "./onboarding-prompt";
import { SettingsPanel } from "./settings-panel";
import { HeaderStatusStrip } from "./header-status";

type NavSection = {
  title: string;
  items: { href: string; label: string; roles: string[] }[];
};

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: ["admin", "director_admin", "finance", "developer", "sales", "analyst", "client"] },
      { href: "/schedule", label: "Tasks", roles: ["admin", "director_admin", "developer", "sales", "analyst"] }
    ]
  },
  {
    title: "Sales",
    items: [
      { href: "/reports", label: "Reports", roles: ["admin", "director_admin", "sales"] },
      { href: "/leads", label: "Leads", roles: ["admin", "director_admin", "sales", "analyst"] },
      { href: "/crm", label: "CRM", roles: ["admin", "director_admin", "sales", "analyst"] }
    ]
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"] },
      { href: "/developer-reports", label: "Reports", roles: ["admin", "director_admin", "developer"] },
      { href: "/meeting-requests", label: "Meeting requests", roles: ["admin", "director_admin", "developer"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Finance", roles: ["admin", "director_admin", "finance", "analyst"] },
      { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"] }
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Side panel */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
          <span className="h-9 w-9 rounded-xl bg-brand/20 ring-2 ring-brand/60" />
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand">CresOS</p>
            <p className="text-[10px] text-slate-400">Operating System for Growth</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const showAlarm = item.href === "/reports" && overdueCount > 0;
                  return (
                    <Link
                      key={item.href}
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

        <div className="border-t border-slate-800 p-3">
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsInitialTab} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-3">
          <div className="min-w-0 text-xs font-medium uppercase tracking-wide text-slate-500">
            <span className="text-slate-400">{auth.orgName?.trim() || "Workspace"}</span>
          </div>
          <HeaderStatusStrip />
        </header>
        <OnboardingPrompt
          onOpenAccountSettings={() => {
            setSettingsOpen(true);
            setSettingsInitialTab("account");
          }}
        />
        <div className="mx-auto max-w-5xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
