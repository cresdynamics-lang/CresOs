"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { devNeu } from "../../components/developer/developer-theme";
import { DeveloperNav, DeveloperSideNav } from "./developer-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";
import { canAccessDeveloperWorkspace } from "../../lib/developer-workspace-access";

export function DeveloperLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = useWorkspaceLogout();
  const { auth, hydrated } = useAuth();
  const canAccess = canAccessDeveloperWorkspace(auth.roleKeys);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${devNeu.workspace} developer-fullscreen flex min-h-[16rem] flex-1 items-center justify-center text-sm text-slate-400 ${devNeu.canvas}`}
      >
        Loading developer workspace…
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div
        className={`${devNeu.workspace} developer-fullscreen flex min-h-[16rem] flex-1 items-center justify-center px-6 text-center text-sm text-slate-400 ${devNeu.canvas}`}
      >
        Developer access required. Redirecting…
      </div>
    );
  }

  return (
    <div
      className={`${devNeu.workspace} developer-fullscreen ${devNeu.canvas} flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row`}
    >
      <WorkspaceAside
        title="Developer"
        subtitle="Tasks · reports · delivery"
        themeKey="developer"
        className="hidden w-[15rem] md:flex"
        footer={<WorkspaceAccountFooter themeKey="developer" onLogout={handleLogout} showAccountLink={false} showIdentity={false} />}
      >
        <DeveloperSideNav />
      </WorkspaceAside>

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
