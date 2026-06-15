"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { CrmActionLink, CrmDataTable, CrmSectionPanel, CrmTableHead } from "../../components/crm/crm-section";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { formatNairobiDateTime } from "../../lib/nairobi-datetime";

type Report = {
  id: string;
  title: string;
  body: string;
  status: string;
  reviewStatus?: string;
  remarks?: string | null;
  submittedAt: string | null;
  createdAt: string;
  submittedBy?: { id: string; name: string | null; email: string };
  bodyPreview?: string;
  bodyCharCount?: number;
  hasAiLeadershipReply?: boolean;
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

export default function ReportsPage() {
  const { apiFetch, auth } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isLeadership = auth.roleKeys.some((r) => ["director_admin", "director", "admin"].includes(r));
  const isSalesOnly =
    auth.roleKeys.includes("sales") &&
    !auth.roleKeys.some((r) => ["admin", "director_admin", "director"].includes(r));

  useEffect(() => {
    async function load() {
      setLoadError(null);
      try {
        const [listRes, alarmRes] = await Promise.all([apiFetch("/reports"), apiFetch("/reports/alarms/overdue")]);
        if (listRes.ok) {
          const data = (await listRes.json()) as Report[];
          setReports(data);
        } else {
          const err = (await listRes.json().catch(() => ({}))) as { error?: string; message?: string };
          setLoadError(err.message ?? err.error ?? `Could not load reports (${listRes.status})`);
          setReports([]);
        }
        if (alarmRes.ok) {
          const data = (await alarmRes.json()) as { overdue: OverdueItem[] };
          setOverdue(data.overdue ?? []);
        }
      } catch {
        setLoadError("Could not reach the server. Check your connection and try again.");
        setReports([]);
      }
    }
    void load();
  }, [apiFetch, isLeadership]);

  const reportTitle = isLeadership ? "Submitted reports" : "My reports";
  const reportDescription = isLeadership
    ? auth.roleKeys.includes("admin")
      ? "Admins and directors see who submitted each sales report, a short preview of what they wrote, character count, whether an automated leadership reply was added to the thread, and exact server timestamps."
      : "View and comment on sales activity reports. Submitted at shows the server time when sales finalized the report (reliable even if you were offline)."
    : "Submitted reports are read-only. Create a draft, then submit — you cannot change the body of a submitted report.";

  return (
    <section className="flex min-h-[calc(100dvh-6.5rem)] max-lg:min-h-[calc(100dvh-10rem)] w-full min-w-0 flex-1 flex-col gap-5">
      <WorkspaceDashboardIntro
        title={reportTitle}
        description={reportDescription}
        eyebrow="Sales reports"
        brandLead="Operating system for growth"
        showWelcomeBanner={isSalesOnly}
        showWelcomeRoleLabel={false}
        actions={
          <>
            {isLeadership && (
              <Link
                href="/reports/ai"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-violet-500/40 bg-violet-950/30 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-900/40"
              >
                AI Reports →
              </Link>
            )}
            {!isLeadership && (
              <Link
                href="/reports/new"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/30 hover:from-amber-500 hover:to-rose-500"
              >
                <span className="text-lg leading-none" aria-hidden>
                  +
                </span>
                New report
              </Link>
            )}
          </>
        }
      />

      {loadError && (
        <div className="shrink-0 rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {loadError}
        </div>
      )}

      {!isLeadership && overdue.length > 0 && (
        <div className="shrink-0 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-slate-950/90 to-slate-950 px-4 py-3 sm:px-5">
          <p className="font-semibold text-amber-200">
            Alarm: {overdue.length} director question{overdue.length === 1 ? "" : "s"} not answered within 24 hours
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
            {overdue.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/reports/${o.reportId}`} className="text-amber-300 hover:underline">
                  {o.reportTitle}
                </Link>
                {" — answer by deadline"}
              </li>
            ))}
            {overdue.length > 5 && <li className="text-slate-500">… and {overdue.length - 5} more</li>}
          </ul>
        </div>
      )}

      <CrmSectionPanel
        title={isLeadership ? "Sales report submissions" : "Your submitted reports"}
        tone="amber"
        description={`${reports.length} report${reports.length === 1 ? "" : "s"}${isLeadership ? " · leadership review" : " · read-only after submit"}`}
        className="flex min-h-[min(28rem,55vh)] flex-1 flex-col lg:min-h-0"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          {reports.length === 0 ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-xl border border-dashed border-amber-800/40 bg-gradient-to-br from-amber-950/25 via-slate-950/60 to-slate-950 px-6 py-12 text-center">
              <p className="font-display text-xl font-bold tracking-tight text-amber-200/90">
                {isLeadership ? "No submitted reports yet" : "No reports yet"}
              </p>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                {isLeadership
                  ? "Sales activity reports will appear here when your team submits them."
                  : "Create a draft and submit your first activity report."}
              </p>
              {!isLeadership && (
                <Link
                  href="/reports/new"
                  className="mt-6 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-amber-500"
                >
                  New report
                </Link>
              )}
            </div>
          ) : (
            <CrmDataTable emptyMessage="No reports" isEmpty={false}>
              <table className="min-w-full text-left text-sm text-slate-200">
                <CrmTableHead>
                  <th className="px-3 py-2.5 font-medium">Title</th>
                  {isLeadership && <th className="px-3 py-2.5 font-medium">Submitted by</th>}
                  {isLeadership && <th className="px-3 py-2.5 font-medium">Activity preview</th>}
                  {isLeadership && <th className="px-3 py-2.5 font-medium">Chars</th>}
                  {isLeadership && <th className="px-3 py-2.5 font-medium">Auto reply</th>}
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Review</th>
                  <th className="px-3 py-2.5 font-medium">Remarks</th>
                  <th className="px-3 py-2.5 font-medium">Submitted at</th>
                  <th className="px-3 py-2.5 font-medium">Created at</th>
                  <th className="px-3 py-2.5 text-right font-medium">Action</th>
                </CrmTableHead>
                <tbody>
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-800/60 align-top transition-colors hover:bg-amber-500/5"
                    >
                      <td className="px-3 py-2.5">
                        <Link href={`/reports/${r.id}`} className="font-medium text-amber-300 hover:underline">
                          {r.title}
                        </Link>
                      </td>
                      {isLeadership && (
                        <td className="px-3 py-2.5 text-xs text-slate-400">
                          {r.submittedBy ? r.submittedBy.name ?? r.submittedBy.email : "—"}
                        </td>
                      )}
                      {isLeadership && (
                        <td
                          className="max-w-[14rem] px-3 py-2.5 text-xs text-slate-400"
                          title={r.bodyPreview ?? r.body}
                        >
                          {(() => {
                            if (r.bodyPreview?.trim()) return r.bodyPreview.trim();
                            if (!r.body) return "—";
                            const flat = r.body.replace(/\s+/g, " ").trim();
                            return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
                          })()}
                        </td>
                      )}
                      {isLeadership && (
                        <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">
                          {typeof r.bodyCharCount === "number" ? r.bodyCharCount : (r.body?.length ?? "—")}
                        </td>
                      )}
                      {isLeadership && (
                        <td className="px-3 py-2.5 text-xs">
                          {r.hasAiLeadershipReply === true ? (
                            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">Yes</span>
                          ) : r.hasAiLeadershipReply === false ? (
                            <span className="text-slate-500">No</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-xs">
                        <span
                          className={
                            r.status === "submitted"
                              ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                              : "rounded-full bg-slate-700/80 px-2 py-0.5 text-slate-400"
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span
                          className={
                            r.reviewStatus === "checked"
                              ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                              : r.reviewStatus === "viewed"
                                ? "rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300"
                                : "rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200"
                          }
                        >
                          {r.reviewStatus ?? "pending"}
                        </span>
                      </td>
                      <td className="max-w-[10rem] px-3 py-2.5 text-xs text-slate-400">
                        {r.remarks?.trim() ? r.remarks.trim().slice(0, 80) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                        {r.submittedAt ? formatNairobiDateTime(r.submittedAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                        {formatNairobiDateTime(r.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <CrmActionLink href={`/reports/${r.id}`}>Review</CrmActionLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CrmDataTable>
          )}
        </div>
      </CrmSectionPanel>
    </section>
  );
}
