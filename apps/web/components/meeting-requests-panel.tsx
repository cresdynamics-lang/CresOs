"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";

function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type MeetingRequestRow = {
  id: string;
  reason: string;
  scheduledAt: string | null;
  status: string;
  responseNote: string | null;
  adminComment: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string | null; email: string };
  respondedBy?: { id: string; name: string | null; email: string } | null;
};

type Props = { embedded?: boolean };

export function MeetingRequestsPanel({ embedded }: Props) {
  const { apiFetch, auth } = useAuth();
  const [list, setList] = useState<MeetingRequestRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: "", scheduledAt: "" });
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondState, setRespondState] = useState<
    Record<string, { status: "approved" | "rejected"; note: string; scheduledAt: string }>
  >({});
  const [followUp, setFollowUp] = useState<Record<string, { responseNote: string; adminComment: string; scheduledAt: string }>>({});
  const [savingFollowUp, setSavingFollowUp] = useState<string | null>(null);

  const isDeveloper = auth.roleKeys.includes("developer");
  const isSales = auth.roleKeys.includes("sales");
  const canRequest = isDeveloper || isSales;
  const isReviewer = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/meeting-requests");
      if (res.ok) setList((await res.json()) as MeetingRequestRow[]);
    } catch {
      setList([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isReviewer) return;
    setFollowUp(() => {
      const next: Record<string, { responseNote: string; adminComment: string; scheduledAt: string }> = {};
      for (const r of list) {
        if (r.status === "pending") continue;
        next[r.id] = {
          responseNote: r.responseNote ?? "",
          adminComment: r.adminComment ?? "",
          scheduledAt: toLocalDatetimeValue(r.scheduledAt)
        };
      }
      return next;
    });
  }, [list, isReviewer]);

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
        alert((data as { error?: string }).error ?? "Failed to submit");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespond(id: string) {
    const state = respondState[id] ?? { status: "approved" as const, note: "", scheduledAt: "" };
    setRespondingId(id);
    try {
      const payload: {
        status: "approved" | "rejected";
        responseNote?: string;
        scheduledAt?: string;
      } = {
        status: state.status,
        responseNote: state.note.trim() || undefined
      };
      if (state.status === "approved" && state.scheduledAt) {
        payload.scheduledAt = new Date(state.scheduledAt).toISOString();
      }
      const res = await apiFetch(`/meeting-requests/${id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setRespondState((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Could not respond");
      }
    } finally {
      setRespondingId(null);
    }
  }

  async function saveFollowUp(id: string) {
    const row = list.find((r) => r.id === id);
    if (!row) return;
    const f = followUp[id] ?? {
      responseNote: row.responseNote ?? "",
      adminComment: row.adminComment ?? "",
      scheduledAt: toLocalDatetimeValue(row.scheduledAt)
    };
    setSavingFollowUp(id);
    try {
      const res = await apiFetch(`/meeting-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseNote: f.responseNote.trim() || undefined,
          adminComment: f.adminComment.trim() || undefined,
          scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : null
        })
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Could not save");
      }
    } finally {
      setSavingFollowUp(null);
    }
  }

  const shellClass = embedded ? "rounded-lg border border-slate-700 bg-slate-800/40 p-4" : "shell";

  return (
    <div className="flex flex-col gap-4">
      <div className={`${embedded ? "" : "shell"} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h2 className={`${embedded ? "text-base" : "mb-2 text-lg"} font-semibold text-slate-50`}>
            {isReviewer ? "Meeting requests (director)" : "Request a meeting with the director"}
          </h2>
          <p className="text-sm text-slate-300">
            {canRequest &&
              "Submit a reason and optional preferred time. Directors and admins are notified and can approve, set the time, or add notes."}
            {isReviewer &&
              !canRequest &&
              "Review all org requests: approve or reject, confirm the scheduled time, and add follow-up notes visible to the requester."}
            {isReviewer && canRequest && " You can also submit your own requests below."}
          </p>
        </div>
        {canRequest && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            New request
          </button>
        )}
      </div>

      {showForm && canRequest && (
        <div className={`${shellClass} max-w-lg border-sky-600/30`}>
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Request meeting with director</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Reason / topic *</span>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                rows={4}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                placeholder="e.g. Pipeline review, scope alignment, blocker discussion…"
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
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={shellClass}>
        <h3 className="mb-3 text-sm font-semibold text-slate-200">
          {isReviewer ? "All requests" : "My requests"} — {list.length}
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">
            No meeting requests yet.{" "}
            {canRequest && 'Use "New request" to reach the director.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((req) => (
              <li key={req.id} className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">
                    {isReviewer ? req.requestedBy.name ?? req.requestedBy.email : "My request"}
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
                    Scheduled / preferred: {new Date(req.scheduledAt).toLocaleString()}
                  </p>
                )}
                {req.respondedBy && (
                  <p className="mt-1 text-xs text-slate-400">
                    Response ({req.status}) by {req.respondedBy.name ?? req.respondedBy.email}
                    {req.responseNote && ` — ${req.responseNote}`}
                  </p>
                )}
                {req.adminComment && (
                  <p className="mt-2 rounded border border-slate-600/50 bg-slate-900/50 px-2 py-1 text-xs text-slate-300">
                    <span className="font-medium text-slate-400">Follow-up: </span>
                    {req.adminComment}
                  </p>
                )}

                {isReviewer && req.status === "pending" && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
                    <p className="text-xs font-medium text-slate-400">Confirm or decline</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={(respondState[req.id] ?? { status: "approved", note: "", scheduledAt: "" }).status}
                        onChange={(e) =>
                          setRespondState((s) => ({
                            ...s,
                            [req.id]: {
                              ...(s[req.id] ?? { status: "approved", note: "", scheduledAt: "" }),
                              status: e.target.value as "approved" | "rejected"
                            }
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
                            [req.id]: {
                              ...(s[req.id] ?? { status: "approved", note: "", scheduledAt: "" }),
                              note: e.target.value
                            }
                          }))
                        }
                        placeholder="Note to requester (optional)"
                        className="min-w-[12rem] flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                      />
                    </div>
                    {(respondState[req.id] ?? { status: "approved" }).status === "approved" && (
                      <label className="flex flex-col gap-1 text-xs text-slate-400">
                        Confirm date/time (optional — defaults to their preference)
                        <input
                          type="datetime-local"
                          value={respondState[req.id]?.scheduledAt ?? ""}
                          onChange={(e) =>
                            setRespondState((s) => ({
                              ...s,
                              [req.id]: {
                                ...(s[req.id] ?? { status: "approved", note: "", scheduledAt: "" }),
                                scheduledAt: e.target.value
                              }
                            }))
                          }
                          className="max-w-xs rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRespond(req.id)}
                      disabled={respondingId === req.id}
                      className={`w-fit rounded px-3 py-1 text-sm font-medium ${
                        (respondState[req.id] ?? { status: "approved" }).status === "approved"
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-rose-600 text-white hover:bg-rose-500"
                      } disabled:opacity-50`}
                    >
                      {respondingId === req.id
                        ? "…"
                        : (respondState[req.id] ?? { status: "approved" }).status === "approved"
                          ? "Approve & confirm"
                          : "Reject"}
                    </button>
                  </div>
                )}

                {isReviewer && req.status !== "pending" && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
                    <p className="text-xs font-medium text-slate-400">Edit response, time, or follow-up note</p>
                    <textarea
                      placeholder="Response note (visible to requester)"
                      value={followUp[req.id]?.responseNote ?? ""}
                      onChange={(e) =>
                        setFollowUp((s) => ({
                          ...s,
                          [req.id]: {
                            responseNote: e.target.value,
                            adminComment: s[req.id]?.adminComment ?? "",
                            scheduledAt: s[req.id]?.scheduledAt ?? ""
                          }
                        }))
                      }
                      rows={2}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                    />
                    <textarea
                      placeholder="Follow-up note (optional)"
                      value={followUp[req.id]?.adminComment ?? ""}
                      onChange={(e) =>
                        setFollowUp((s) => ({
                          ...s,
                          [req.id]: {
                            responseNote: s[req.id]?.responseNote ?? "",
                            adminComment: e.target.value,
                            scheduledAt: s[req.id]?.scheduledAt ?? ""
                          }
                        }))
                      }
                      rows={2}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                    />
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      Scheduled time
                      <input
                        type="datetime-local"
                        value={followUp[req.id]?.scheduledAt ?? ""}
                        onChange={(e) =>
                          setFollowUp((s) => ({
                            ...s,
                            [req.id]: {
                              responseNote: s[req.id]?.responseNote ?? "",
                              adminComment: s[req.id]?.adminComment ?? "",
                              scheduledAt: e.target.value
                            }
                          }))
                        }
                        className="max-w-xs rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={savingFollowUp === req.id}
                      onClick={() => void saveFollowUp(req.id)}
                      className="w-fit rounded bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-500 disabled:opacity-50"
                    >
                      {savingFollowUp === req.id ? "Saving…" : "Save updates"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
