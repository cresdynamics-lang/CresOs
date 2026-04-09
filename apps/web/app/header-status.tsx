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
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300">
        <NotificationBell />
      </div>
      {canSeeApprovals && !isAdmin && (
        <Link
          href="/approvals"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            approvalsWarn
              ? "border-amber-500/60 bg-amber-950/40 text-amber-200 hover:bg-amber-950/60"
              : "border-sky-700/60 bg-sky-950/30 text-sky-200 hover:bg-sky-950/50"
          }`}
        >
          {pendingFinance} pending approval{pendingFinance === 1 ? "" : "s"}
        </Link>
      )}
    </div>
  );
}
