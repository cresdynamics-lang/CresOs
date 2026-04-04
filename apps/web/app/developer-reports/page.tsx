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
          <ul className="space-y-3">
            {list.map((report) => (
              <li key={report.id} className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-100">
                      {new Date(report.reportDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      Filed {new Date(report.createdAt).toLocaleString()}
                      {report.updatedAt &&
                        new Date(report.updatedAt).getTime() !== new Date(report.createdAt).getTime() && (
                          <> · Updated {new Date(report.updatedAt).toLocaleString()}</>
                        )}
                    </p>
                  </div>
                  {report.submittedBy && (
                    <span className="text-xs text-slate-400">
                      {report.submittedBy.name ?? report.submittedBy.email}
                    </span>
                  )}
                </div>
                <dl className="grid gap-2 text-sm">
                  {FIELDS.map(({ key, label }) => {
                    const value = report[key as keyof DeveloperReport];
                    if (value == null || value === "") return null;
                    const display =
                      typeof value === "string" ? value : JSON.stringify(value);
                    return (
                      <div key={key}>
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-slate-200">
                          {display}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
