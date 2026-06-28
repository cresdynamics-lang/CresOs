"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { resolveRoleTheme } from "../../components/dashboard-welcome-banner";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { SETTINGS_TAB_COPY, SettingsSideNav } from "./settings-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";

export function SettingsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const theme = resolveRoleTheme(auth.roleKeys);
  const handleLogout = useWorkspaceLogout();
  const copy = SETTINGS_TAB_COPY[pathname] ?? {
    title: "Settings",
    description: "Manage your workspace profile and preferences."
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-[#0a0d12]">
      <WorkspaceAside
        title="Settings"
        subtitle="Account & preferences"
        themeKey="global"
        className="hidden w-[15rem] md:flex"
        footer={<WorkspaceAccountFooter themeKey="global" onLogout={handleLogout} />}
      >
        <SettingsSideNav />
      </WorkspaceAside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Mobile tab strip */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/80 px-3 py-2 md:hidden">
          {Object.entries(SETTINGS_TAB_COPY).map(([href, tab]) => (
            <a
              key={href}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                pathname === href
                  ? "bg-brand/15 text-brand"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {tab.title}
            </a>
          ))}
        </div>

        <header className="shrink-0 border-b border-white/[0.06] px-4 py-5 sm:px-8 sm:py-6">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Settings
          </p>
          <h1
            className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r ${theme.nameGradient} bg-clip-text text-transparent`}
          >
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{copy.description}</p>
        </header>

        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
