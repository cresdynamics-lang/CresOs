"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { adminNeu } from "../../components/admin/admin-theme";
import { AdminNav, AdminSideNav } from "./admin-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = useWorkspaceLogout();
  const { auth, hydrated } = useAuth();
  const canAccess = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${adminNeu.workspace} admin-fullscreen flex h-full items-center justify-center text-sm text-slate-400 ${adminNeu.canvas}`}
      >
        Loading admin workspace…
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div
      className={`${adminNeu.workspace} admin-fullscreen ${adminNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
    >
      <WorkspaceAside
        title="Admin"
        subtitle="Governance · users · org"
        themeKey="admin"
        className="hidden w-[15rem] md:flex"
        footer={
          <WorkspaceAccountFooter themeKey="admin" onLogout={handleLogout} showAccountLink={false} showIdentity={false} />
        }
      >
        <AdminSideNav />
      </WorkspaceAside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 md:hidden">
          <AdminNav />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
