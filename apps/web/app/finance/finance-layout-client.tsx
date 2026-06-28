"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceAside } from "../../components/workspace/workspace-aside";
import { WorkspaceAccountFooter } from "../../components/workspace/workspace-account-footer";
import { financeNeu } from "../../components/finance/finance-theme";
import { FinanceSideNav } from "./finance-nav";
import { LeadershipLayoutGate } from "../../components/workspace/leadership-layout-gate";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";
import { isDirectorOnly } from "../../lib/is-director-only";
import { isAdminOnly } from "../../lib/is-admin-only";

export function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handleLogout = useWorkspaceLogout();
  const { auth, hydrated } = useAuth();

  if (isDirectorOnly(auth.roleKeys) || isAdminOnly(auth.roleKeys)) {
    return <LeadershipLayoutGate>{children}</LeadershipLayoutGate>;
  }

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
        footer={<WorkspaceAccountFooter themeKey="finance" onLogout={handleLogout} showAccountLink={false} showIdentity={false} />}
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
