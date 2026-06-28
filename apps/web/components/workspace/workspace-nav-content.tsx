"use client";

import type { ReactNode } from "react";
import type { WorkspaceKey } from "../../lib/resolve-workspace";
import { FinanceSideNav } from "../../app/finance/finance-nav";
import { SalesSideNav } from "../../app/sales/sales-workspace-nav";
import { DeveloperSideNav } from "../../app/developer/developer-nav";
import { AdminSideNav } from "../../app/admin/admin-nav";
import { ClientSideNav } from "../../app/client/client-nav";

type WorkspaceMeta = { title: string; subtitle?: string; themeKey: WorkspaceKey };

const WORKSPACE_META: Record<WorkspaceKey, WorkspaceMeta> = {
  finance: {
    title: "Finance",
    subtitle: "Payments in · salaries & ops out",
    themeKey: "finance"
  },
  sales: {
    title: "Sales",
    subtitle: "Pipeline, delivery & reports",
    themeKey: "sales"
  },
  developer: {
    title: "Developer",
    subtitle: "Tasks, projects & reports",
    themeKey: "developer"
  },
  admin: {
    title: "Admin",
    subtitle: "Users, org & automation",
    themeKey: "admin"
  },
  client: {
    title: "Client portal",
    subtitle: "Your projects & updates",
    themeKey: "client"
  }
};

export function workspaceMeta(key: WorkspaceKey): WorkspaceMeta {
  return WORKSPACE_META[key];
}

export function WorkspaceNavContent({
  workspace,
  onNavClick
}: {
  workspace: WorkspaceKey;
  onNavClick?: () => void;
}): ReactNode {
  const wrap = (node: ReactNode) => (
    <div onClick={onNavClick} onKeyDown={undefined} role="presentation">
      {node}
    </div>
  );

  switch (workspace) {
    case "finance":
      return wrap(<FinanceSideNav />);
    case "sales":
      return wrap(<SalesSideNav />);
    case "developer":
      return wrap(<DeveloperSideNav />);
    case "admin":
      return wrap(<AdminSideNav />);
    case "client":
      return wrap(<ClientSideNav />);
    default:
      return null;
  }
}
