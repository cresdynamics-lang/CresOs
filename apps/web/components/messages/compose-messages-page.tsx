"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../app/auth-context";

export type ComposeChannel = "finance" | "director" | "sales";

type SentRow = {
  id: string;
  to: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
};

const CONTACT_NOTE =
  "No-reply address — recipients should use WhatsApp/call 0708805496 or info@cresdynamics.com.";

const COPY: Record<
  ComposeChannel,
  { title: string; description: string; fromLabel: string; fromEmail: string }
> = {
  finance: {
    title: "Finance mail",
    description: "Send to a client or contact from finance no-reply.",
    fromLabel: "Cres Dynamics Finance",
    fromEmail: "finance-noreply@cresdynamics.com"
  },
  director: {
    title: "Director mail",
    description: "Send from the director no-reply address.",
    fromLabel: "Cres Dynamics",
    fromEmail: "director-noreply@cresdynamics.com"
  },
  sales: {
    title: "Sales mail",
    description: "Send to leads and clients from sales no-reply.",
    fromLabel: "Cres Dynamics Sales",
    fromEmail: "sales-noreply@cresdynamics.com"
  }
};

const inputClass =
  "mt-1 w-full rounded-md border border-[#D1D1D1] bg-white px-2.5 py-2 text-[13px] font-medium text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20";

const labelClass = "block text-[11px] font-semibold text-[#605E5C]";

function statusStyle(status: string): string {
  if (status === "sent") return "bg-[#E8F5E9] text-[#0B6A0B]";
  if (status === "failed") return "bg-[#FDE7E9] text-[#C50F1F]";
  return "bg-[#FFF8E1] text-[#8A7000]";
}

export function ComposeMessagesPage({ channel }: { channel: ComposeChannel }) {
  const { apiFetch, auth } = useAuth();
  const meta = COPY[channel];
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SentRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/messages/sent?channel=${channel}`);
      if (res.ok) {
        const j = (await res.json()) as { items?: SentRow[] };
        setHistory(j.items ?? []);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [apiFetch, channel]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setError(null);
    if (!to.trim() || !subject.trim() || !message.trim()) {
      setError("Recipient, subject, and message are required.");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch("/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          to: to.trim(),
          subject: subject.trim(),
          message: message.trim()
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        from?: string;
      };
      if (res.ok && data.ok !== false) {
        setFeedback(`Sent to ${to.trim()}.`);
        setTo("");
        setSubject("");
        setMessage("");
        void loadHistory();
      } else {
        setError(data.error ?? "Could not send email.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 bg-white pb-4 text-[#242424] antialiased">
      <header className="border-b border-[#E1DFDD] pb-3">
        <p className="text-[10px] font-semibold tracking-wide text-[#005CAB]">Mails</p>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-[#242424] sm:text-xl">
          {meta.title}
        </h1>
        <p className="mt-0.5 max-w-xl text-[12px] font-medium leading-snug text-[#605E5C]">
          {meta.description}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        {/* Compose */}
        <section className="rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
          <div className="mb-3 rounded-md border border-[#B4CDE8] border-l-[3px] border-l-[#005CAB] bg-[#F8FBFD] px-2.5 py-2">
            <p className="text-[10px] font-semibold tracking-wide text-[#605E5C]">From</p>
            <p className="mt-0.5 text-[13px] font-semibold text-[#242424]">{meta.fromLabel}</p>
            <p className="text-[12px] text-[#005CAB]">{meta.fromEmail}</p>
            <p className="mt-1.5 text-[11px] leading-snug text-[#8A8886]">{CONTACT_NOTE}</p>
            <p className="mt-1 text-[10px] text-[#8A8886]">
              Signed in as {auth.userName?.trim() || auth.userEmail || "user"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className={labelClass}>
              To
              <input
                type="email"
                required
                autoComplete="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@example.com"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Subject
              <input
                type="text"
                required
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Follow-up · Introduction · Quote"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Message
              <textarea
                required
                rows={10}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message…"
                className={`${inputClass} min-h-[12rem] resize-y leading-relaxed`}
              />
            </label>

            {error ? (
              <p className="rounded-md border border-[#E8A0A6] border-l-[3px] border-l-[#C50F1F] bg-white px-2.5 py-2 text-[12px] text-[#C50F1F]">
                {error}
              </p>
            ) : null}
            {feedback ? (
              <p className="rounded-md border border-[#A8D5A8] border-l-[3px] border-l-[#0B6A0B] bg-white px-2.5 py-2 text-[12px] text-[#0B6A0B]">
                {feedback}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-[#005CAB] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send email"}
              </button>
              <button
                type="button"
                disabled={sending || (!to && !subject && !message)}
                onClick={() => {
                  setTo("");
                  setSubject("");
                  setMessage("");
                  setError(null);
                  setFeedback(null);
                }}
                className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-[12px] font-semibold text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB] disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        {/* History */}
        <aside className="rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-[#242424]">Sent</h2>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loadingHistory}
              className="text-[11px] font-semibold text-[#005CAB] hover:underline disabled:opacity-50"
            >
              {loadingHistory ? "…" : "Refresh"}
            </button>
          </div>

          {loadingHistory ? (
            <p className="text-[12px] text-[#8A8886]">Loading history…</p>
          ) : history.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E1DFDD] bg-[#FAFAFA] px-3 py-6 text-center">
              <p className="text-[12px] font-medium text-[#605E5C]">No mail sent yet</p>
              <p className="mt-1 text-[11px] text-[#8A8886]">Sent messages appear here.</p>
            </div>
          ) : (
            <ul className="max-h-[min(32rem,70vh)] space-y-1.5 overflow-y-auto">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border border-[#E1DFDD] bg-white px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[12px] font-semibold text-[#242424]">{row.to}</p>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[#605E5C]">{row.subject ?? "—"}</p>
                  <p className="mt-1 text-[10px] text-[#8A8886]">
                    {row.sentAt
                      ? new Date(row.sentAt).toLocaleString()
                      : new Date(row.createdAt).toLocaleString()}
                  </p>
                  {row.error ? (
                    <p className="mt-1 text-[11px] leading-snug text-[#C50F1F]">{row.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
