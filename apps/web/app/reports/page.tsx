"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";

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
  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));

  useEffect(() => {
    async function load() {
      try {
        const [listRes, alarmRes] = await Promise.all([
          apiFetch("/reports"),
          apiFetch("/reports/alarms/overdue")
        ]);
        if (listRes.ok) {
          const data = (await listRes.json()) as Report[];
          setReports(data);
        }
        if (alarmRes.ok) {
          const data = (await alarmRes.json()) as { overdue: OverdueItem[] };
          setOverdue(data.overdue ?? []);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-3 border-cres-border bg-cres-surface/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-cres-text">
            {isDirector ? "Submitted reports" : "My reports"}
          </h2>
          <p className="text-sm text-cres-text-muted">
            {isDirector
              ? "View and comment on sales activity reports. Submitted at shows the server time when sales finalized the report (reliable even if you were offline)."
              : "Submitted reports are read-only. Create a draft, then submit — you cannot change the body of a submitted report."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirector && (
            <Link
              href="/reports/ai"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-cres-border px-4 py-2 text-sm font-medium text-cres-text hover:bg-cres-surface"
            >
              AI Reports →
            </Link>
          )}
          {!isDirector && (
            <Link
              href="/reports/new"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cres-accent px-4 py-2 text-sm font-medium text-cres-bg hover:bg-cres-accent-hover"
            >
              New report
            </Link>
          )}
        </div>
      </div>

      {!isDirector && overdue.length > 0 && (
        <div className="rounded-xl border border-cres-accent/40 bg-cres-surface px-4 py-3">
          <p className="mb-2 font-semibold text-cres-accent">
            Alarm: {overdue.length} director question(s) not answered within 24 hours
          </p>
          <ul className="list-inside list-disc text-sm text-cres-text">
            {overdue.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/reports/${o.reportId}`} className="underline">
                  {o.reportTitle}
                </Link>
                — answer by deadline
              </li>
            ))}
            {overdue.length > 5 && <li>… and {overdue.length - 5} more</li>}
          </ul>
        </div>
      )}

      <div className="shell overflow-x-auto border-cres-border bg-cres-card/80">
        {reports.length === 0 ? (
          <p className="text-cres-muted">
            {isDirector ? "No submitted reports yet." : "You have no reports yet. Create one to get started."}
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-cres-border text-xs uppercase tracking-wide text-cres-muted">
                <th className="pb-2 pr-3">Title</th>
                {isDirector && <th className="pb-2 pr-3">Submitted by</th>}
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Review</th>
                <th className="pb-2 pr-3">Remarks</th>
                <th className="pb-2 pr-3">Submitted at</th>
                <th className="pb-2 pr-3">Created at</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-cres-border/60 hover:bg-cres-surface/60"
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/reports/${r.id}`}
                      className="text-cres-text hover:text-cres-accent"
                    >
                      {r.title}
                    </Link>
                  </td>
                  {isDirector && (
                    <td className="py-2 pr-3 text-xs text-cres-text-muted">
                      {r.submittedBy
                        ? r.submittedBy.name ?? r.submittedBy.email
                        : "—"}
                    </td>
                  )}
                  <td className="py-2 pr-3 text-xs">
                    <span
                      className={
                        r.status === "submitted"
                          ? "rounded bg-cres-accent/20 px-2 py-0.5 text-cres-accent"
                          : "rounded bg-cres-border px-2 py-0.5 text-cres-text-muted"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <span
                      className={
                        r.reviewStatus === "checked"
                          ? "rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                          : r.reviewStatus === "viewed"
                            ? "rounded bg-sky-500/15 px-2 py-0.5 text-sky-300"
                            : "rounded bg-amber-500/15 px-2 py-0.5 text-amber-200"
                      }
                    >
                      {r.reviewStatus ?? "pending"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-cres-text-muted">
                    {r.remarks?.trim() ? r.remarks.trim().slice(0, 80) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-cres-muted">
                    {r.submittedAt
                      ? new Date(r.submittedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-cres-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
