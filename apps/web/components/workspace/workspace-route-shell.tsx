"use client";

import type { ReactNode } from "react";
import type { WorkspaceKey } from "../../lib/resolve-workspace";
import { DeveloperGlassCanvas } from "../developer/developer-glass-ui";
import { devGlass } from "../developer/developer-glass-theme";
import { salesWs } from "../sales/sales-theme";
import { financeNeu } from "../finance/finance-theme";
import { WorkspaceAside } from "./workspace-aside";
import { WorkspaceAccountFooter } from "./workspace-account-footer";
import { workspaceMeta } from "./workspace-nav-content";
import { FinanceSideNav } from "../../app/finance/finance-nav";
import { SalesSideNav } from "../../app/sales/sales-workspace-nav";
import { DeveloperSideNav } from "../../app/developer/developer-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";

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
      showAccountLink={workspace !== "finance" && workspace !== "developer" && workspace !== "sales"}
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
    </WorkspaceAside>
  );

  const content = (
    <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );

  if (workspace === "developer") {
    return (
      <DeveloperGlassCanvas className="h-full min-h-0 flex-1 gap-0 p-0">
        <div className={`${devGlass.content} flex h-full min-h-0 w-full flex-1 overflow-hidden`}>
          {aside}
          {content}
        </div>
      </DeveloperGlassCanvas>
    );
  }

  if (workspace === "sales") {
    return (
      <div
        className={`${salesWs.workspace} ${salesWs.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
      >
        {aside}
        {content}
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

  return <>{children}</>;
}
