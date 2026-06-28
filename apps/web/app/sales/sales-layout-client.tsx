"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { salesNeu } from "../../components/sales/sales-theme";
import { SalesSideNav } from "./sales-workspace-nav";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";

export function SalesLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = useWorkspaceLogout();
  const { auth, hydrated } = useAuth();
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
        className={`${salesNeu.workspace} sales-fullscreen flex h-full items-center justify-center text-sm text-slate-400 ${salesNeu.canvas}`}
      >
        Loading sales…
      </div>
    );
  }

  if (!canAccessSales) return null;

  return (
    <div
      className={`${salesNeu.workspace} sales-fullscreen ${salesNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
    >
      <WorkspaceAside
        title="Sales"
        subtitle="Pipeline · delivery · revenue"
        themeKey="sales"
        className="hidden w-[15rem] md:flex"
        footer={<WorkspaceAccountFooter themeKey="sales" onLogout={handleLogout} showAccountLink={false} />}
      >
        <SalesSideNav />
      </WorkspaceAside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
