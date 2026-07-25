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
    <div className={`${adminNeu.panel} !p-4 sm:!p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={adminNeu.eyebrow}>AI Command</p>
          <h2 className="mt-1 font-display text-base font-bold text-[#1A1D26]">Ask org intelligence</h2>
          <p className="mt-1 font-body text-xs font-medium text-[#5B6472]">
            Quick questions from the command center — full console for execute.
          </p>
        </div>
        <Link href="/admin/ai-command" className={adminNeu.btnGhost}>
          Open AI Command →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {INTELLIGENCE_PROMPTS.slice(0, 2).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMessage(p)}
            className="rounded-lg border border-[#E5E9EF] bg-white px-2.5 py-1 font-body text-[10px] font-semibold text-[#5B6472] hover:border-[#2D5A5A]/40 hover:text-[#2D5A5A]"
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
          className={`min-w-0 flex-1 ${adminNeu.input}`}
        />
        <button type="button" disabled={loading} onClick={() => void ask()} className={`shrink-0 ${adminNeu.btnPrimary}`}>
          {loading ? "…" : "Ask"}
        </button>
      </div>

      {reply ? (
        <div
          className={`${adminNeu.panelInset} mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-body text-xs font-medium leading-relaxed text-[#1A1D26]`}
        >
          {reply}
        </div>
      ) : null}
    </div>
  );
}
