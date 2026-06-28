"use client";

import type { ReactNode } from "react";
import { DeveloperNav, DeveloperSideNav } from "../../app/developer/developer-nav";
import { FinanceSideNav } from "../../app/finance/finance-nav";
import { SalesSideNav } from "../../app/sales/sales-workspace-nav";
import type { SettingsWorkspaceKey } from "../../lib/resolve-settings-workspace";
import { settingsBackLink } from "../../lib/resolve-settings-workspace";
import { workspaceMeta } from "../workspace/workspace-nav-content";
import { WorkspaceAside } from "../workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../workspace/workspace-account-footer";
import { useSettingsTheme } from "./settings-primitives";
import { SettingsSideNav } from "../../app/settings/settings-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";
import Link from "next/link";

type SettingsWorkspaceShellProps = {
  workspaceKey: SettingsWorkspaceKey;
  children: ReactNode;
};

function workspaceAsideTheme(key: SettingsWorkspaceKey) {
  if (key === "developer") return "developer" as const;
  if (key === "finance") return "finance" as const;
  if (key === "sales") return "sales" as const;
  return "global" as const;
}

export function SettingsWorkspaceShell({ workspaceKey, children }: SettingsWorkspaceShellProps) {
  const theme = useSettingsTheme();
  const handleLogout = useWorkspaceLogout();
  const asideTheme = workspaceAsideTheme(workspaceKey);
  const usesWorkspaceNav = workspaceKey !== "global";
  const meta = usesWorkspaceNav ? workspaceMeta(workspaceKey) : null;

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-1 overflow-hidden ${theme.workspaceClass} ${theme.canvas}`}
    >
      <WorkspaceAside
        title={usesWorkspaceNav ? meta!.title : "Settings"}
        subtitle={usesWorkspaceNav ? meta!.subtitle : "Account & preferences"}
        themeKey={asideTheme}
        className="hidden w-[15rem] shrink-0 md:flex"
        footer={
          <WorkspaceAccountFooter
            themeKey={asideTheme}
            onLogout={handleLogout}
            showAccountLink={false}
            showIdentity={false}
          />
        }
      >
        {usesWorkspaceNav ? (
          workspaceKey === "developer" ? (
            <DeveloperSideNav />
          ) : workspaceKey === "finance" ? (
            <FinanceSideNav />
          ) : (
            <SalesSideNav />
          )
        ) : (
          <SettingsSideNav />
        )}
      </WorkspaceAside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {workspaceKey === "developer" ? (
          <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 md:hidden">
            <DeveloperNav />
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

export function SettingsPageChrome({
  workspaceKey,
  title,
  description,
  tabs,
  children
}: {
  workspaceKey: SettingsWorkspaceKey;
  title: string;
  description: string;
  tabs: ReactNode;
  children: ReactNode;
}) {
  const theme = useSettingsTheme();
  const back = settingsBackLink(workspaceKey);

  return (
    <>
      <header className="shrink-0 border-b border-white/[0.06] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`${theme.sectionLabel}`}>Settings</p>
            <h1
              className={`mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl`}
            >
              <span className={`bg-gradient-to-r ${theme.headerGradient} bg-clip-text text-transparent`}>
                {title}
              </span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
          {workspaceKey !== "global" ? (
            <Link
              href={back.href}
              className={`shrink-0 rounded-lg border border-white/[0.06] px-3 py-2 text-xs font-medium ${theme.navIdle}`}
            >
              {back.label}
            </Link>
          ) : null}
        </div>
        <div className="mt-5 border-t border-white/[0.06] pt-5">{tabs}</div>
      </header>
      <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
    </>
  );
}
