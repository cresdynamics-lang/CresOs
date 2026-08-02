"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { salesNeu } from "../../components/sales/sales-theme";
import { SalesSideNav } from "./sales-workspace-nav";
import { LeadershipLayoutGate } from "../../components/workspace/leadership-layout-gate";
import { isDirectorOnly } from "../../lib/is-director-only";
import { isAdminOnly } from "../../lib/is-admin-only";
import {
  SidePanelHamburgerButton,
  WorkspaceSidePanelShell
} from "../../components/workspace/workspace-side-panel-shell";

const SIDEBAR_STORAGE_KEY = "cresos.sales.sidebarOpen";

function pageTitle(pathname: string | null): string {
  if (!pathname) return "Sales";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/crm")) return "CRM";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/sales/invoices")) return "Invoices";
  if (pathname.startsWith("/sales/messages")) return "Mails";
  if (pathname.startsWith("/sales/onboarding")) return "Playbook";
  if (pathname === "/sales" || pathname === "/sales/") return "Overview";
  return "Sales";
}

/** Sales workspace chrome for pipeline routes (/leads, /crm, /reports). */
export function SalesLinkedLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { auth, hydrated } = useAuth();

  if (isDirectorOnly(auth.roleKeys) || isAdminOnly(auth.roleKeys)) {
    return <LeadershipLayoutGate>{children}</LeadershipLayoutGate>;
  }

  const canAccess = auth.roleKeys.some((r) =>
    ["admin", "sales", "director_admin", "finance"].includes(r)
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${salesNeu.workspace} sales-fullscreen flex h-full items-center justify-center text-sm text-[#8A8886] ${salesNeu.canvas}`}
      >
        Loading…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <WorkspaceSidePanelShell
      storageKey={SIDEBAR_STORAGE_KEY}
      shellClassName={`${salesNeu.workspace} sales-fullscreen ${salesNeu.canvas}`}
      pageTitle={pageTitle(pathname)}
      fallbackHref="/sales"
      renderPanel={({ toggleSidebar }) => (
        <WorkspaceAside
          title="Sales"
          subtitle="Pipeline · delivery · revenue"
          themeKey="sales"
          className="!h-full !w-full !max-w-none"
          headerAction={<SidePanelHamburgerButton open onClick={toggleSidebar} />}
        >
          <SalesSideNav />
        </WorkspaceAside>
      )}
    >
      {children}
    </WorkspaceSidePanelShell>
  );
}
