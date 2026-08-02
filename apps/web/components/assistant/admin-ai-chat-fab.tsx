"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../../app/auth-context";
import { INTELLIGENCE_PROMPTS } from "./admin-assistant-types";
import { adminNeu } from "../admin/admin-theme";

type ChatLine = { role: "user" | "assistant"; text: string };

export function AdminAiChatFab() {
  const pathname = usePathname();
  const { apiFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onAiCommandPage = Boolean(
    pathname?.startsWith("/admin/ai-command") ||
      pathname?.startsWith("/admin/onboarding") ||
      pathname?.startsWith("/admin/email-automation")
  );

  useEffect(() => {
    if (!open || onAiCommandPage) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onAiCommandPage]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lines, loading]);

  const ask = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setMessage("");
    setLines((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const res = await apiFetch("/admin/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: trimmed })
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      const reply = res.ok ? data.reply ?? "No reply." : data.error ?? "Request failed.";
      setLines((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: "Could not reach the AI service. Check that the API is running." }
      ]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, loading, message]);

  if (onAiCommandPage) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open ? (
        <div
          className="pointer-events-auto mb-3 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-[#E5E9EF] bg-white shadow-[0_16px_48px_rgba(28,31,46,0.18)]"
          role="dialog"
          aria-label="AI intelligence chat"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E9EF] bg-[#1C1F2E] px-3.5 py-3">
            <div className="min-w-0">
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B93A1]">
                Intelligence
              </p>
              <p className="truncate font-display text-sm font-bold text-white">Ask CresOS AI</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#C8CDD8] hover:bg-white/10 hover:text-white"
              aria-label="Close AI chat"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            ref={listRef}
            className="flex max-h-[min(50dvh,22rem)] min-h-[12rem] flex-col gap-2.5 overflow-y-auto bg-[#F4F7F9] px-3 py-3"
          >
            {lines.length === 0 ? (
              <div className="space-y-2">
                <p className="font-body text-xs font-medium text-[#5B6472]">
                  Ask about projects, people, risk, or org activity.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {INTELLIGENCE_PROMPTS.slice(0, 3).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMessage(p)}
                      className="rounded-full border border-[#E5E9EF] bg-white px-2.5 py-1 font-body text-[10px] font-semibold text-[#5B6472] hover:border-[#2D5A5A]/40 hover:text-[#2D5A5A]"
                    >
                      {p.length > 42 ? `${p.slice(0, 42)}…` : p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              lines.map((line, i) => (
                <div
                  key={`${line.role}-${i}`}
                  className={[
                    "max-w-[92%] rounded-2xl px-3 py-2 font-body text-xs font-medium leading-relaxed",
                    line.role === "user"
                      ? "ml-auto bg-[#2D5A5A] text-white"
                      : "mr-auto whitespace-pre-wrap border border-[#E5E9EF] bg-white text-[#1A1D26]"
                  ].join(" ")}
                >
                  {line.text}
                </div>
              ))
            )}
            {loading ? (
              <p className="font-body text-[11px] font-semibold text-[#8B93A1]">Thinking…</p>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-[#E5E9EF] bg-white p-2.5">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
              placeholder="Ask intelligence…"
              className={`min-w-0 flex-1 ${adminNeu.input} !rounded-full !py-2`}
            />
            <button
              type="button"
              disabled={loading || !message.trim()}
              onClick={() => void ask()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1F2E] text-white hover:bg-black disabled:opacity-50"
              aria-label="Send"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1C1F2E] text-white shadow-[0_12px_32px_rgba(28,31,46,0.35)] transition hover:bg-black hover:shadow-[0_14px_36px_rgba(28,31,46,0.45)]"
        aria-label={open ? "Close AI chat" : "Open AI intelligence chat"}
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
