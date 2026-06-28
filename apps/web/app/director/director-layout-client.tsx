"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { directorNeu } from "../../components/director/director-theme";
import { DirectorNav, DirectorSideNav } from "./director-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";
import { isDirectorOnly } from "../../lib/is-director-only";

export function DirectorLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = useWorkspaceLogout();
  const { auth, hydrated } = useAuth();
  const canAccess = isDirectorOnly(auth.roleKeys);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${directorNeu.workspace} director-fullscreen flex h-full items-center justify-center text-sm text-slate-400 ${directorNeu.canvas}`}
      >
        Loading director workspace…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div
      className={`${directorNeu.workspace} director-fullscreen ${directorNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
    >
      <WorkspaceAside
        title="Director"
        subtitle="Command · pipeline · delivery"
        themeKey="director"
        className="hidden w-[15rem] md:flex"
        footer={
          <WorkspaceAccountFooter themeKey="director" onLogout={handleLogout} showAccountLink={false} showIdentity={false} />
        }
      >
        <DirectorSideNav />
      </WorkspaceAside>

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
