"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { CrmActionLink, CrmDataTable, CrmSectionPanel, CrmTableHead } from "../../components/crm/crm-section";
import { devGlass } from "../../components/developer/developer-glass-theme";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { formatNairobiDate, formatNairobiDateTime } from "../../lib/nairobi-datetime";

function reportPreview(report: DeveloperReport): string {
  const parts = [report.whatWorked, report.blockers, report.needsAttention, report.implemented]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  const flat = parts.join(" · ");
  if (!flat) return "—";
  return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
}

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
  hasAiLeadershipReply?: boolean;
  pendingQuestionsCount?: number;
  submittedBy?: { id: string; name: string | null; email: string };
};

type OverdueItem = {
  id: string;
  reportId: string;
  reportTitle: string;
  content: string;
  askedAt: string;
  deadline: string;
  overdue: boolean;
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
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [aiPollReportId, setAiPollReportId] = useState<string | null>(null);
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "director", "admin"].includes(r));
  const isDeveloper = auth.roleKeys.includes("developer");
  const isDevSelfView = isDeveloper && !isDirector;
  const [directorLabel, setDirectorLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isDevSelfView) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/account/me");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          reportsToDirector?: { name: string | null; email: string } | null;
        };
        const d = data.reportsToDirector;
        if (d) setDirectorLabel(d.name?.trim() || d.email);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, isDevSelfView]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [listRes, alarmRes] = await Promise.all([
        apiFetch("/developer-reports"),
        apiFetch("/developer-reports/alarms/overdue")
      ]);
      if (listRes.ok) {
        setList((await listRes.json()) as DeveloperReport[]);
      } else {
        const err = (await listRes.json().catch(() => ({}))) as { error?: string; message?: string };
        setLoadError(err.message ?? err.error ?? `Could not load reports (${listRes.status})`);
        setList([]);
      }
      if (alarmRes.ok) {
        const data = (await alarmRes.json()) as { overdue: OverdueItem[] };
        setOverdue(data.overdue ?? []);
      }
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
      setList([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!aiPollReportId) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      if (attempts >= 20) {
        setAiPollReportId(null);
        return;
      }
      attempts += 1;
      try {
        const listRes = await apiFetch("/developer-reports");
        if (cancelled) return;
        if (listRes.ok) {
          const data = (await listRes.json()) as DeveloperReport[];
          setList(data);
          const row = data.find((r) => r.id === aiPollReportId);
          if (row?.hasAiLeadershipReply) {
            setAiPollReportId(null);
            return;
          }
        }
      } catch {
        // keep polling
      }
      if (!cancelled) window.setTimeout(tick, 2500);
    };
    window.setTimeout(tick, 2500);
    return () => {
      cancelled = true;
    };
  }, [aiPollReportId, apiFetch]);

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
        const created = (await res.json()) as { id: string };
        setShowForm(false);
        setForm({ reportDate: todayDateString(), whatWorked: "", blockers: "", needsAttention: "", implemented: "", pending: "", nextPlan: "" });
        await load();
        if (created.id) setAiPollReportId(created.id);
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
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 px-3 py-4 sm:px-6 sm:py-5">
      <WorkspaceDashboardIntro
        title={isDirector ? "Developer reports" : "My reports"}
        description={
          isDirector
            ? "View reports from developers. Leadership AI review runs automatically on the server when a report is filed — directors do not need to trigger it. Use this list to see review status and open threads."
            : directorLabel
              ? `Submit daily reports to ${directorLabel}. Leadership review and questions are added automatically within about a minute — you do not need anyone online. Answer open questions within 24 hours. One report per calendar day; filed entries are read-only.`
              : "Leadership review and questions are added automatically when you submit — usually within a minute. Answer open questions within 24 hours. One report per calendar day; filed entries are read-only."
        }
        eyebrow={isDirector ? "Director" : "Developer reports"}
        brandLead="Operating system for growth"
        showWelcomeBanner={isDeveloper && !isDirector}
        showWelcomeRoleLabel={false}
        actions={
          isDeveloper ? (
            <button
              type="button"
              onClick={startNew}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 hover:from-violet-500 hover:to-sky-500"
            >
              <span className="text-lg leading-none" aria-hidden>
                +
              </span>
              New report
            </button>
          ) : undefined
        }
      />

      {loadError && (
        <div className="shrink-0 rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {loadError}
        </div>
      )}

      {isDevSelfView && aiPollReportId && (
        <div className={`shrink-0 ${devGlass.alertInfo} px-4 py-3 sm:px-5`}>
          <p className="text-sm text-sky-200">
            Leadership is reviewing your report — automated feedback and questions usually appear within a minute.
          </p>
        </div>
      )}

      {isDevSelfView && overdue.length > 0 && (
        <div className={`shrink-0 ${devGlass.alertWarning} px-4 py-3 sm:px-5`}>
          <p className="font-semibold text-amber-200">
            Alarm: {overdue.length} director question{overdue.length === 1 ? "" : "s"} not answered within 24 hours
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
            {overdue.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/developer-reports/${o.reportId}`} className="text-amber-300 hover:underline">
                  Report {o.reportTitle}
                </Link>
                {" — answer by deadline"}
              </li>
            ))}
            {overdue.length > 5 && <li className="text-slate-500">… and {overdue.length - 5} more</li>}
          </ul>
        </div>
      )}

      <CrmSectionPanel
        title={isDirector ? "All developer reports" : "My report history"}
        tone="violet"
        description={`${list.length} report${list.length === 1 ? "" : "s"} · filed entries are read-only`}
        className="flex min-h-[min(28rem,55vh)] flex-1 flex-col lg:min-h-0"
      >
        <div className="min-h-0 flex-1 overflow-auto">
        {list.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-xl border border-dashed border-violet-800/40 bg-gradient-to-br from-violet-950/25 via-slate-950/60 to-slate-950 px-6 py-12 text-center">
            <p className="font-display text-xl font-bold tracking-tight text-violet-200/90">No reports yet</p>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              {isDeveloper
                ? "Submit your first daily report to keep delivery visible to leadership."
                : "Reports from your team will appear here."}
            </p>
            {isDeveloper && (
              <button
                type="button"
                onClick={startNew}
                className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-violet-500"
              >
                New report
              </button>
            )}
          </div>
        ) : (
          <CrmDataTable emptyMessage="No reports" isEmpty={false}>
            <table className="min-w-full text-left text-sm text-slate-200">
              <CrmTableHead>
                <th className="px-3 py-2.5 font-medium">Date</th>
                {isDirector && <th className="px-3 py-2.5 font-medium">Submitted by</th>}
                {isDirector && <th className="px-3 py-2.5 font-medium">Summary</th>}
                <th className="px-3 py-2.5 font-medium">Review</th>
                <th className="px-3 py-2.5 font-medium">Leadership</th>
                <th className="px-3 py-2.5 font-medium">Open Qs</th>
                {isDirector && <th className="px-3 py-2.5 font-medium">AI reply</th>}
                <th className="px-3 py-2.5 font-medium">Filed</th>
                <th className="px-3 py-2.5 text-right font-medium">Action</th>
              </CrmTableHead>
              <tbody>
                {list.map((report) => {
                  const status = report.reviewStatus ?? "pending";
                  const badgeClass =
                    status === "checked"
                      ? "rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                      : status === "viewed"
                        ? "rounded bg-sky-500/15 px-2 py-0.5 text-sky-300"
                        : "rounded bg-amber-500/15 px-2 py-0.5 text-amber-200";

                  return (
                    <tr key={report.id} className="border-b border-slate-800">
                      <td className="py-2 pr-3 text-slate-200">
                        <Link href={`/developer-reports/${report.id}`} className="text-violet-300 hover:underline">
                          {formatNairobiDate(report.reportDate)}
                        </Link>
                      </td>
                      {isDirector && (
                        <td className="py-2 pr-3 text-xs text-slate-400">
                          {report.submittedBy ? report.submittedBy.name ?? report.submittedBy.email : "—"}
                        </td>
                      )}
                      {isDirector && (
                        <td className="max-w-[14rem] py-2 pr-3 text-xs text-slate-400" title={reportPreview(report)}>
                          {reportPreview(report)}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-xs">
                        <span className={badgeClass}>{status}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400">
                        {report.hasAiLeadershipReply ? (
                          <span className="text-emerald-300">Reviewed</span>
                        ) : status === "pending" ? (
                          <span className="text-amber-200">Awaiting</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {(report.pendingQuestionsCount ?? 0) > 0 ? (
                          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-200">
                            {report.pendingQuestionsCount}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      {isDirector && (
                        <td className="py-2 pr-3 text-xs text-slate-400">
                          {report.hasAiLeadershipReply ? (
                            <span className="text-emerald-300">Yes</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {formatNairobiDateTime(report.createdAt)}
                      </td>
                      <td className="py-2 text-right">
                        <CrmActionLink href={`/developer-reports/${report.id}`}>Open</CrmActionLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CrmDataTable>
        )}
        </div>
      </CrmSectionPanel>

      {showForm && isDeveloper && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-950/60 via-slate-950 to-sky-950/30 shadow-2xl">
            <div className="border-b border-slate-800/80 px-5 py-4 sm:px-6">
              <h3 className="font-display text-xl font-bold tracking-tight text-violet-200">Submit developer report</h3>
              <p className="mt-1 text-sm text-slate-400">At least 60 characters total across sections.</p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Report date</span>
                <input
                  type="date"
                  value={form.reportDate}
                  onChange={(e) => setForm((p) => ({ ...p, reportDate: e.target.value }))}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  required
                />
              </label>
              {FIELDS.map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    rows={2}
                    className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  />
                </label>
              ))}
              <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-sky-500 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Submit report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
