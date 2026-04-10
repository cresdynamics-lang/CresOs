"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type DeveloperReport = {
  id: string;
  reportDate: string;
  whatWorked: string | null;
  blockers: string | null;
  needsAttention: string | null;
  implemented: string | null;
  pending: string | null;
  nextPlan: string | null;
  createdAt: string;
  updatedAt: string;
  reviewStatus?: string;
  remarks?: string | null;
  submittedBy?: { id: string; name: string | null; email: string };
};

const FIELDS = [
  { key: "whatWorked", label: "What worked" },
  { key: "blockers", label: "Blockers" },
  { key: "needsAttention", label: "What needs attention" },
  { key: "implemented", label: "What's been implemented" },
  { key: "pending", label: "What's pending" },
  { key: "nextPlan", label: "Next plan / planned for next day" }
] as const;

function todayDateString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function totalFormChars(form: Record<(typeof FIELDS)[number]["key"], string>): number {
  return FIELDS.reduce((sum, { key }) => sum + (form[key]?.trim().length ?? 0), 0);
}

export default function DeveloperReportsPage() {
  const { apiFetch, auth } = useAuth();
  const [list, setList] = useState<DeveloperReport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    reportDate: todayDateString(),
    whatWorked: "",
    blockers: "",
    needsAttention: "",
    implemented: "",
    pending: "",
    nextPlan: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));
  const isDeveloper = auth.roleKeys.includes("developer");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const isDevSelfView = isDeveloper && !isDirector;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [viewId, setViewId] = useState<string | null>(null);

  const viewReport = viewId ? list.find((r) => r.id === viewId) ?? null : null;

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/developer-reports");
      if (res.ok) setList((await res.json()) as DeveloperReport[]);
    } catch {
      setList([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const updateReview = async (id: string, reviewStatus: "viewed" | "checked") => {
    const note = remarks.trim();
    if (reviewStatus === "checked" && auth.roleKeys.includes("director_admin") && !note) {
      alert("Director remarks are required to mark as checked.");
      return;
    }
    try {
      const res = await apiFetch(`/developer-reports/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus, remarks: note || undefined })
      });
      if (res.ok) {
        setEditingReviewId(null);
        setRemarks("");
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to update review status");
      }
    } catch {
      // ignore
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totalFormChars(form) < 60) {
      alert("Add enough detail across the sections (at least 60 characters total) so leadership gets a useful report.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/developer-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate: new Date(form.reportDate).toISOString().slice(0, 10),
          whatWorked: form.whatWorked.trim() || undefined,
          blockers: form.blockers.trim() || undefined,
          needsAttention: form.needsAttention.trim() || undefined,
          implemented: form.implemented.trim() || undefined,
          pending: form.pending.trim() || undefined,
          nextPlan: form.nextPlan.trim() || undefined
        })
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ reportDate: todayDateString(), whatWorked: "", blockers: "", needsAttention: "", implemented: "", pending: "", nextPlan: "" });
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to create report");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startNew() {
    setForm({ reportDate: todayDateString(), whatWorked: "", blockers: "", needsAttention: "", implemented: "", pending: "", nextPlan: "" });
    setShowForm(true);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-50">
            {isDirector ? "Developer reports" : "My reports"}
          </h2>
          <p className="text-sm text-slate-300">
            {isDirector
              ? "View reports from developers. Each entry shows when it was filed and last updated on the server — useful even if you were not online when it was submitted."
              : "Daily standard: cover the sections with enough detail (at least 60 characters total). Filed reports are read-only — you cannot edit or delete them after save; only new entries can be added (one per calendar day)."}
          </p>
        </div>
        {isDeveloper && (
          <button
            type="button"
            onClick={startNew}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            New report
          </button>
        )}
      </div>

      {showForm && isDeveloper && (
        <div className="shell max-w-2xl border-sky-600/30">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Submit report</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Report date</span>
              <input
                type="date"
                value={form.reportDate}
                onChange={(e) => setForm((p) => ({ ...p, reportDate: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                required
              />
            </label>
            {FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">{label}</span>
                <textarea
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  rows={2}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
                {submitting ? "Saving…" : "Submit"}
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
          {isDirector ? "All reports" : "My reports"} — {list.length} total
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">
            No reports yet. {isDeveloper && "Use “New report” to add one."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">Date</th>
                  {isDirector && <th className="pb-2 pr-3">Submitted by</th>}
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Remarks</th>
                  <th className="pb-2 pr-3">Filed</th>
                  {(isDirector || isDevSelfView) && <th className="pb-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((report) => {
                  const isExpanded = Boolean(expandedIds[report.id]);
                  const status = report.reviewStatus ?? "pending";
                  const badgeClass =
                    status === "checked"
                      ? "rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                      : status === "viewed"
                        ? "rounded bg-sky-500/15 px-2 py-0.5 text-sky-300"
                        : "rounded bg-amber-500/15 px-2 py-0.5 text-amber-200";

                  return (
                    <div key={report.id} style={{ display: "contents" }}>
                      <tr className="border-b border-slate-800">
                        <td className="py-2 pr-3 text-slate-200">
                          {new Date(report.reportDate).toLocaleDateString()}
                        </td>
                        {isDirector && (
                          <td className="py-2 pr-3 text-xs text-slate-400">
                            {report.submittedBy ? report.submittedBy.name ?? report.submittedBy.email : "—"}
                          </td>
                        )}
                        <td className="py-2 pr-3 text-xs">
                          <span className={badgeClass}>{status}</span>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-400">
                          {report.remarks?.trim() ? report.remarks.trim().slice(0, 80) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">
                          {new Date(report.createdAt).toLocaleString()}
                        </td>
                        {(isDirector || isDevSelfView) && (
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-2">
                              {isDevSelfView && (
                                <button
                                  type="button"
                                  onClick={() => setViewId(report.id)}
                                  className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                                >
                                  View
                                </button>
                              )}
                              {isDevSelfView && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedIds((p) => ({ ...p, [report.id]: !Boolean(p[report.id]) }))
                                  }
                                  className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                                >
                                  {isExpanded ? "Hide" : "Expand"}
                                </button>
                              )}
                              {isDirector && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingReviewId(report.id);
                                    setRemarks(report.remarks ?? "");
                                  }}
                                  className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                                >
                                  Review
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {isDevSelfView && isExpanded && (
                        <tr className="border-b border-slate-800 bg-slate-900/30">
                          <td colSpan={isDirector ? 6 : 5} className="px-3 py-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Director review</p>
                                <p className="mt-1 text-sm text-slate-200">
                                  Status: <span className={badgeClass}>{status}</span>
                                </p>
                                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                                  {report.remarks?.trim() ? report.remarks.trim() : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report details</p>
                                {FIELDS.map(({ key, label }) => (
                                  <div key={`${report.id}-${key}`} className="mt-2">
                                    <p className="text-xs text-slate-400">{label}</p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-200">
                                      {(report as any)[key]?.trim?.() ? (report as any)[key].trim() : "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </div>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isDevSelfView && list.some((r) => (r.reviewStatus ?? "pending") !== "pending" || Boolean(r.remarks?.trim())) && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm font-medium text-slate-200">Director review notes</p>
            <p className="mt-1 text-xs text-slate-500">
              When leadership marks a report as viewed/checked, remarks appear here and in the table.
            </p>
          </div>
        )}
      </div>

      {isDevSelfView && viewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Developer report</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                  {new Date(viewReport.reportDate).toLocaleDateString()}
                </h3>
                <p className="mt-1 text-xs text-slate-500">Filed {new Date(viewReport.createdAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewId(null)}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Director review</p>
              <div className="mt-2 text-sm text-slate-200">
                Status: <span className="ml-2">{viewReport.reviewStatus ?? "pending"}</span>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                {viewReport.remarks?.trim() ? viewReport.remarks.trim() : "—"}
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {FIELDS.map(({ key, label }) => (
                <div key={`${viewReport.id}-modal-${key}`} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                    {(viewReport as any)[key]?.trim?.() ? (viewReport as any)[key].trim() : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
