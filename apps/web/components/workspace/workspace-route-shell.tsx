"use client";

import type { ReactNode } from "react";
import type { WorkspaceKey } from "../../lib/resolve-workspace";
import { devNeu } from "../developer/developer-theme";
import { salesNeu } from "../sales/sales-theme";
import { financeNeu } from "../finance/finance-theme";
import { WorkspaceAside } from "./workspace-aside";
import { WorkspaceAccountFooter } from "./workspace-account-footer";
import { workspaceMeta } from "./workspace-nav-content";
import { FinanceSideNav } from "../../app/finance/finance-nav";
import { SalesSideNav } from "../../app/sales/sales-workspace-nav";
import { DeveloperNav, DeveloperSideNav } from "../../app/developer/developer-nav";
import { DirectorNav, DirectorSideNav } from "../../app/director/director-nav";
import { HrNav } from "../../app/hr/hr-nav";
import { PmNav } from "../../app/pm/pm-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";
import { directorNeu } from "../director/director-theme";
import { hrNeu } from "../hr/hr-theme";
import { pmNeu } from "../pm/pm-theme";

type WorkspaceRouteShellProps = {
  workspace: WorkspaceKey;
  children: ReactNode;
};

export function WorkspaceRouteShell({ workspace, children }: WorkspaceRouteShellProps) {
  const handleLogout = useWorkspaceLogout();
  const meta = workspaceMeta(workspace);
  const footer = (
    <WorkspaceAccountFooter
      themeKey={meta.themeKey}
      onLogout={handleLogout}
      showAccountLink={workspace !== "finance" && workspace !== "developer" && workspace !== "sales" && workspace !== "director" && workspace !== "hr" && workspace !== "pm"}
      showIdentity={false}
    />
  );

  const aside = (
    <WorkspaceAside
      title={meta.title}
      subtitle={meta.subtitle}
      themeKey={meta.themeKey}
      className="hidden w-[15rem] md:flex"
      footer={footer}
    >
      {workspace === "finance" && <FinanceSideNav />}
      {workspace === "sales" && <SalesSideNav />}
      {workspace === "developer" && <DeveloperSideNav />}
      {workspace === "director" && <DirectorSideNav />}
    </WorkspaceAside>
  );

  const content = (
    <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );

  if (workspace === "developer") {
    return (
      <div
        className={`${devNeu.workspace} developer-fullscreen ${devNeu.canvas} flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row`}
      >
        {aside}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 md:hidden">
            <DeveloperNav />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (workspace === "sales") {
    return (
      <div
        className={`${salesNeu.workspace} sales-fullscreen ${salesNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
      >
        {aside}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{content}</div>
      </div>
    );
  }

  if (workspace === "finance") {
    return (
      <div
        className={`${financeNeu.workspace} finance-fullscreen ${financeNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
      >
        {aside}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{content}</div>
      </div>
    );
  }

  if (workspace === "director") {
    return (
      <div
        className={`${directorNeu.workspace} director-fullscreen ${directorNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
      >
        {aside}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 md:hidden">
            <DirectorNav />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (workspace === "hr") {
    return (
      <div className={`${hrNeu.workspace} hr-fullscreen ${hrNeu.canvas} flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden`}>
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0c1016]/90 px-3 py-2.5 md:hidden">
          <HrNav />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    );
  }

  if (workspace === "pm") {
    return (
      <div className={`${pmNeu.workspace} pm-fullscreen ${pmNeu.canvas} flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden`}>
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0c1016]/90 px-3 py-2.5 md:hidden">
          <PmNav />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
