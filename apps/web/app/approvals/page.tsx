"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { emitDataRefresh } from "../data-refresh";
import { formatMoney } from "../format-money";
import { PageHeader } from "../page-header";

type Approval = {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  reason: string | null;
  createdAt: string;
  requester?: { id: string; name: string | null; email: string } | null;
};

export default function ApprovalsPage() {
  const { apiFetch, auth } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number | null>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const isAdmin = auth.roleKeys.includes("admin");
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));
  const isFinanceSubmission = (a: Approval) => a.entityType === "expense" || a.entityType === "payout";

  const load = useCallback(async () => {
    try {
      const [res, expRes, payRes] = await Promise.all([
        apiFetch("/finance/approvals"),
        apiFetch("/finance/expenses"),
        apiFetch("/finance/payouts")
      ]);
      if (!res.ok) return;
      const data = (await res.json()) as Approval[];
      setApprovals(data);

      const expenses = expRes.ok ? ((await expRes.json()) as { id: string; amount: number }[]) : [];
      const payouts = payRes.ok ? ((await payRes.json()) as { id: string; amount: number }[]) : [];
      const expById = new Map(expenses.map((e) => [e.id, Number(e.amount)]));
      const payById = new Map(payouts.map((p) => [p.id, Number(p.amount)]));
      const nextAmounts: Record<string, number | null> = {};
      for (const a of data) {
        if (a.entityType === "expense") nextAmounts[a.id] = expById.get(a.entityId) ?? null;
        else if (a.entityType === "payout") nextAmounts[a.id] = payById.get(a.entityId) ?? null;
      }
      setAmounts(nextAmounts);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingFinance = useMemo(
    () => approvals.filter((a) => isFinanceSubmission(a) && a.status === "pending"),
    [approvals]
  );

  const decideFinance = async (
    approvalId: string,
    status: "approved" | "rejected" | "cancelled",
    note?: string
  ) => {
    setDecidingId(approvalId);
    try {
      const res = await apiFetch(`/admin/finance-approvals/${approvalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ status, note })
      });
      if (res.ok) {
        await load();
        emitDataRefresh();
      } else if (status === "rejected") {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Decline requires a written explanation.");
      }
    } catch {
      // ignore
    } finally {
      setDecidingId(null);
    }
  };

  const rejectWithNote = async (approvalId: string) => {
    const note = window.prompt(
      "Decline requires a written explanation: what is missing, which rule is violated, or what must change before re-submission."
    );
    if (note === null) return;
    if (!note.trim()) {
      alert("Please enter an explanation to decline this request.");
      return;
    }
    await decideFinance(approvalId, "rejected", note.trim());
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Approval queue"
        description="Finance expense and payout requests. Admin authorises; Director may view. Declines require a logged note."
      />

      <div className="shell border border-amber-600/40 bg-slate-950/40">
        <h3 className="text-sm font-semibold text-amber-100">Pending approval requests</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">Request</th>
                <th className="pb-2 pr-3 text-right">Amount (KES)</th>
                <th className="pb-2 pr-3">Requested by</th>
                <th className="pb-2 pr-3">Submitted</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingFinance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No pending requests
                  </td>
                </tr>
              ) : (
                pendingFinance.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/80">
                    <td className="py-3 pr-3 align-top text-slate-200">
                      <span className="capitalize">{a.entityType}</span> · {a.entityId.slice(0, 8)}…
                      <p className="mt-0.5 text-xs text-slate-500">{a.reason ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-3 text-right align-top text-slate-200">
                      {amounts[a.id] != null ? formatMoney(amounts[a.id]!) : "—"}
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-300">
                      {a.requester?.name ?? a.requester?.email ?? "—"}
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-right align-top">
                      {isAdmin ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => decideFinance(a.id, "approved")}
                            disabled={decidingId === a.id}
                            className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectWithNote(a.id)}
                            disabled={decidingId === a.id}
                            className="rounded bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="shell border-l-4 border-emerald-500/70 bg-slate-900/40">
          <h4 className="text-sm font-semibold text-emerald-200">To approve</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Review amount, purpose, and supporting note. If aligned — approve. The transaction is released to Finance for execution and logged with a timestamp.
          </p>
        </div>
        <div className="shell border-l-4 border-rose-500/70 bg-slate-900/40">
          <h4 className="text-sm font-semibold text-rose-200">To decline</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            A written reason is mandatory. The system blocks a decline with no note. The note should state what is missing, what rule is violated, or what must change. Finance is notified.
          </p>
        </div>
        <div className="shell border-l-4 border-sky-500/70 bg-slate-900/40">
          <h4 className="text-sm font-semibold text-sky-200">To request clarification</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Return the request to Finance with questions (workflow may use status or notes). Pauses the request — it is not declined. Follow up if Finance is slow to respond.
          </p>
        </div>
        <div className="shell border-l-4 border-amber-500/70 bg-slate-900/40">
          <h4 className="text-sm font-semibold text-amber-200">24h escalation rule</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Requests pending more than 24 hours trigger in-app alerts to Admins (and can surface on the Admin Oversight view). Resolve or clarify promptly to clear the queue.
          </p>
        </div>
      </div>

      {approvals.some((a) => !isFinanceSubmission(a) || a.status !== "pending") && (
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Other approvals &amp; history</p>
          <ul className="space-y-2 text-sm">
            {approvals
              .filter((a) => !isFinanceSubmission(a) || a.status !== "pending")
              .map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <div>
                    <p className="text-slate-100">
                      {a.entityType} · {a.entityId.slice(0, 8)}…
                    </p>
                    <p className="text-xs text-slate-400">{a.reason ?? "No reason provided"}</p>
                    {isDirector && isFinanceSubmission(a) && !isAdmin && (
                      <p className="mt-1 text-xs text-amber-400">View only — admin approves</p>
                    )}
                  </div>
                  <span className="text-xs uppercase text-slate-400">{a.status}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
