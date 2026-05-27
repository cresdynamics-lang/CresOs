"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { WorkspaceDashboardIntro } from "../workspace-dashboard-intro";

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
  "Recipients are told this is a no-reply email. They are directed to reach Cres Dynamics on WhatsApp or call 0708805496, or email info@cresdynamics.com.";

const COPY: Record<
  ComposeChannel,
  { title: string; description: string; fromHint: string; accent: string }
> = {
  finance: {
    title: "Finance mail",
    description:
      "Send mail to a client or contact from the finance no-reply address. Enter recipient, subject, and message, then send.",
    fromHint: "Cres Dynamics Finance · finance-noreply@cresdynamics.com",
    accent: "border-teal-500/50"
  },
  director: {
    title: "Director mail",
    description:
      "Send mail from the director no-reply address. Enter recipient, subject, and message, then send.",
    fromHint: "Cres Dynamics · director-noreply@cresdynamics.com",
    accent: "border-violet-500/50"
  },
  sales: {
    title: "Sales mail",
    description:
      "Send mail to leads and clients from the sales no-reply address. Enter recipient, subject, and message, then send.",
    fromHint: "Cres Dynamics Sales · sales-noreply@cresdynamics.com",
    accent: "border-blue-500/50"
  }
};

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
        body: JSON.stringify({ channel, to: to.trim(), subject: subject.trim(), message: message.trim() })
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; from?: string };
      if (res.ok && data.ok !== false) {
        setFeedback(`Sent to ${to.trim()}${data.from ? ` from ${data.from}` : ""}.`);
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
    <section className="flex flex-col gap-4 text-sm text-slate-300">
      <WorkspaceDashboardIntro title={meta.title} description={meta.description} eyebrow="Outbound mail" />

      <div className={`rounded-xl border bg-slate-900/40 p-4 ${meta.accent} border-l-4`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From (no-reply)</p>
        <p className="mt-1 text-sm text-slate-200">{meta.fromHint}</p>
        <p className="mt-2 text-xs text-slate-500">{CONTACT_NOTE}</p>
        <p className="mt-1 text-xs text-slate-500">
          Signed in as {auth.userName?.trim() || auth.userEmail || "user"} · sent mail is saved in history below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Recipient email</span>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
              className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/40"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Subject</span>
            <input
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Follow-up on your project / Introduction"
              className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/40"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Message</span>
            <textarea
              required
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message…"
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/40"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        {feedback && <p className="mt-3 text-sm text-emerald-400">{feedback}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending}
            className="min-h-[44px] rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-700/70 bg-slate-900/35 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Sent mail history</h3>
        {loadingHistory ? (
          <p className="mt-2 text-xs text-slate-500">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No mail sent yet.</p>
        ) : (
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {history.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-200">{row.to}</span>
                  <span
                    className={
                      row.status === "sent" ? "text-emerald-400" : row.status === "failed" ? "text-rose-400" : "text-amber-400"
                    }
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-slate-300">{row.subject ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {row.sentAt ? new Date(row.sentAt).toLocaleString() : new Date(row.createdAt).toLocaleString()}
                </p>
                {row.error && <p className="mt-1 text-rose-400/90">{row.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
