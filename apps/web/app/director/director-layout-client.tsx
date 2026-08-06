"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { directorNeu } from "../../components/director/director-theme";
import { DirectorSideNav } from "./director-nav";
import { isDirectorOnly } from "../../lib/is-director-only";
import {
  WorkspaceSidePanelShell
} from "../../components/workspace/workspace-side-panel-shell";

const SIDEBAR_STORAGE_KEY = "cresos.director.sidebarOpen";

function pageTitle(pathname: string | null): string {
  if (!pathname) return "Director";
  if (pathname === "/dashboard") return "Command center";
  if (pathname.startsWith("/director/crm")) return "CRM";
  if (pathname.startsWith("/director/reports")) return "Reports";
  if (pathname.startsWith("/director/onboarding")) return "Playbook";
  if (pathname.startsWith("/director/messages")) return "Mails";
  if (pathname.startsWith("/sales/messages")) return "Mails";
  if (pathname.startsWith("/sales/invoices")) return "Invoices";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/crm")) return "Contacts";
  if (pathname.startsWith("/schedule")) return "Tasks";
  if (pathname.startsWith("/reports/ai")) return "AI summaries";
  if (pathname.startsWith("/reports")) return "Sales reports";
  if (pathname.startsWith("/developer-reports")) return "Developer reports";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/approvals")) return "Approvals";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/activity")) return "Activity";
  if (pathname.startsWith("/community")) return "Community";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Director";
}

export function DirectorLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { auth, hydrated } = useAuth();
  const canAccess = isDirectorOnly(auth.roleKeys);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${directorNeu.workspace} director-fullscreen flex h-full items-center justify-center text-sm text-[#8A8886] ${directorNeu.canvas}`}
      >
        Loading director workspace…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <WorkspaceSidePanelShell
      storageKey={SIDEBAR_STORAGE_KEY}
      shellClassName={`${directorNeu.workspace} director-fullscreen ${directorNeu.canvas}`}
      pageTitle={pageTitle(pathname)}
      fallbackHref="/dashboard"
      renderPanel={({ closeSidebarMobile }) => (
        <WorkspaceAside
          title="Director"
          subtitle="CRM · reports · delivery"
          themeKey="director"
          className="!h-full !w-full !max-w-none"
        >
          <DirectorSideNav onNavigate={closeSidebarMobile} />
        </WorkspaceAside>
      )}
    >
      {children}
    </WorkspaceSidePanelShell>
  );
}
