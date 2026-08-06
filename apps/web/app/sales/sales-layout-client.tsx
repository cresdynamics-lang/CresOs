"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { salesNeu } from "../../components/sales/sales-theme";
import { SalesSideNav } from "./sales-workspace-nav";
import { isDirectorOnly } from "../../lib/is-director-only";
import { DirectorLayoutClient } from "../director/director-layout-client";
import {
  SidePanelHamburgerButton,
  WorkspaceSidePanelShell
} from "../../components/workspace/workspace-side-panel-shell";

const SIDEBAR_STORAGE_KEY = "cresos.sales.sidebarOpen";

function pageTitle(pathname: string | null): string {
  if (!pathname) return "Overview";
  if (pathname === "/sales" || pathname === "/sales/") return "Overview";
  if (pathname.startsWith("/sales/crm")) return "CRM";
  if (pathname.startsWith("/sales/messages")) return "Mails";
  if (pathname.startsWith("/sales/invoices")) return "Invoices";
  if (pathname.startsWith("/sales/onboarding")) return "Playbook";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/crm")) return "Contacts";
  if (pathname.startsWith("/schedule")) return "Tasks";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/community")) return "Community";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Sales";
}

export function SalesLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { auth, hydrated } = useAuth();

  if (isDirectorOnly(auth.roleKeys)) {
    return <DirectorLayoutClient>{children}</DirectorLayoutClient>;
  }

  const canAccessSales = auth.roleKeys.some((r) =>
    ["admin", "sales", "director_admin", "finance"].includes(r)
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessSales) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccessSales, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${salesNeu.workspace} sales-fullscreen flex h-full items-center justify-center text-sm text-[#8A8886] ${salesNeu.canvas}`}
      >
        Loading sales…
      </div>
    );
  }

  if (!canAccessSales) return null;

  return (
    <WorkspaceSidePanelShell
      storageKey={SIDEBAR_STORAGE_KEY}
      shellClassName={`${salesNeu.workspace} sales-fullscreen ${salesNeu.canvas}`}
      pageTitle={pageTitle(pathname)}
      fallbackHref="/sales"
      renderPanel={({ toggleSidebar, closeSidebarMobile }) => (
        <WorkspaceAside
          title="Sales"
          subtitle="CRM · pipeline · delivery"
          themeKey="sales"
          className="!h-full !w-full !max-w-none"
          headerAction={<SidePanelHamburgerButton open onClick={toggleSidebar} />}
        >
          <SalesSideNav onNavigate={closeSidebarMobile} />
        </WorkspaceAside>
      )}
    >
      {children}
    </WorkspaceSidePanelShell>
  );
}
