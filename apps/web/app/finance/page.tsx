"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalAmount: number;
};

type Expense = {
  id: string;
  category: string;
  amount: number;
};

export default function FinancePage() {
  const { apiFetch } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [invRes, expRes] = await Promise.all([
          apiFetch("/finance/invoices"),
          apiFetch("/finance/expenses")
        ]);
        if (invRes.ok) {
          const data = (await invRes.json()) as any[];
          setInvoices(
            data.map((inv) => ({
              id: inv.id,
              number: inv.number,
              status: inv.status,
              totalAmount: inv.totalAmount
                ? Number(inv.totalAmount)
                : 0
            }))
          );
        }
        if (expRes.ok) {
          const data = (await expRes.json()) as any[];
          setExpenses(
            data.map((exp) => ({
              id: exp.id,
              category: exp.category,
              amount: Number(exp.amount)
            }))
          );
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Finance</h2>
        <p className="text-sm text-slate-300">
          Invoices, payments, expenses, and payouts in one OS so cash visibility
          is never an afterthought.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Invoices
          </p>
          <ul className="space-y-2 text-sm">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div>
                  <p className="text-slate-100">{inv.number}</p>
                  <p className="text-xs text-slate-400 capitalize">
                    {inv.status}
                  </p>
                </div>
                <span className="text-emerald-400">
                  ${inv.totalAmount.toLocaleString()}
                </span>
              </li>
            ))}
            {invoices.length === 0 && (
              <li className="text-sm text-slate-400">No invoices yet.</li>
            )}
          </ul>
        </div>
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Expenses
          </p>
          <ul className="space-y-2 text-sm">
            {expenses.map((exp) => (
              <li
                key={exp.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <span className="text-slate-100">{exp.category}</span>
                <span className="text-amber-400">
                  ${exp.amount.toLocaleString()}
                </span>
              </li>
            ))}
            {expenses.length === 0 && (
              <li className="text-sm text-slate-400">No expenses yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

