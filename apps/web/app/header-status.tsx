"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { subscribeDataRefresh } from "./data-refresh";
import { NotificationBell } from "./notification-bell";

/**
 * Header pills: notification bell + copy counts, pending finance approvals (role-gated).
 */
export function HeaderStatusStrip() {
  const { apiFetch, auth } = useAuth();
  const [unseen, setUnseen] = useState(0);
  const [pendingFinance, setPendingFinance] = useState(0);
  const canSeeApprovals = auth.roleKeys.some((r) =>
    ["admin", "director_admin", "finance"].includes(r)
  );

  const load = useCallback(async () => {
    try {
      const nRes = await apiFetch("/notifications/me/unseen-count");
      if (nRes.ok) {
        const j = (await nRes.json()) as { count?: number };
        setUnseen(j.count ?? 0);
      }
      if (canSeeApprovals) {
        const aRes = await apiFetch("/finance/approvals");
        if (aRes.ok) {
          const list = (await aRes.json()) as { status: string; entityType: string }[];
          const n = list.filter(
            (a) =>
              a.status === "pending" &&
              (a.entityType === "expense" || a.entityType === "payout")
          ).length;
          setPendingFinance(n);
        }
      }
    } catch {
      // ignore
    }
  }, [apiFetch, canSeeApprovals]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeDataRefresh(() => void load());
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [load]);

  const approvalsWarn = pendingFinance > 3;
  const isAdmin = auth.roleKeys.includes("admin");

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-[#f5f9fc] px-2 py-1 text-xs text-slate-600 sm:gap-2 sm:px-2.5 sm:py-1.5">
        <NotificationBell />
      </div>
      {canSeeApprovals && !isAdmin && (
        <Link
          href="/approvals"
          className={`min-h-[36px] touch-manipulation whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:min-h-0 sm:px-3 sm:text-xs ${
            approvalsWarn
              ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
          }`}
        >
          <span className="sm:hidden">{pendingFinance} pending</span>
          <span className="hidden sm:inline">
            {pendingFinance} pending approval{pendingFinance === 1 ? "" : "s"}
          </span>
        </Link>
      )}
    </div>
  );
}
