"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth-context";
import { formatMoney } from "../../format-money";
import { clientNeu } from "../../../components/client/client-theme";

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalAmount: number | string | null;
  issueDate: string | null;
  dueDate: string | null;
};

export default function ClientInvoicesPage() {
  const { apiFetch } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/client/invoices");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not load invoices");
        setInvoices([]);
        return;
      }
      setInvoices((await res.json()) as Invoice[]);
    } catch {
      setError("Could not reach the server.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex flex-col gap-5">
      <header className={clientNeu.panel}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/80">Billing</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-50">Your invoices</h1>
        <p className="mt-2 text-sm text-slate-400">Invoices issued for your projects with Cres Dynamics.</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-xl border border-white/[0.08] bg-[#101820] px-3 py-2 text-sm text-slate-200">
          Refresh
        </button>
      </header>

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading invoices…</p> : null}

      {!loading && !error && invoices.length === 0 ? (
        <div className={`${clientNeu.panelInset} text-sm text-slate-400`}>No invoices on file yet.</div>
      ) : null}

      <ul className="space-y-3">
        {invoices.map((inv) => (
          <li key={inv.id} className={clientNeu.panel}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{inv.number}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">{inv.status.replace(/_/g, " ")}</p>
              </div>
              <p className="text-lg font-semibold text-teal-300">
                {inv.totalAmount != null ? formatMoney(Number(inv.totalAmount)) : "—"}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Issued {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "—"}
              {inv.dueDate ? ` · Due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
