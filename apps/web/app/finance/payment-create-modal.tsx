"use client";

import type { FormEvent } from "react";
import { financeNeu } from "../../components/finance/finance-theme";
import { formatMoney } from "../format-money";

type ProjectOption = { id: string; name: string };
type InvoiceOption = {
  id: string;
  number: string;
  totalAmount: number;
  projectId: string | null;
  project: { id: string; name: string } | null;
};

export type PaymentFormState = {
  projectId: string;
  invoiceId: string;
  amount: string;
  source: string;
  account: string;
  reference: string;
  receivedAt: string;
};

type PaymentCreateModalProps = {
  open: boolean;
  onClose: () => void;
  form: PaymentFormState;
  setForm: React.Dispatch<React.SetStateAction<PaymentFormState>>;
  projects: ProjectOption[];
  invoices: InvoiceOption[];
  submitError: string | null;
  onSubmit: (e: FormEvent) => void;
};

export function PaymentCreateModal({
  open,
  onClose,
  form,
  setForm,
  projects,
  invoices,
  submitError,
  onSubmit
}: PaymentCreateModalProps) {
  if (!open) return null;

  const projectInvoices = form.projectId
    ? invoices.filter((inv) => inv.projectId === form.projectId)
    : invoices;

  const selectedInvoice = invoices.find((inv) => inv.id === form.invoiceId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="finance-neu relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.06] bg-[#121820] shadow-[8px_8px_24px_rgba(0,0,0,0.65),-4px_-4px_16px_rgba(255,255,255,0.04)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <h2 id="payment-modal-title" className="text-lg font-semibold text-emerald-100">
            Record payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center ${financeNeu.btnGhost}`}
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
          {submitError && (
            <p className="mb-3 rounded border border-rose-800 bg-rose-950/40 px-2 py-1.5 text-xs text-rose-200">
              {submitError}
            </p>
          )}

          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Link the payment to a project and invoice. The client receives a confirmation email with project progress
            once recorded.
          </p>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Project</span>
              <select
                value={form.projectId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    projectId: e.target.value,
                    invoiceId: f.invoiceId && invoices.find((i) => i.id === f.invoiceId)?.projectId === e.target.value ? f.invoiceId : ""
                  }))
                }
                className={financeNeu.input}
                required
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Invoice</span>
              <select
                value={form.invoiceId}
                onChange={(e) => {
                  const inv = invoices.find((i) => i.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    invoiceId: e.target.value,
                    projectId: inv?.projectId ?? f.projectId
                  }));
                }}
                className={financeNeu.input}
                required
                disabled={!form.projectId && projectInvoices.length === 0}
              >
                <option value="">Select invoice</option>
                {projectInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number}
                    {inv.project ? ` — ${inv.project.name}` : ""} · {formatMoney(inv.totalAmount)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Amount (KES)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount received"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={financeNeu.input}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Received from</span>
              <input
                type="text"
                placeholder="Client name or payer"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className={financeNeu.input}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Settled on account
              </span>
              <input
                type="text"
                placeholder="e.g. KCB business, M-Pesa till"
                value={form.account}
                onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
                className={financeNeu.input}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Transaction reference
              </span>
              <input
                type="text"
                placeholder="M-Pesa code or bank reference"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                className={financeNeu.input}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Transaction time</span>
              <input
                type="datetime-local"
                value={form.receivedAt}
                onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))}
                className={financeNeu.input}
                required
              />
            </label>

            {selectedInvoice && (
              <p className="text-xs text-slate-500">
                Applying to invoice <span className="text-slate-300">{selectedInvoice.number}</span>
                {selectedInvoice.project ? ` · ${selectedInvoice.project.name}` : ""}
              </p>
            )}
          </div>

          <div className="safe-area-bottom mt-4 flex shrink-0 gap-2 border-t border-white/[0.06] pt-4">
            <button type="button" onClick={onClose} className={`flex-1 ${financeNeu.btnGhost}`}>
              Cancel
            </button>
            <button type="submit" className={`flex-1 ${financeNeu.btnPrimary}`}>
              Record payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
