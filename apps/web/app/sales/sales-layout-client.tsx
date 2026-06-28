"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { salesWs } from "../../components/sales/sales-theme";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { SalesSideNav } from "./sales-workspace-nav";

export function SalesLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
        className={`${salesWs.workspace} flex h-full items-center justify-center text-sm text-slate-400 ${salesWs.canvas}`}
      >
        Loading sales…
      </div>
    );
  }

  if (!canAccessSales) return null;

  return (
    <div
      className={`${salesWs.workspace} ${salesWs.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}
    >
      <WorkspaceAside
        title="Sales"
        subtitle="Pipeline, delivery & reports"
        themeKey="sales"
        className="hidden w-[15rem] md:flex"
      >
        <SalesSideNav />
      </WorkspaceAside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
