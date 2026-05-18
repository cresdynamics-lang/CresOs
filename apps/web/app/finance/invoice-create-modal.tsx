"use client";

import type { FormEvent } from "react";

export type InvoiceLineForm = { id: string; description: string; quantity: string; unitPrice: string };

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };

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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
          <h2 id="invoice-modal-title" className="text-lg font-semibold text-slate-100">
            New invoice
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
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
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-200"
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.projectId}
              onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-200"
              required
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Invoice number is generated automatically (e.g.{" "}
              <span className="text-slate-300">CD-INV-000042/26</span>).
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
              />
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                placeholder="Due date"
              />
            </div>
            <p className="text-xs font-medium text-slate-400">Line items</p>
            {form.lines.map((line) => (
              <div key={line.id} className="flex flex-wrap gap-2">
                <input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lines: f.lines.map((l) =>
                        l.id === line.id ? { ...l, description: e.target.value } : l
                      )
                    }))
                  }
                  className="min-w-[140px] flex-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lines: f.lines.map((l) =>
                        l.id === line.id ? { ...l, quantity: e.target.value } : l
                      )
                    }))
                  }
                  className="w-16 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
                />
                <input
                  placeholder="Unit price"
                  value={line.unitPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lines: f.lines.map((l) =>
                        l.id === line.id ? { ...l, unitPrice: e.target.value } : l
                      )
                    }))
                  }
                  className="w-28 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
                />
                {form.lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.id !== line.id) }))
                    }
                    className="rounded-lg border border-rose-800 px-2 py-2 text-xs text-rose-300 hover:bg-rose-950/40"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
              className="self-start rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Add line item
            </button>
            <textarea
              placeholder="Notes (payment terms, reference — shown on PDF)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="min-h-[72px] rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div className="safe-area-bottom mt-4 flex shrink-0 gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              Create invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
