"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth-context";
import { formatMoney } from "../../format-money";
import { clientNeu } from "../../../components/client/client-theme";

type Payment = {
  id: string;
  amount: number | string | null;
  receivedAt: string | null;
  method: string | null;
  reference: string | null;
  invoiceId: string | null;
};

export default function ClientPaymentsPage() {
  const { apiFetch } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/client/payments");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not load payments");
        setPayments([]);
        return;
      }
      setPayments((await res.json()) as Payment[]);
    } catch {
      setError("Could not reach the server.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = payments.reduce((sum, p) => sum + (p.amount != null ? Number(p.amount) : 0), 0);

  return (
    <section className="flex flex-col gap-5">
      <header className={clientNeu.panel}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/80">Billing</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-50">Payments received</h1>
        <p className="mt-2 text-sm text-slate-400">Payments recorded against your invoices.</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-xl border border-white/[0.08] bg-[#101820] px-3 py-2 text-sm text-slate-200">
          Refresh
        </button>
      </header>

      {payments.length > 0 ? (
        <div className={`${clientNeu.panelInset} text-sm`}>
          <span className="text-slate-500">Total received</span>
          <p className="mt-1 text-2xl font-bold text-teal-300">{formatMoney(total)}</p>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading payments…</p> : null}

      {!loading && !error && payments.length === 0 ? (
        <div className={`${clientNeu.panelInset} text-sm text-slate-400`}>No payments recorded yet.</div>
      ) : null}

      <ul className="space-y-3">
        {payments.map((p) => (
          <li key={p.id} className={clientNeu.panel}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{p.amount != null ? formatMoney(Number(p.amount)) : "—"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.method ?? "Payment"}
                  {p.reference ? ` · Ref ${p.reference}` : ""}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {p.receivedAt ? new Date(p.receivedAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
