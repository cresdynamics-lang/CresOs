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

type PendingFinanceApproval = Approval & {
  amount: number | null;
  currency: string | null;
  description: string | null;
  notes: string | null;
};

type PendingInvoice = {
  id: string;
  invoiceNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  totalAmount: number;
  currency: string;
  notes?: string | null;
  createdAt: string;
  client: { name: string; email: string };
  project?: { name: string } | null;
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
  createdBy: { displayName: string };
};

export default function ApprovalsPage() {
  const { apiFetch, auth } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pending, setPending] = useState<PendingFinanceApproval[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [approvalTab, setApprovalTab] = useState<"payments" | "invoices">("payments");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
  const [invoiceRejectionReason, setInvoiceRejectionReason] = useState("");
  const [invoiceApprovalNotes, setInvoiceApprovalNotes] = useState("");

  const isAdmin = auth.roleKeys.includes("admin");
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));
  const isFinanceSubmission = (a: Approval) => a.entityType === "expense" || a.entityType === "payout";

  const load = useCallback(async () => {
    try {
      const [res, pendingRes, invRes] = await Promise.all([
        apiFetch("/finance/approvals"),
        apiFetch("/finance/approvals/pending"),
        apiFetch("/finance/invoices/pending?limit=50&page=1")
      ]);
      if (!res.ok) return;
      const data = (await res.json()) as Approval[];
      setApprovals(data);
      const pendingJson = pendingRes.ok ? ((await pendingRes.json()) as PendingFinanceApproval[]) : [];
      setPending(pendingJson);
      const invJson = invRes.ok
        ? ((await invRes.json()) as { data?: { invoices?: PendingInvoice[] } }).data?.invoices ?? []
        : [];
      setPendingInvoices(invJson);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingFinance = useMemo(() => pending, [pending]);

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

  const approveInvoice = async (invoiceId: string) => {
    setDecidingId(invoiceId);
    try {
      const res = await apiFetch(`/finance/invoices/${invoiceId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: invoiceApprovalNotes || undefined })
      });
      if (res.ok) {
        setSelectedInvoice(null);
        setInvoiceApprovalNotes("");
        await load();
        emitDataRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to approve invoice.");
      }
    } catch {
      // ignore
    } finally {
      setDecidingId(null);
    }
  };

  const rejectInvoice = async (invoiceId: string) => {
    if (!invoiceRejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    setDecidingId(invoiceId);
    try {
      const res = await apiFetch(`/finance/invoices/${invoiceId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: invoiceRejectionReason.trim() })
      });
      if (res.ok) {
        setSelectedInvoice(null);
        setInvoiceRejectionReason("");
        await load();
        emitDataRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to reject invoice.");
      }
    } catch {
      // ignore
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Approval queue"
        description="Unified approvals: invoice approvals + finance expense/payout requests. Admin authorises; Director may view. Declines require a logged note."
      />

      <div className="shell border border-slate-700/70 bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Pending approvals</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setApprovalTab("payments")}
              className={
                approvalTab === "payments"
                  ? "rounded bg-slate-600 px-3 py-2 text-sm text-white"
                  : "rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              }
            >
              Expenses &amp; payouts ({pendingFinance.length})
            </button>
            <button
              type="button"
              onClick={() => setApprovalTab("invoices")}
              className={
                approvalTab === "invoices"
                  ? "rounded bg-slate-600 px-3 py-2 text-sm text-white"
                  : "rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              }
            >
              Invoices ({pendingInvoices.length})
            </button>
          </div>
        </div>

        {approvalTab === "payments" && (
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
                        <p className="mt-0.5 text-xs text-slate-500">{a.description ?? a.reason ?? "—"}</p>
                      </td>
                      <td className="py-3 pr-3 text-right align-top font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {a.amount != null ? formatMoney(a.amount) : "—"}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-300">
                        {a.requester?.name ?? a.requester?.email ?? "—"}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-400 whitespace-nowrap">
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
        )}

        {approvalTab === "invoices" && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">Invoice</th>
                  <th className="pb-2 pr-3">Client</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Created by</th>
                  <th className="pb-2 pr-3">Submitted</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No pending invoices
                    </td>
                  </tr>
                ) : (
                  pendingInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-800/80">
                      <td className="py-3 pr-3 align-top text-slate-200 whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-300">
                        <div className="min-w-0">
                          <p className="truncate text-slate-200">{inv.client?.name ?? "—"}</p>
                          {inv.project?.name ? (
                            <p className="truncate text-xs text-slate-500">Project: {inv.project.name}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right align-top font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {formatMoney(inv.totalAmount)}{" "}
                        {inv.currency ? <span className="text-xs text-slate-500">{inv.currency}</span> : null}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-300">
                        {inv.createdBy?.displayName ?? "—"}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-400 whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 text-right align-top">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="rounded border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
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

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-200">Invoice {selectedInvoice.invoiceNumber}</p>
                <p className="text-xs text-slate-500">
                  {selectedInvoice.client?.name ?? "—"} · {new Date(selectedInvoice.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedInvoice(null);
                  setInvoiceRejectionReason("");
                  setInvoiceApprovalNotes("");
                }}
                className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="shell border border-slate-800 bg-slate-950/40">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{formatMoney(selectedInvoice.totalAmount)}</p>
                </div>
                <div className="shell border border-slate-800 bg-slate-950/40">
                  <p className="text-xs text-slate-400">Created by</p>
                  <p className="mt-1 text-sm text-slate-200">{selectedInvoice.createdBy?.displayName ?? "—"}</p>
                </div>
              </div>

              {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 && (
                <div className="shell border border-slate-800 bg-slate-950/40">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                  <ul className="space-y-2 text-sm">
                    {selectedInvoice.items.map((it) => (
                      <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
                        <span className="text-slate-200">{it.description}</span>
                        <span className="text-slate-400">
                          {it.quantity} × {formatMoney(it.unitPrice)} ={" "}
                          <span className="font-mono tabular-nums text-slate-100">{formatMoney(it.total)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isAdmin ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="shell border border-slate-800 bg-slate-950/40">
                    <p className="mb-2 text-xs text-slate-400">Approval notes (optional)</p>
                    <textarea
                      value={invoiceApprovalNotes}
                      onChange={(e) => setInvoiceApprovalNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      placeholder="Optional notes for approval…"
                    />
                    <button
                      type="button"
                      onClick={() => approveInvoice(selectedInvoice.id)}
                      disabled={decidingId === selectedInvoice.id}
                      className="mt-3 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve invoice
                    </button>
                  </div>
                  <div className="shell border border-slate-800 bg-slate-950/40">
                    <p className="mb-2 text-xs text-slate-400">Rejection reason (required)</p>
                    <textarea
                      value={invoiceRejectionReason}
                      onChange={(e) => setInvoiceRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      placeholder="Why is this invoice rejected?"
                    />
                    <button
                      type="button"
                      onClick={() => rejectInvoice(selectedInvoice.id)}
                      disabled={decidingId === selectedInvoice.id}
                      className="mt-3 rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      Reject invoice
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-300">View only — Admin approves invoices.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
