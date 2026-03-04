"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type MeetingRequest = {
  id: string;
  reason: string;
  scheduledAt: string | null;
  status: string;
  responseNote: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string | null; email: string };
  respondedBy?: { id: string; name: string | null; email: string } | null;
};

export default function MeetingRequestsPage() {
  const { apiFetch, auth } = useAuth();
  const [list, setList] = useState<MeetingRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: "", scheduledAt: "" });
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondState, setRespondState] = useState<Record<string, { status: "approved" | "rejected"; note: string }>>({});
  const isDeveloper = auth.roleKeys.includes("developer");
  const isDirector = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/meeting-requests");
      if (res.ok) setList((await res.json()) as MeetingRequest[]);
    } catch {
      setList([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/meeting-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: form.reason.trim(),
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined
        })
      });
      if (res.ok) {
        setForm({ reason: "", scheduledAt: "" });
        setShowForm(false);
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to submit");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespond(id: string) {
    const state = respondState[id] ?? { status: "approved" as const, note: "" };
    setRespondingId(id);
    try {
      const res = await apiFetch(`/meeting-requests/${id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: state.status, responseNote: state.note.trim() || undefined })
      });
      if (res.ok) {
        setRespondState((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
        setRespondingId(null);
        await load();
      }
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-50">
            {isDirector ? "Meeting requests" : "Request a meeting"}
          </h2>
          <p className="text-sm text-slate-300">
            {isDeveloper
              ? "Request a meeting with the director. Describe the reason or inquiry; the director will be notified and can approve or schedule."
              : "Developers’ meeting requests. Approve or reject and add a note or scheduled time."}
          </p>
        </div>
        {isDeveloper && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Request meeting
          </button>
        )}
      </div>

      {showForm && isDeveloper && (
        <div className="shell max-w-lg border-sky-600/30">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">New meeting request</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Reason for meeting / inquiry *</span>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                rows={4}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                placeholder="e.g. Need alignment on scope, blocker discussion, sprint planning..."
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Preferred date/time (optional)</span>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit request"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="shell">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">
          {isDirector ? "All requests" : "My requests"} — {list.length}
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">
            No meeting requests yet. {isDeveloper && "Use “Request meeting” to inquire or schedule with the director."}
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((req) => (
              <li key={req.id} className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">
                    {isDirector ? req.requestedBy.name ?? req.requestedBy.email : "My request"}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      req.status === "pending"
                        ? "bg-amber-900/60 text-amber-300"
                        : req.status === "approved"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-rose-900/60 text-rose-300"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-200">{req.reason}</p>
                {req.scheduledAt && (
                  <p className="mt-1 text-xs text-slate-400">
                    Preferred: {new Date(req.scheduledAt).toLocaleString()}
                  </p>
                )}
                {req.respondedBy && (
                  <p className="mt-1 text-xs text-slate-400">
                    {req.status} by {req.respondedBy.name ?? req.respondedBy.email}
                    {req.responseNote && ` — ${req.responseNote}`}
                  </p>
                )}
                {isDirector && req.status === "pending" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={(respondState[req.id] ?? { status: "approved" }).status}
                      onChange={(e) =>
                        setRespondState((s) => ({
                          ...s,
                          [req.id]: { ...(s[req.id] ?? { status: "approved", note: "" }), status: e.target.value as "approved" | "rejected" }
                        }))
                      }
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                    >
                      <option value="approved">Approve</option>
                      <option value="rejected">Reject</option>
                    </select>
                    <input
                      type="text"
                      value={respondState[req.id]?.note ?? ""}
                      onChange={(e) =>
                        setRespondState((s) => ({
                          ...s,
                          [req.id]: { ...(s[req.id] ?? { status: "approved", note: "" }), note: e.target.value }
                        }))
                      }
                      placeholder="Note (optional)"
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRespond(req.id)}
                      disabled={respondingId === req.id}
                      className={`rounded px-3 py-1 text-sm font-medium ${
                        (respondState[req.id] ?? { status: "approved" }).status === "approved"
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-rose-600 text-white hover:bg-rose-500"
                      } disabled:opacity-50`}
                    >
                      {respondingId === req.id ? "…" : (respondState[req.id] ?? { status: "approved" }).status === "approved" ? "Approve" : "Reject"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
