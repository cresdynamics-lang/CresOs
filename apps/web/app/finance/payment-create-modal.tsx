"use client";

import { useEffect, useState, type FormEvent } from "react";
import { financeNeu } from "../../components/finance/finance-theme";
import { formatMoney } from "../format-money";

type ProjectOption = {
  id: string;
  name: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
};
type ClientOption = { id: string; name: string };
type InvoiceOption = {
  id: string;
  number: string;
  totalAmount: number;
  projectId: string | null;
  clientId?: string;
  project: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
};

export type PaymentFormState = {
  paymentId?: string;
  projectId: string;
  clientId: string;
  invoiceId: string;
  amount: string;
  source: string;
  account: string;
  reference: string;
  receivedAt: string;
};

type PaymentFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  form: PaymentFormState;
  setForm: React.Dispatch<React.SetStateAction<PaymentFormState>>;
  projects: ProjectOption[];
  clients: ClientOption[];
  invoices: InvoiceOption[];
  submitError: string | null;
  onSubmit: (e: FormEvent) => void;
};

export function PaymentCreateModal({
  open,
  mode,
  onClose,
  form,
  setForm,
  projects,
  clients,
  invoices,
  submitError,
  onSubmit
}: PaymentFormModalProps) {
  const [sourceTouched, setSourceTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceTouched(false);
      return;
    }
    if (mode === "edit") return;
    if (!form.projectId || sourceTouched) return;
    const project = projects.find((p) => p.id === form.projectId);
    const client =
      (project?.clientId && clients.find((c) => c.id === project.clientId)) ||
      (project?.client ? { id: project.client.id, name: project.client.name } : null);
    if (client) {
      setForm((f) => ({ ...f, clientId: client.id, source: client.name }));
    }
  }, [open, mode, form.projectId, sourceTouched, projects, clients, setForm]);

  if (!open) return null;

  const filteredInvoices = invoices.filter((inv) => {
    if (form.projectId && inv.projectId !== form.projectId) return false;
    if (form.clientId && inv.clientId && inv.clientId !== form.clientId) return false;
    return true;
  });

  const selectedInvoice = invoices.find((inv) => inv.id === form.invoiceId);
  const selectedClient = clients.find((c) => c.id === form.clientId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="finance-neu relative z-10 flex max-h-[min(92dvh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.06] bg-[#121820] shadow-[8px_8px_24px_rgba(0,0,0,0.65),-4px_-4px_16px_rgba(255,255,255,0.04)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <h2 id="payment-modal-title" className="text-lg font-semibold text-emerald-100">
            {mode === "edit" ? "Edit payment" : "Record payment"}
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
            Client defaults from the project. Change client or received-from only when finance needs to override.
            {mode === "create"
              ? " On record, the client is emailed a payment confirmation with project progress."
              : ""}
          </p>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Project</span>
              <select
                value={form.projectId}
                onChange={(e) => {
                  const projectId = e.target.value;
                  const project = projects.find((p) => p.id === projectId);
                  const client =
                    (project?.clientId && clients.find((c) => c.id === project.clientId)) ||
                    (project?.client ? { id: project.client.id, name: project.client.name } : null);
                  setForm((f) => ({
                    ...f,
                    projectId,
                    clientId: client?.id ?? "",
                    invoiceId: "",
                    source: sourceTouched ? f.source : client?.name ?? f.source
                  }));
                }}
                className={financeNeu.input}
                required
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.client?.name ? ` · ${p.client.name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Client</span>
              <select
                value={form.clientId}
                onChange={(e) => {
                  const client = clients.find((c) => c.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    clientId: e.target.value,
                    invoiceId: "",
                    source: sourceTouched ? f.source : client?.name ?? f.source
                  }));
                }}
                className={financeNeu.input}
                required
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                    projectId: inv?.projectId ?? f.projectId,
                    clientId: inv?.clientId ?? inv?.client?.id ?? f.clientId,
                    source: sourceTouched ? f.source : inv?.client?.name ?? f.source
                  }));
                }}
                className={financeNeu.input}
                required
                disabled={!form.projectId}
              >
                <option value="">Select invoice</option>
                {filteredInvoices.map((inv) => (
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
                placeholder={selectedClient?.name ?? "Client name or payer"}
                value={form.source}
                onChange={(e) => {
                  setSourceTouched(true);
                  setForm((f) => ({ ...f, source: e.target.value }));
                }}
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
                {selectedClient?.name ? (
                  <>
                    Client <span className="text-slate-300">{selectedClient.name}</span>
                    {" · "}
                  </>
                ) : null}
                Invoice <span className="text-slate-300">{selectedInvoice.number}</span>
                {selectedInvoice.project ? ` · ${selectedInvoice.project.name}` : ""}
              </p>
            )}
          </div>

          <div className="safe-area-bottom mt-4 flex shrink-0 gap-2 border-t border-white/[0.06] pt-4">
            <button type="button" onClick={onClose} className={`flex-1 ${financeNeu.btnGhost}`}>
              Cancel
            </button>
            <button type="submit" className={`flex-1 ${financeNeu.btnPrimary}`}>
              {mode === "edit" ? "Save changes" : "Record payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
