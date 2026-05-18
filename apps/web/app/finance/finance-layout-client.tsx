"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { FinanceNav } from "./finance-nav";

export function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const canAccessFinance = auth.roleKeys.some((r) =>
    ["admin", "finance", "analyst", "director_admin"].includes(r)
  );
  const isAdmin = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessFinance) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccessFinance, router]);

  if (!hydrated || !auth.accessToken) {
    return <div className="shell text-sm text-slate-400">Loading finance…</div>;
  }

  if (!canAccessFinance) return null;

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] max-lg:min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div className="shell shrink-0 border border-slate-700/70 bg-slate-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Finance</p>
          <FinanceNav />
        </div>
        {isAdmin && (
          <p className="mt-2 text-xs text-slate-500">
            Admin: view and record payments; invoice creation is handled by Finance and Sales.
          </p>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
