"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { adminNeu } from "../admin/admin-theme";
import { INTELLIGENCE_PROMPTS } from "./admin-assistant-types";

export function AdminAiCommandWidget() {
  const { apiFetch } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const ask = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setReply(null);
    try {
      const res = await apiFetch("/admin/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: trimmed })
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      setReply(res.ok ? data.reply ?? "No reply" : data.error ?? "Request failed");
    } catch {
      setReply("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, message]);

  return (
    <div className={`${adminNeu.panel} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">AI Command</p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">Ask org intelligence</h2>
          <p className="mt-1 text-xs text-slate-500">Quick questions from the command center — full console for execute.</p>
        </div>
        <Link
          href="/admin/ai-command"
          className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/10"
        >
          Open AI Command →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {INTELLIGENCE_PROMPTS.slice(0, 2).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMessage(p)}
            className="rounded-full border border-white/[0.06] bg-[#0e1319] px-2.5 py-1 text-[10px] text-slate-400 hover:border-indigo-500/30"
          >
            {p.slice(0, 48)}…
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void ask()}
          placeholder="e.g. Summarize active projects and risks"
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#0e1319] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void ask()}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      {reply ? (
        <div className={`${adminNeu.panelInset} mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-300`}>
          {reply}
        </div>
      ) : null}
    </div>
  );
}
