"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "director", "admin"].includes(r));
  const isDeveloper = auth.roleKeys.includes("developer");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewAppend, setReviewAppend] = useState("");
  const [replaceWholeReview, setReplaceWholeReview] = useState(false);
  const replacePrefilledRef = useRef(false);
  const isDevSelfView = isDeveloper && !isDirector;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [viewId, setViewId] = useState<string | null>(null);

  const viewReport = viewId ? list.find((r) => r.id === viewId) ?? null : null;
  const directorReviewReport = editingReviewId ? list.find((r) => r.id === editingReviewId) ?? null : null;

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

  useEffect(() => {
    if (!replaceWholeReview) {
      replacePrefilledRef.current = false;
      return;
    }
    if (!directorReviewReport) return;
    if (!replacePrefilledRef.current) {
      setReviewAppend(directorReviewReport.remarks ?? "");
      replacePrefilledRef.current = true;
    }
  }, [replaceWholeReview, directorReviewReport]);

  const updateReview = async (id: string, reviewStatus: "viewed" | "checked") => {
    const append = !replaceWholeReview;
    const trimmed = reviewAppend.trim();
    const existingRemarks = (directorReviewReport?.remarks ?? "").trim();
    if (reviewStatus === "checked" && append && !trimmed && !existingRemarks) {
      alert("Add a director note (appended) or use “Replace entire remarks” with full text before marking checked.");
      return;
    }
    if (reviewStatus === "checked" && !append && !trimmed) {
      alert("Enter the full remarks text before marking checked when replacing.");
      return;
    }
    try {
      const body = append
        ? {
            reviewStatus,
            remarks: trimmed || undefined,
            appendRemarks: Boolean(trimmed)
          }
        : { reviewStatus, remarks: trimmed || undefined, appendRemarks: false };
      const res = await apiFetch(`/developer-reports/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setEditingReviewId(null);
        setReviewAppend("");
        setReplaceWholeReview(false);
        replacePrefilledRef.current = false;
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
    <section className="flex flex-col gap-4 max-sm:gap-3">
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-base font-semibold text-slate-50 sm:text-lg">
            {isDirector ? "Developer reports" : "My reports"}
          </h2>
          <p className="text-xs leading-relaxed text-slate-300 sm:text-sm sm:leading-normal">
            {isDirector
              ? "View reports from developers. Each entry shows when it was filed and last updated on the server — useful even if you were not online when it was submitted."
              : "Daily standard: cover the sections with enough detail (at least 60 characters total). Filed reports are read-only — you cannot edit or delete them after save; only new entries can be added (one per calendar day)."}
          </p>
        </div>
        {isDeveloper && (
          <button
            type="button"
            onClick={startNew}
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 sm:px-4 sm:py-2 sm:text-sm"
          >
            New report
          </button>
        )}
      </div>

      {showForm && isDeveloper && (
        <div className="shell max-w-2xl border-sky-600/30">
          <h3 className="mb-3 text-xs font-semibold text-slate-200 sm:text-sm">Submit report</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Report date</span>
              <input
                type="date"
                value={form.reportDate}
                onChange={(e) => setForm((p) => ({ ...p, reportDate: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 sm:px-3 sm:py-2 sm:text-sm"
                required
              />
            </label>
            {FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400 sm:text-xs">{label}</span>
                <textarea
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  rows={2}
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 sm:px-3 sm:py-2 sm:text-sm"
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm">
                {submitting ? "Saving…" : "Submit"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 sm:px-4 sm:py-2 sm:text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="shell">
        <h3 className="mb-3 text-xs font-semibold text-slate-200 sm:text-sm">
          {isDirector ? "All reports" : "My reports"} — {list.length} total
        </h3>
        {list.length === 0 ? (
          <p className="text-xs text-slate-400 sm:text-sm">
            No reports yet. {isDeveloper && "Use “New report” to add one."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
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
                    <Fragment key={report.id}>
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
                                    setReviewAppend("");
                                    setReplaceWholeReview(false);
                                    replacePrefilledRef.current = false;
                                    setViewId(report.id);
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
                          <td colSpan={isDirector ? 6 : 5} className="px-2 py-2 sm:px-3 sm:py-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Director review</p>
                                <p className="mt-1 text-xs text-slate-200 sm:text-sm">
                                  Status: <span className={badgeClass}>{status}</span>
                                </p>
                                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Remarks</p>
                                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200 sm:text-sm">
                                  {report.remarks?.trim() ? report.remarks.trim() : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Report details</p>
                                {FIELDS.map(({ key, label }) => (
                                  <div key={`${report.id}-${key}`} className="mt-2">
                                    <p className="text-[11px] text-slate-400 sm:text-xs">{label}</p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-200 sm:text-sm">
                                      {(report as any)[key]?.trim?.() ? (report as any)[key].trim() : "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isDevSelfView && list.some((r) => (r.reviewStatus ?? "pending") !== "pending" || Boolean(r.remarks?.trim())) && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
            <p className="text-xs font-medium text-slate-200 sm:text-sm">Director review notes</p>
            <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
              When leadership marks a report as viewed/checked, remarks appear here and in the table.
            </p>
          </div>
        )}
      </div>

      {isDevSelfView && viewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 sm:px-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 sm:p-5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-[11px] text-slate-500 sm:text-xs">Developer report</p>
                <h3 className="mt-1 text-base font-semibold text-slate-100 sm:text-lg">
                  {new Date(viewReport.reportDate).toLocaleDateString()}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">Filed {new Date(viewReport.createdAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewId(null)}
                className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-900 sm:px-3 sm:py-2 sm:text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:mt-4 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Director review</p>
              <div className="mt-2 text-xs text-slate-200 sm:text-sm">
                Status: <span className="ml-2">{viewReport.reviewStatus ?? "pending"}</span>
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Remarks</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200 sm:text-sm">
                {viewReport.remarks?.trim() ? viewReport.remarks.trim() : "—"}
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
              {FIELDS.map(({ key, label }) => (
                <div key={`${viewReport.id}-modal-${key}`} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200 sm:text-sm">
                    {(viewReport as any)[key]?.trim?.() ? (viewReport as any)[key].trim() : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isDirector && directorReviewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 sm:px-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 sm:p-5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-[11px] text-slate-500 sm:text-xs">Developer report — Review</p>
                <h3 className="mt-1 text-base font-semibold text-slate-100 sm:text-lg">
                  {new Date(directorReviewReport.reportDate).toLocaleDateString()}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                  Filed {new Date(directorReviewReport.createdAt).toLocaleString()}
                  {directorReviewReport.submittedBy
                    ? ` · By ${directorReviewReport.submittedBy.name ?? directorReviewReport.submittedBy.email}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingReviewId(null);
                  setViewId(null);
                  setReviewAppend("");
                  setReplaceWholeReview(false);
                  replacePrefilledRef.current = false;
                }}
                className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-900 sm:px-3 sm:py-2 sm:text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:mt-4 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">Review</p>
              <div className="mt-2 text-xs text-slate-200 sm:text-sm">
                Current status: <span className="ml-2">{directorReviewReport.reviewStatus ?? "pending"}</span>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                  Current remarks (includes any automated reply)
                </p>
                <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900/60 px-2 py-2 text-xs text-slate-200 sm:text-sm">
                  {directorReviewReport.remarks?.trim() ? directorReviewReport.remarks.trim() : "— None yet —"}
                </p>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-300 sm:text-sm">
                <input
                  type="checkbox"
                  checked={replaceWholeReview}
                  onChange={(e) => setReplaceWholeReview(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Replace entire remarks (overwrites; use to correct the full note)
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                  {replaceWholeReview ? "Full remarks" : "Add director / admin note (appended)"}
                </span>
                <textarea
                  value={reviewAppend}
                  onChange={(e) => setReviewAppend(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 sm:px-3 sm:py-2 sm:text-sm"
                  placeholder={
                    replaceWholeReview
                      ? "Edit the complete remarks shown to the developer…"
                      : "Type a note to append below the existing remarks…"
                  }
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void updateReview(directorReviewReport.id, "viewed")}
                  className="rounded border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 sm:px-3 sm:py-2 sm:text-sm"
                >
                  Mark viewed
                </button>
                <button
                  type="button"
                  onClick={() => void updateReview(directorReviewReport.id, "checked")}
                  className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 sm:px-3 sm:py-2 sm:text-sm"
                >
                  Mark checked
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
              {FIELDS.map(({ key, label }) => (
                <div key={`${directorReviewReport.id}-director-modal-${key}`} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200 sm:text-sm">
                    {(directorReviewReport as any)[key]?.trim?.() ? (directorReviewReport as any)[key].trim() : "—"}
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
