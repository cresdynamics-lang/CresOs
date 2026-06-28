"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { financeNeu } from "../../components/finance/finance-theme";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { FinanceSideNav } from "./finance-nav";

export function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const canAccessFinance =
    auth.canSeeFinance === true ||
    auth.roleKeys.some((r) => ["admin", "finance", "analyst", "director_admin"].includes(r));

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessFinance) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccessFinance, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className={`${financeNeu.workspace} finance-fullscreen flex h-full items-center justify-center text-sm text-slate-400`}>
        Loading finance…
      </div>
    );
  }

  if (!canAccessFinance) return null;

  return (
    <div className={`${financeNeu.workspace} finance-fullscreen ${financeNeu.canvas} flex h-full min-h-0 w-full flex-1 overflow-hidden`}>
      <WorkspaceAside
        title="Finance"
        subtitle="Payments in · salaries & ops out"
        themeKey="finance"
        className="hidden w-[15rem] md:flex"
      >
        <FinanceSideNav />
      </WorkspaceAside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
