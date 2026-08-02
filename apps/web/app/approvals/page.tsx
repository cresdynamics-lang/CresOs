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
    <section className="flex w-full min-w-0 flex-col gap-5 bg-white pb-6">
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
            <p className="font-body text-sm leading-relaxed text-[#605E5C]">
              Use <span className="font-semibold text-[#0B6A0B]">Approval queue</span> and the sections below for live
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
                  <tr key={a.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-3 align-top text-[#242424]">
                      <span className="rounded-md border border-[#E8D48A] bg-white px-2 py-0.5 text-xs font-semibold capitalize text-[#8A7000]">
                        {a.entityType}
                      </span>
                      <span className="ml-1 font-mono text-xs text-[#8A8886]">{a.entityId.slice(0, 8)}…</span>
                      <p className="mt-1 text-xs text-[#605E5C]">{a.description ?? a.reason ?? "—"}</p>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-right align-top font-mono tabular-nums font-semibold text-[#0B6A0B]">
                      {a.amount != null ? formatMoney(a.amount) : "—"}
                    </td>
                    <td className="py-3 pr-3 align-top text-[#242424]">
                      {a.requester?.name ?? a.requester?.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 align-top text-[#605E5C]">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-right align-top">
                      {isAdmin ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => decideFinance(a.id, "approved")}
                            disabled={decidingId === a.id}
                            className="rounded-md bg-[#0B6A0B] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#095609] disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectWithNote(a.id)}
                            disabled={decidingId === a.id}
                            className="rounded-md bg-[#C50F1F] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#A50D1A] disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-[#8A7000]">View only</span>
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
                  <tr key={inv.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="whitespace-nowrap py-3 pr-3 align-top font-medium text-[#005CAB]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 pr-3 align-top text-[#242424]">
                      <div className="min-w-0">
                        <p className="truncate text-[#242424]">{inv.client?.name ?? "—"}</p>
                        {inv.project?.name ? (
                          <p className="truncate text-xs text-[#605E5C]">Project: {inv.project.name}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-right align-top font-mono tabular-nums font-semibold text-[#0B6A0B]">
                      {formatMoney(inv.totalAmount)}{" "}
                      {inv.currency ? <span className="text-xs font-normal text-[#8A8886]">{inv.currency}</span> : null}
                    </td>
                    <td className="py-3 pr-3 align-top text-[#242424]">{inv.createdBy?.displayName ?? "—"}</td>
                    <td className="whitespace-nowrap py-3 pr-3 align-top text-[#605E5C]">
                      {new Date(inv.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="rounded-md border border-[#005CAB] bg-white px-2.5 py-1 text-xs font-semibold text-[#005CAB] hover:bg-[#005CAB] hover:text-white"
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
        <p className="mb-3 font-label text-[11px] font-semibold tracking-wide text-[#605E5C]">
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#C5B0DF] bg-white px-3 py-2.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]"
              >
                <div>
                  <p className="font-medium text-[#242424]">
                    {a.entityType} · {a.entityId.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-[#605E5C]">{a.reason ?? "No reason provided"}</p>
                  {isDirector && isFinanceSubmission(a) && !isAdmin && (
                    <p className="mt-1 text-xs text-[#8A7000]">View only — admin approves</p>
                  )}
                </div>
                <span className="rounded-md border border-[#E1DFDD] bg-white px-2 py-0.5 text-xs font-semibold uppercase text-[#605E5C]">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </CrmSectionPanel>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-[#E1DFDD] bg-white shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between border-b border-[#E1DFDD] px-5 py-4">
              <div>
                <p className="font-display text-lg font-bold text-[#005CAB]">Invoice {selectedInvoice.invoiceNumber}</p>
                <p className="text-xs text-[#605E5C]">
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
                className="rounded-md border border-[#D1D1D1] bg-white px-3 py-1.5 text-sm text-[#242424] hover:bg-[#F5F5F5]"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#A8D5A8] border-l-4 border-l-[#0B6A0B] bg-white p-4">
                  <p className="text-xs font-semibold tracking-wide text-[#605E5C]">Total</p>
                  <p className="mt-1 font-display text-xl font-bold text-[#0B6A0B]">
                    {formatMoney(selectedInvoice.totalAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#B4CDE8] border-l-4 border-l-[#005CAB] bg-white p-4">
                  <p className="text-xs font-semibold tracking-wide text-[#605E5C]">Created by</p>
                  <p className="mt-1 text-sm font-medium text-[#242424]">{selectedInvoice.createdBy?.displayName ?? "—"}</p>
                </div>
              </div>

              {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 && (
                <div className="rounded-lg border border-[#E1DFDD] bg-white p-4">
                  <p className="mb-2 font-label text-[11px] font-semibold tracking-wide text-[#605E5C]">
                    Items
                  </p>
                  <ul className="space-y-2 text-sm">
                    {selectedInvoice.items.map((it) => (
                      <li
                        key={it.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E1DFDD] bg-white px-3 py-2"
                      >
                        <span className="text-[#242424]">{it.description}</span>
                        <span className="text-[#605E5C]">
                          {it.quantity} × {formatMoney(it.unitPrice)} ={" "}
                          <span className="font-mono tabular-nums text-[#242424]">{formatMoney(it.total)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isAdmin ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#A8D5A8] border-l-4 border-l-[#0B6A0B] bg-white p-4">
                    <p className="mb-2 text-xs font-semibold text-[#0B6A0B]">Approval notes (optional)</p>
                    <textarea
                      value={invoiceApprovalNotes}
                      onChange={(e) => setInvoiceApprovalNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                      placeholder="Optional notes for approval…"
                    />
                    <button
                      type="button"
                      onClick={() => approveInvoice(selectedInvoice.id)}
                      disabled={decidingId === selectedInvoice.id}
                      className="mt-3 rounded-md bg-[#0B6A0B] px-3 py-2 text-sm font-semibold text-white hover:bg-[#095609] disabled:opacity-50"
                    >
                      Approve invoice
                    </button>
                  </div>
                  <div className="rounded-lg border border-[#E8A0A6] border-l-4 border-l-[#C50F1F] bg-white p-4">
                    <p className="mb-2 text-xs font-semibold text-[#C50F1F]">Rejection reason (required)</p>
                    <textarea
                      value={invoiceRejectionReason}
                      onChange={(e) => setInvoiceRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                      placeholder="Why is this invoice rejected?"
                    />
                    <button
                      type="button"
                      onClick={() => rejectInvoice(selectedInvoice.id)}
                      disabled={decidingId === selectedInvoice.id}
                      className="mt-3 rounded-md bg-[#C50F1F] px-3 py-2 text-sm font-semibold text-white hover:bg-[#A50D1A] disabled:opacity-50"
                    >
                      Reject invoice
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium text-[#8A7000]">View only — Admin approves invoices.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
