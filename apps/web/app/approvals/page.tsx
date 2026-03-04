"use client";

import { useEffect, useState } from "react";
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
  const { apiFetch } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/finance/approvals");
        if (!res.ok) return;
        const data = (await res.json()) as Approval[];
        setApprovals(data);
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Approvals</h2>
        <p className="text-sm text-slate-300">
          One place to approve invoices, payments, expenses, payouts, and key
          delivery milestones.
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
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div>
                <p className="text-slate-100">
                  {a.entityType} · {a.entityId}
                </p>
                <p className="text-xs text-slate-400">
                  {a.reason ?? "No reason provided"}
                </p>
              </div>
              <span className="text-xs text-amber-400 uppercase">
                {a.status}
              </span>
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

