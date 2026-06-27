"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { salesWs } from "../../components/sales/sales-theme";
import { SalesNav, SalesSideNav } from "./sales-workspace-nav";

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
      <aside className="hidden w-[13.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-[#0e1118]/90 md:flex">
        <div className="border-b border-white/[0.06] px-4 py-4">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            Sales
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SalesSideNav />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0e1118]/70 px-2 py-2 md:hidden">
          <SalesNav />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
