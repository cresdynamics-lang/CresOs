"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { clientNeu } from "../../components/client/client-theme";
import { ClientNav, ClientSideNav } from "./client-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";

export function ClientLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = useWorkspaceLogout();
  const { auth, hydrated } = useAuth();
  const canAccess = auth.roleKeys.includes("client");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${clientNeu.workspace} client-fullscreen flex h-full items-center justify-center text-sm text-slate-400 ${clientNeu.canvas}`}
      >
        Loading client portal…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div
      className={`${clientNeu.workspace} client-fullscreen ${clientNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
    >
      <WorkspaceAside
        title="Client portal"
        subtitle="Your projects & progress"
        themeKey="client"
        className="hidden w-[15rem] md:flex"
        footer={
          <WorkspaceAccountFooter themeKey="client" onLogout={handleLogout} showAccountLink={false} showIdentity={false} />
        }
      >
        <ClientSideNav />
      </WorkspaceAside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 md:hidden">
          <ClientNav />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
