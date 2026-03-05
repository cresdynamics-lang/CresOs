"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type Approval = {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

export default function ApprovalsPage() {
  const { apiFetch, auth } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const isAdmin = auth.roleKeys.includes("admin");
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));
  const isFinanceSubmission = (a: Approval) => a.entityType === "expense" || a.entityType === "payout";

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/finance/approvals");
      if (!res.ok) return;
      const data = (await res.json()) as Approval[];
      setApprovals(data);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const decideFinance = async (approvalId: string, status: "approved" | "rejected" | "cancelled", note?: string) => {
    setDecidingId(approvalId);
    try {
      const res = await apiFetch(`/admin/finance-approvals/${approvalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ status, note })
      });
      if (res.ok) load();
    } catch {
      // ignore
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Approvals</h2>
        <p className="text-sm text-slate-300">
          Finance submits expenses and payouts for admin approval. Director can view but cannot approve; only admin approves payment submissions.
        </p>
      </div>
      <div className="shell">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Pending approvals
        </p>
        <ul className="space-y-2 text-sm">
          {approvals.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div>
                <p className="text-slate-100">
                  {a.entityType} · {a.entityId.slice(0, 8)}…
                </p>
                <p className="text-xs text-slate-400">
                  {a.reason ?? "No reason provided"}
                </p>
                {isDirector && isFinanceSubmission(a) && !isAdmin && (
                  <p className="mt-1 text-xs text-amber-400">View only — admin approves</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-slate-400">{a.status}</span>
                {isAdmin && isFinanceSubmission(a) && a.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => decideFinance(a.id, "approved")}
                      disabled={decidingId === a.id}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decideFinance(a.id, "rejected")}
                      disabled={decidingId === a.id}
                      className="rounded bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
          {approvals.length === 0 && (
            <li className="text-sm text-slate-400">
              No approvals pending.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

