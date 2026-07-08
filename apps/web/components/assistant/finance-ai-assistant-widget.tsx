"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { financeNeu } from "../finance/finance-theme";
import { FINANCE_EXECUTE_PROMPTS } from "./finance-assistant-types";

export function FinanceAiAssistantWidget() {
  const { apiFetch } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const preview = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setReply(null);
    try {
      const res = await apiFetch("/finance/assistant/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed })
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        proposedActions?: { title: string; amount?: number | null }[];
        error?: string;
      };
      if (!res.ok) {
        setReply(data.error ?? "Preview failed");
        return;
      }
      const actions = data.proposedActions ?? [];
      const actionSummary =
        actions.length > 0
          ? actions
              .map((a) => `${a.title}${a.amount != null ? ` (${a.amount.toLocaleString()} KES)` : ""}`)
              .join(" · ")
          : "";
      setReply([data.reply, actionSummary].filter(Boolean).join("\n\n"));
    } catch {
      setReply("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, message]);

  return (
    <div className={`${financeNeu.panel} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Finance AI</p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">Record by voice or text</h2>
          <p className="mt-1 text-xs text-slate-500">
            Preview expenses and payments before recording — full console for batch actions.
          </p>
        </div>
        <Link
          href="/finance/assistant"
          className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
        >
          Open Finance AI →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FINANCE_EXECUTE_PROMPTS.slice(0, 2).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMessage(p)}
            className="rounded-full border border-white/[0.06] bg-[#0e1319] px-2.5 py-1 text-[10px] text-slate-400 hover:border-emerald-500/30"
          >
            {p.slice(0, 52)}…
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void preview()}
          placeholder="e.g. Client paid 50k M-Pesa for Acme invoice today"
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#0e1319] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void preview()}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "…" : "Preview"}
        </button>
      </div>

      {reply ? (
        <div className={`${financeNeu.panelInset} mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-300`}>
          {reply}
        </div>
      ) : null}
    </div>
  );
}
