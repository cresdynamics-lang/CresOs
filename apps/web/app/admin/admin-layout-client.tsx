"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { AdminSideNav } from "./admin-nav";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!isAdmin) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, isAdmin, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading admin…
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-slate-950">
      <WorkspaceAside
        title="Admin"
        subtitle="Users, org & automation"
        themeKey="admin"
        className="hidden w-[15rem] md:flex"
      >
        <AdminSideNav />
      </WorkspaceAside>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
