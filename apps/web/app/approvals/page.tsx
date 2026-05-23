"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { emitDataRefresh } from "../data-refresh";
import { formatMoney } from "../format-money";
import {
  CrmDataTable,
  CrmSectionPanel,
  CrmTableHead,
  WorkspaceFilterPills,
  WorkspaceGuidelineCard
} from "../../components/crm/crm-section";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { StatCard, StatCardGrid } from "../../components/stat-card";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";

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
  const isFinanceRole = auth.roleKeys.includes("finance");
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
  const totalPending = pendingFinance.length + pendingInvoices.length;

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

  const historyItems = approvals.filter((a) => !isFinanceSubmission(a) || a.status !== "pending");

  const tabToolbar = (
    <WorkspaceFilterPills
      value={approvalTab}
      onChange={setApprovalTab}
      options={[
        {
          value: "payments",
          label: `Expenses & payouts (${pendingFinance.length})`,
          tone: "amber"
        },
        { value: "invoices", label: `Invoices (${pendingInvoices.length})`, tone: "sky" }
      ]}
    />
  );

  return (
    <section className="flex flex-col gap-6">
      <WorkspaceDashboardIntro
        title="Approval queue"
        eyebrow={isFinanceRole ? "Finance" : "Approvals"}
        brandLead="Unified approvals for expenses, payouts, and invoices"
        description="Admin authorises; Director may view. Declines require a logged note."
        showWelcomeBanner
        welcomeChildren={
          <>
            <DashboardSectionLabel roleKeys={auth.roleKeys}>
              Today&apos;s priorities (your queue)
            </DashboardSectionLabel>
            <p className="font-body text-sm leading-relaxed text-slate-400">
              Use <span className="font-medium text-emerald-300">Approval queue</span> and the sections below for live
              data.
            </p>
          </>
        }
      />

      <StatCardGrid>
        <StatCard label="Pending total" value={totalPending} hint="Awaiting decision" tone="brand" />
        <StatCard label="Expenses & payouts" value={pendingFinance.length} hint="Finance requests" tone="amber" />
        <StatCard label="Invoices" value={pendingInvoices.length} hint="Sales / finance drafts" tone="sky" />
        {!isAdmin && isDirector ? (
          <StatCard label="Your access" value="View" hint="Admin approves releases" tone="violet" />
        ) : null}
      </StatCardGrid>

      <CrmSectionPanel
        title="Pending approvals"
        tone="rose"
        description="Review each request, then approve, decline with a note, or open invoices for full detail."
        action={tabToolbar}
      >
        {approvalTab === "payments" && (
          <CrmDataTable emptyMessage="No pending requests" isEmpty={pendingFinance.length === 0}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <CrmTableHead>
                <th className="pb-2 pr-3 font-medium">Request</th>
                <th className="pb-2 pr-3 text-right font-medium">Amount (KES)</th>
                <th className="pb-2 pr-3 font-medium">Requested by</th>
                <th className="pb-2 pr-3 font-medium">Submitted</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </CrmTableHead>
              <tbody>
                {pendingFinance.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/60 hover:bg-amber-500/5">
                    <td className="py-3 pr-3 align-top text-slate-200">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs capitalize text-amber-300">
                        {a.entityType}
                      </span>
                      <span className="ml-1 font-mono text-xs text-slate-500">{a.entityId.slice(0, 8)}…</span>
                      <p className="mt-1 text-xs text-slate-500">{a.description ?? a.reason ?? "—"}</p>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-right align-top font-mono tabular-nums font-semibold text-emerald-400">
                      {a.amount != null ? formatMoney(a.amount) : "—"}
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-300">
                      {a.requester?.name ?? a.requester?.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 align-top text-slate-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-right align-top">
                      {isAdmin ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => decideFinance(a.id, "approved")}
                            disabled={decidingId === a.id}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectWithNote(a.id)}
                            disabled={decidingId === a.id}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-amber-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CrmDataTable>
        )}

        {approvalTab === "invoices" && (
          <CrmDataTable emptyMessage="No pending invoices" isEmpty={pendingInvoices.length === 0}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <CrmTableHead>
                <th className="pb-2 pr-3 font-medium">Invoice</th>
                <th className="pb-2 pr-3 font-medium">Client</th>
                <th className="pb-2 pr-3 text-right font-medium">Amount</th>
                <th className="pb-2 pr-3 font-medium">Created by</th>
                <th className="pb-2 pr-3 font-medium">Submitted</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </CrmTableHead>
              <tbody>
                {pendingInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/60 hover:bg-sky-500/5">
                    <td className="whitespace-nowrap py-3 pr-3 align-top font-medium text-sky-300">
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
                    <td className="whitespace-nowrap py-3 pr-3 text-right align-top font-mono tabular-nums font-semibold text-emerald-400">
                      {formatMoney(inv.totalAmount)}{" "}
                      {inv.currency ? <span className="text-xs font-normal text-slate-500">{inv.currency}</span> : null}
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-300">{inv.createdBy?.displayName ?? "—"}</td>
                    <td className="whitespace-nowrap py-3 pr-3 align-top text-slate-400">
                      {new Date(inv.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CrmDataTable>
        )}
      </CrmSectionPanel>

      <div>
        <p className="mb-3 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
          How to decide
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceGuidelineCard
            tone="emerald"
            title="To approve"
            description="Review amount, purpose, and supporting note. If aligned — approve. The transaction is released to Finance for execution and logged with a timestamp."
          />
          <WorkspaceGuidelineCard
            tone="rose"
            title="To decline"
            description="A written reason is mandatory. The system blocks a decline with no note. The note should state what is missing, what rule is violated, or what must change. Finance is notified."
          />
          <WorkspaceGuidelineCard
            tone="sky"
            title="To request clarification"
            description="Return the request to Finance with questions (workflow may use status or notes). Pauses the request — it is not declined. Follow up if Finance is slow to respond."
          />
          <WorkspaceGuidelineCard
            tone="amber"
            title="24h escalation rule"
            description="Requests pending more than 24 hours trigger in-app alerts to Admins (and can surface on the Admin Oversight view). Resolve or clarify promptly to clear the queue."
          />
        </div>
      </div>

      {historyItems.length > 0 && (
        <CrmSectionPanel title="Other approvals & history" tone="violet" description="Recently decided or non-finance items.">
          <ul className="space-y-2 text-sm">
            {historyItems.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-slate-950/40 px-3 py-2.5"
              >
                <div>
                  <p className="font-medium text-slate-100">
                    {a.entityType} · {a.entityId.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-slate-400">{a.reason ?? "No reason provided"}</p>
                  {isDirector && isFinanceSubmission(a) && !isAdmin && (
                    <p className="mt-1 text-xs text-amber-400">View only — admin approves</p>
                  )}
                </div>
                <span className="rounded-full border border-slate-600/50 bg-slate-800/60 px-2 py-0.5 text-xs uppercase text-slate-400">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </CrmSectionPanel>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-sky-500/30 bg-slate-950 shadow-[0_0_48px_-12px_rgba(14,165,233,0.35)]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="font-display text-lg font-bold text-sky-300">Invoice {selectedInvoice.invoiceNumber}</p>
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
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/80">Total</p>
                  <p className="mt-1 font-display text-xl font-bold text-emerald-300">
                    {formatMoney(selectedInvoice.totalAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-sky-400/80">Created by</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">{selectedInvoice.createdBy?.displayName ?? "—"}</p>
                </div>
              </div>

              {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <p className="mb-2 font-label text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Items
                  </p>
                  <ul className="space-y-2 text-sm">
                    {selectedInvoice.items.map((it) => (
                      <li
                        key={it.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                      >
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
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <p className="mb-2 text-xs font-medium text-emerald-400">Approval notes (optional)</p>
                    <textarea
                      value={invoiceApprovalNotes}
                      onChange={(e) => setInvoiceApprovalNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      placeholder="Optional notes for approval…"
                    />
                    <button
                      type="button"
                      onClick={() => approveInvoice(selectedInvoice.id)}
                      disabled={decidingId === selectedInvoice.id}
                      className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve invoice
                    </button>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                    <p className="mb-2 text-xs font-medium text-rose-400">Rejection reason (required)</p>
                    <textarea
                      value={invoiceRejectionReason}
                      onChange={(e) => setInvoiceRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      placeholder="Why is this invoice rejected?"
                    />
                    <button
                      type="button"
                      onClick={() => rejectInvoice(selectedInvoice.id)}
                      disabled={decidingId === selectedInvoice.id}
                      className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      Reject invoice
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium text-amber-300">View only — Admin approves invoices.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
