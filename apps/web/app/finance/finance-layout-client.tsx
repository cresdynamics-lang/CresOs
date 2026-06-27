"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { financeNeu } from "../../components/finance/finance-theme";
import { FinanceNav, FinanceSideNav } from "./finance-nav";

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
      <aside className="hidden w-[15rem] shrink-0 flex-col border-r border-white/[0.04] bg-[#0e1319]/80 md:flex">
        <div className="border-b border-white/[0.04] px-4 py-4">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500/90">
            Finance
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Overview, records, projects &amp; approvals
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FinanceSideNav />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.04] bg-[#0e1319]/60 px-2 py-2 md:hidden">
          <FinanceNav />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
