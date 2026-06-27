"use client";

import type { FormEvent } from "react";
import { financeNeu } from "../../components/finance/finance-theme";

export const EXPENSE_CATEGORIES = [
  "salaries",
  "transport",
  "tools",
  "developer_payment",
  "apis",
  "hostings",
  "domains",
  "renewals",
  "apis_per_project",
  "other"
] as const;

export type ExpenseFormState = {
  category: string;
  description: string;
  amount: string;
  spentAt: string;
  source: string;
  transactionCode: string;
  account: string;
  paymentMethod: string;
  beneficiaryUserId: string;
  toolOrServiceName: string;
};

export function defaultExpenseForm(): ExpenseFormState {
  return {
    category: "other",
    description: "",
    amount: "",
    spentAt: new Date().toISOString().slice(0, 10),
    source: "",
    transactionCode: "",
    account: "",
    paymentMethod: "bank",
    beneficiaryUserId: "",
    toolOrServiceName: ""
  };
}

type UserOption = { id: string; name: string | null; email: string };

type ExpenseCreateModalProps = {
  open: boolean;
  onClose: () => void;
  form: ExpenseFormState;
  setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  orgUsers: UserOption[];
  submitError: string | null;
  onSubmit: (e: FormEvent) => void;
};

export function ExpenseCreateModal({
  open,
  onClose,
  form,
  setForm,
  orgUsers,
  submitError,
  onSubmit
}: ExpenseCreateModalProps) {
  if (!open) return null;

  const showToolField = form.category === "tools" || form.category === "apis";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="finance-neu relative z-10 flex max-h-[min(92dvh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/[0.06] bg-[#121820] shadow-[8px_8px_24px_rgba(0,0,0,0.65),-4px_-4px_16px_rgba(255,255,255,0.04)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <h2 id="expense-modal-title" className="text-lg font-semibold text-amber-100">
            New expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <p className="text-xs leading-relaxed text-slate-400">
              Record the expense with payment details. A receipt PDF is emailed to the beneficiary automatically; admins
              are notified to approve.
            </p>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={`${financeNeu.input} w-full`}
                required
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Description</span>
              <input
                type="text"
                placeholder="e.g. AWS January, client visit fuel"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={`${financeNeu.input} w-full`}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Amount (KES)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className={`${financeNeu.input} w-full`}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Date spent</span>
                <input
                  type="date"
                  value={form.spentAt}
                  onChange={(e) => setForm((f) => ({ ...f, spentAt: e.target.value }))}
                  className={`${financeNeu.input} w-full`}
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Vendor / paid to</span>
              <input
                type="text"
                placeholder="Supplier or payee name"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className={`${financeNeu.input} w-full`}
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Receipt / transaction code</span>
              <input
                type="text"
                placeholder="M-Pesa code, bank ref, invoice #"
                value={form.transactionCode}
                onChange={(e) => setForm((f) => ({ ...f, transactionCode: e.target.value }))}
                className={`${financeNeu.input} w-full`}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Account paid from</span>
                <input
                  type="text"
                  placeholder="Business bank / M-Pesa"
                  value={form.account}
                  onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
                  className={`${financeNeu.input} w-full`}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Payment method</span>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  className={`${financeNeu.input} w-full`}
                  required
                >
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Receipt sent to</span>
              <select
                value={form.beneficiaryUserId}
                onChange={(e) => setForm((f) => ({ ...f, beneficiaryUserId: e.target.value }))}
                className={`${financeNeu.input} w-full`}
                required
              >
                <option value="">Select team member</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email).trim()}
                  </option>
                ))}
              </select>
            </label>

            {showToolField ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Tool or service (optional)</span>
                <input
                  type="text"
                  placeholder="e.g. GitHub, Vercel"
                  value={form.toolOrServiceName}
                  onChange={(e) => setForm((f) => ({ ...f, toolOrServiceName: e.target.value }))}
                  className={`${financeNeu.input} w-full`}
                />
              </label>
            ) : null}

            {submitError ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-white/[0.06] px-4 py-3 sm:px-5">
            <button type="button" onClick={onClose} className={`${financeNeu.btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" className={`${financeNeu.btnPrimary} flex-1 !bg-amber-700 hover:!bg-amber-600`}>
              Record expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
