"use client";

import type { FormEvent } from "react";
import { useMemo } from "react";
import { financeNeu } from "../../components/finance/finance-theme";
import { formatMoney } from "../format-money";

export type InvoiceLineForm = { id: string; description: string; quantity: string; unitPrice: string };

type ClientOption = { id: string; name: string };
type ProjectOption = {
  id: string;
  name: string;
  clientId?: string | null;
  price?: number | null;
  amountReceived?: number | null;
  financeProjectSeq?: number | null;
  financeRefYear?: number | null;
};

export type InvoiceFormState = {
  clientId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLineForm[];
  notes: string;
};

type InvoiceCreateModalProps = {
  open: boolean;
  onClose: () => void;
  form: InvoiceFormState;
  setForm: React.Dispatch<React.SetStateAction<InvoiceFormState>>;
  clients: ClientOption[];
  projects: ProjectOption[];
  submitError: string | null;
  onSubmit: (e: FormEvent) => void;
  emptyLine: () => InvoiceLineForm;
};

function projectRef(project: ProjectOption): string | null {
  if (project.financeProjectSeq == null || project.financeRefYear == null) return null;
  return `${String(project.financeProjectSeq).padStart(3, "0")}/${String(project.financeRefYear % 100).padStart(2, "0")}`;
}

export function InvoiceCreateModal({
  open,
  onClose,
  form,
  setForm,
  clients,
  projects,
  submitError,
  onSubmit,
  emptyLine
}: InvoiceCreateModalProps) {
  const projectsForClient = useMemo(
    () =>
      form.clientId
        ? projects.filter((p) => !p.clientId || p.clientId === form.clientId)
        : projects,
    [projects, form.clientId]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId) ?? null,
    [projects, form.projectId]
  );

  const lineTotal = useMemo(() => {
    return form.lines.reduce((sum, l) => {
      const qty = Math.max(1, parseInt(l.quantity, 10) || 1);
      const price = Number(l.unitPrice);
      if (!l.description.trim() || !l.unitPrice.trim() || Number.isNaN(price)) return sum;
      return sum + qty * price;
    }, 0);
  }, [form.lines]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className={`finance-neu relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.06] bg-[#121820] shadow-[8px_8px_24px_rgba(0,0,0,0.65),-4px_-4px_16px_rgba(255,255,255,0.04)] sm:rounded-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <h2 id="invoice-modal-title" className="text-lg font-semibold text-emerald-100">
            New invoice
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
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Client
              </span>
              <select
                value={form.clientId}
                onChange={(e) => {
                  const clientId = e.target.value;
                  setForm((f) => ({
                    ...f,
                    clientId,
                    projectId:
                      f.projectId && projects.some((p) => p.id === f.projectId && p.clientId === clientId)
                        ? f.projectId
                        : ""
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
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Project
              </span>
              <select
                value={form.projectId}
                onChange={(e) => {
                  const projectId = e.target.value;
                  const proj = projects.find((p) => p.id === projectId);
                  setForm((f) => ({
                    ...f,
                    projectId,
                    clientId: proj?.clientId || f.clientId
                  }));
                }}
                className={financeNeu.input}
                required
              >
                <option value="">{form.clientId ? "Select project" : "Select client first"}</option>
                {projectsForClient.map((p) => {
                  const ref = projectRef(p);
                  const remaining =
                    p.price != null
                      ? Math.max(0, p.price - (p.amountReceived ?? 0))
                      : null;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {ref ? ` (${ref})` : ""}
                      {remaining != null ? ` — ${formatMoney(remaining)} remaining` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {selectedProject ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs text-slate-300">
                {selectedProject.price != null ? (
                  <p>
                    Contract: <span className="text-emerald-300">{formatMoney(selectedProject.price)}</span>
                    {" · "}
                    Received:{" "}
                    <span className="text-emerald-300">
                      {formatMoney(selectedProject.amountReceived ?? 0)}
                    </span>
                  </p>
                ) : (
                  <p>No contract value set — update allocated amount in Projects finance.</p>
                )}
                <p className="mt-1 text-slate-500">
                  Invoice number uses project format (e.g. 001/01/26) when the project has finance ref.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Link every client invoice to a project so confirmed payments update received amounts.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                className={`flex-1 ${financeNeu.input}`}
              />
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className={`flex-1 ${financeNeu.input}`}
                placeholder="Due date"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Line items</p>
              {form.lines.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lines: f.lines.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l))
                      }))
                    }
                    className={`col-span-12 sm:col-span-6 ${financeNeu.input}`}
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lines: f.lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l))
                      }))
                    }
                    className={`col-span-4 sm:col-span-2 ${financeNeu.input}`}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Unit price"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lines: f.lines.map((l, i) => (i === idx ? { ...l, unitPrice: e.target.value } : l))
                      }))
                    }
                    className={`col-span-8 sm:col-span-4 ${financeNeu.input}`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
                className={`text-xs ${financeNeu.btnGhost}`}
              >
                + Add line
              </button>
            </div>

            {lineTotal > 0 ? (
              <p className="text-sm text-slate-300">
                Invoice total: <span className="font-semibold text-emerald-300">{formatMoney(lineTotal)}</span>
              </p>
            ) : null}

            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              rows={2}
              className={financeNeu.input}
            />
          </div>

          <div className="mt-4 flex shrink-0 gap-2 border-t border-white/[0.06] pt-4">
            <button type="submit" className={`flex-1 ${financeNeu.btnPrimary}`}>
              Create & download PDF
            </button>
            <button type="button" onClick={onClose} className={financeNeu.btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
