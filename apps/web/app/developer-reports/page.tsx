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

export default function DeveloperReportsPage() {
  const { apiFetch, auth } = useAuth();
  const [list, setList] = useState<DeveloperReport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await apiFetch(`/developer-reports/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whatWorked: form.whatWorked.trim() || undefined,
            blockers: form.blockers.trim() || undefined,
            needsAttention: form.needsAttention.trim() || undefined,
            implemented: form.implemented.trim() || undefined,
            pending: form.pending.trim() || undefined,
            nextPlan: form.nextPlan.trim() || undefined
          })
        });
        if (res.ok) {
          setEditingId(null);
          setShowForm(false);
          await load();
        }
      } else {
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
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(report: DeveloperReport) {
    setEditingId(report.id);
    setForm({
      reportDate: report.reportDate.slice(0, 10),
      whatWorked: report.whatWorked ?? "",
      blockers: report.blockers ?? "",
      needsAttention: report.needsAttention ?? "",
      implemented: report.implemented ?? "",
      pending: report.pending ?? "",
      nextPlan: report.nextPlan ?? ""
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setForm({ reportDate: todayDateString(), whatWorked: "", blockers: "", needsAttention: "", implemented: "", pending: "", nextPlan: "" });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this report?")) return;
    try {
      const res = await apiFetch(`/developer-reports/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch {
      // ignore
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-50">
            {isDirector ? "Developer daily reports" : "My daily reports"}
          </h2>
          <p className="text-sm text-slate-300">
            {isDirector
              ? "View daily reports from developers: what worked, blockers, implemented, pending, and next plan."
              : "Submit daily reports: what worked, blockers, what needs attention, what's implemented, pending, and next plan."}
          </p>
        </div>
        {isDeveloper && (
          <button
            type="button"
            onClick={startNew}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            New daily report
          </button>
        )}
      </div>

      {showForm && isDeveloper && (
        <div className="shell max-w-2xl border-sky-600/30">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            {editingId ? "Edit report" : "Submit daily report"}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {!editingId && (
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
            )}
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
                {submitting ? "Saving…" : editingId ? "Update" : "Submit"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
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
            No daily reports yet. {isDeveloper && "Use “New daily report” to add one."}
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((report) => (
              <li key={report.id} className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">
                    {new Date(report.reportDate).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </span>
                  {report.submittedBy && (
                    <span className="text-xs text-slate-400">
                      {report.submittedBy.name ?? report.submittedBy.email}
                    </span>
                  )}
                  {isDeveloper && !editingId && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(report)} className="text-xs text-sky-400 hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(report.id)} className="text-xs text-rose-400 hover:underline">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <dl className="grid gap-2 text-sm">
                  {FIELDS.map(({ key, label }) => {
                    const value = report[key as keyof DeveloperReport];
                    if (value == null || value === "") return null;
                    return (
                      <div key={key}>
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-slate-200">{value}</dd>
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
