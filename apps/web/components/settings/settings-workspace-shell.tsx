"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DeveloperNav, DeveloperSideNav } from "../../app/developer/developer-nav";
import { FinanceSideNav } from "../../app/finance/finance-nav";
import { SalesSideNav } from "../../app/sales/sales-workspace-nav";
import type { SettingsWorkspaceKey } from "../../lib/resolve-settings-workspace";
import { settingsBackLink } from "../../lib/resolve-settings-workspace";
import { workspaceMeta } from "../workspace/workspace-nav-content";
import { WorkspaceAside } from "../workspace/workspace-aside";
import { useSettingsTheme } from "./settings-primitives";
import { SettingsSideNav } from "../../app/settings/settings-nav";
import { AppBackButton } from "../navigation/app-back-button";
import { WorkspaceBackBar } from "../navigation/workspace-back-bar";
import { useAuth } from "../../app/auth-context";

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
  const { auth } = useAuth();
  const asideTheme = workspaceAsideTheme(workspaceKey);
  const usesWorkspaceNav = workspaceKey !== "global";
  const meta = usesWorkspaceNav ? workspaceMeta(workspaceKey) : null;
  const back = settingsBackLink(workspaceKey, auth.roleKeys);

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-1 overflow-hidden ${theme.workspaceClass} ${theme.canvas}`}
    >
      <WorkspaceAside
        title={usesWorkspaceNav ? meta!.title : "Settings"}
        subtitle={usesWorkspaceNav ? meta!.subtitle : "Account & preferences"}
        themeKey={asideTheme}
        className="hidden w-[15rem] shrink-0 md:flex"
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
          <div className="shrink-0 border-b border-[#E5E9EF] px-3 py-2 md:hidden">
            <DeveloperNav />
          </div>
        ) : null}

        <WorkspaceBackBar fallbackHref={back.href} />

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
  const { auth } = useAuth();
  const back = settingsBackLink(workspaceKey, auth.roleKeys);

  return (
    <>
      <header className="shrink-0 border-b border-[#E5E9EF] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <AppBackButton
                tone="light"
                fallbackHref={back.href}
                label="Back"
              />
            </div>
            <p className={`${theme.sectionLabel}`}>Settings</p>
            <h1
              className={`mt-1 font-display text-2xl font-bold tracking-tight text-[#1A1D26] sm:text-3xl`}
            >
              <span className={`bg-gradient-to-r ${theme.headerGradient} bg-clip-text text-transparent`}>
                {title}
              </span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#5B6472]">{description}</p>
          </div>
          {workspaceKey !== "global" ? (
            <Link
              href={back.href}
              className={`shrink-0 rounded-lg border border-[#E5E9EF] px-3 py-2 text-xs font-medium ${theme.navIdle}`}
            >
              {back.label}
            </Link>
          ) : null}
        </div>
        <div className="mt-5 border-t border-[#E5E9EF] pt-5">{tabs}</div>
      </header>
      <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
    </>
  );
}
