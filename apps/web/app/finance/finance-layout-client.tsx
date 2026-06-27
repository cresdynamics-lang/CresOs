"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { financeNeu } from "../../components/finance/finance-theme";
import { FinanceNav } from "./finance-nav";

export function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const canAccessFinance =
    auth.canSeeFinance === true ||
    auth.roleKeys.some((r) => ["admin", "finance", "analyst"].includes(r));
  const isAdmin = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessFinance) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccessFinance, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div className={`${financeNeu.shell} text-sm text-slate-400`}>Loading finance…</div>
    );
  }

  if (!canAccessFinance) return null;

  return (
    <div
      className={`${financeNeu.workspace} ${financeNeu.canvas} flex min-h-[calc(100dvh-6.5rem)] max-lg:min-h-[calc(100dvh-10rem)] flex-col gap-4`}
    >
      <div className={`${financeNeu.shell} shrink-0`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500/80">
              Finance workspace
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">Money in, money out, invoices & ledger</p>
          </div>
          <FinanceNav />
        </div>
        {isAdmin && (
          <p className="mt-3 rounded-xl border border-white/[0.04] bg-[#0e1319] px-3 py-2 text-xs text-slate-500 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.35)]">
            Admin: view and record payments; invoice creation is handled by Finance and Sales.
          </p>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
