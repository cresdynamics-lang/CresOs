"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { devNeu } from "../../components/developer/developer-theme";
import { DeveloperSideNav } from "./developer-nav";
import { canAccessDeveloperWorkspace } from "../../lib/developer-workspace-access";
import {
  SidePanelHamburgerButton,
  WorkspaceSidePanelShell
} from "../../components/workspace/workspace-side-panel-shell";

const SIDEBAR_STORAGE_KEY = "cresos.developer.sidebarOpen";

function pageTitle(pathname: string | null): string {
  if (!pathname) return "Overview";
  if (pathname === "/developer" || pathname === "/developer/") return "Overview";
  if (pathname.startsWith("/developer/onboarding")) return "Playbook";
  if (pathname.startsWith("/schedule")) return "Tasks";
  if (pathname.startsWith("/developer-reports")) return "Reports";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/community")) return "Community";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Developer";
}

export function DeveloperLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { auth, hydrated } = useAuth();
  const canAccess = canAccessDeveloperWorkspace(auth.roleKeys);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${devNeu.workspace} developer-fullscreen flex min-h-[16rem] flex-1 items-center justify-center text-sm text-[#8A8886] ${devNeu.canvas}`}
      >
        Loading developer workspace…
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div
        className={`${devNeu.workspace} developer-fullscreen flex min-h-[16rem] flex-1 items-center justify-center px-6 text-center text-sm text-[#8A8886] ${devNeu.canvas}`}
      >
        Developer access required. Redirecting…
      </div>
    );
  }

  return (
    <WorkspaceSidePanelShell
      storageKey={SIDEBAR_STORAGE_KEY}
      shellClassName={`${devNeu.workspace} developer-fullscreen ${devNeu.canvas}`}
      pageTitle={pageTitle(pathname)}
      fallbackHref="/developer"
      renderPanel={({ toggleSidebar }) => (
        <WorkspaceAside
          title="Developer"
          subtitle="Tasks · reports · delivery"
          themeKey="developer"
          className="!h-full !w-full !max-w-none"
          headerAction={<SidePanelHamburgerButton open onClick={toggleSidebar} />}
        >
          <DeveloperSideNav />
        </WorkspaceAside>
      )}
    >
      {children}
    </WorkspaceSidePanelShell>
  );
}
