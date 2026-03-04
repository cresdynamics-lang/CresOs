"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";

type Report = {
  id: string;
  title: string;
  body: string;
  status: string;
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
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-50">
            {isDirector ? "Submitted reports" : "My reports"}
          </h2>
          <p className="text-sm text-slate-300">
            {isDirector
              ? "View and comment on sales activity reports."
              : "View your report history (read-only) or create and submit a new report."}
          </p>
        </div>
        {!isDirector && (
          <Link
            href="/reports/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            New report
          </Link>
        )}
      </div>

      {!isDirector && overdue.length > 0 && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 px-4 py-3">
          <p className="mb-2 font-semibold text-rose-400">
            Alarm: {overdue.length} director question(s) not answered within 24 hours
          </p>
          <ul className="list-inside list-disc text-sm text-rose-200">
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

      <div className="shell">
        {reports.length === 0 ? (
          <p className="text-slate-400">
            {isDirector ? "No submitted reports yet." : "You have no reports yet. Create one to get started."}
          </p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 hover:border-slate-700"
                >
                  <span className="font-medium text-slate-100">{r.title}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {r.submittedBy && (
                      <span className="text-slate-400">
                        {r.submittedBy.name ?? r.submittedBy.email}
                      </span>
                    )}
                    <span
                      className={
                        r.status === "submitted"
                          ? "rounded bg-emerald-900/60 px-2 py-0.5 text-emerald-300"
                          : "rounded bg-amber-900/60 px-2 py-0.5 text-amber-300"
                      }
                    >
                      {r.status}
                    </span>
                    {r.submittedAt && (
                      <span className="text-slate-500">
                        Submitted {new Date(r.submittedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
