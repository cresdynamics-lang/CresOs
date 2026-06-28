"use client";

import { useState } from "react";
import { useAuth } from "../../app/auth-context";

type PmCheckInRespondProps = {
  messageId?: string;
  projectId?: string;
  onResponded?: () => void;
};

export function PmCheckInRespond({ messageId, projectId, onResponded }: PmCheckInRespondProps) {
  const { apiFetch, auth } = useAuth();
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.roleKeys.includes("developer")) return null;
  if (done) {
    return <p className="mt-2 text-xs text-emerald-400">Thanks — your reply was recorded.</p>;
  }

  const submit = async () => {
    if (!response.trim()) return;
    setSending(true);
    setError(null);
    try {
      const inboxRes = await apiFetch("/pm/check-ins/inbox");
      if (!inboxRes.ok) throw new Error("Could not load check-ins");
      const rows = (await inboxRes.json()) as {
        id: string;
        messageId?: string | null;
        project?: { id: string };
        status: string;
      }[];
      const match =
        rows.find((r) => r.messageId === messageId && r.status === "pending") ??
        rows.find((r) => r.project?.id === projectId && r.status === "pending");
      if (!match) throw new Error("No pending check-in for this message");
      const res = await apiFetch(`/pm/check-ins/${match.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: response.trim() })
      });
      if (!res.ok) throw new Error("Reply failed");
      setDone(true);
      onResponded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-teal-500/20 bg-teal-950/20 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">PM check-in</p>
      <textarea
        className="mt-2 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-slate-100"
        rows={2}
        placeholder="Your update for the project manager…"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />
      {error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : null}
      <button
        type="button"
        disabled={sending || !response.trim()}
        className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        onClick={() => void submit()}
      >
        {sending ? "Sending…" : "Send reply"}
      </button>
    </div>
  );
}

export function isPmCheckInMessage(metadata?: Record<string, unknown> | null): boolean {
  return Boolean(metadata && metadata.pmCheckIn === true);
}
