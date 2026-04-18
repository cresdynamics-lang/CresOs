"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";

type AiReport = {
  id: string;
  dateKey: string;
  subject: string;
  body: string;
  createdAt: string;
};

export default function AiReportsPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const [reports, setReports] = useState<AiReport[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const canAccess = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) {
      router.replace("/reports");
    }
  }, [hydrated, auth.accessToken, canAccess, router]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    async function load() {
      try {
        const res = await apiFetch("/reports/ai");
        if (res.ok) {
          const list = (await res.json()) as AiReport[];
          setReports(list);
        } else {
          setReports([]);
        }
      } catch {
        setReports([]);
      } finally {
        setLoadedOnce(true);
      }
    }
    void load();
  }, [hydrated, auth.accessToken, apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-2 border-cres-border bg-cres-surface/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-cres-text">AI Reports</h2>
          <p className="text-sm text-cres-text-muted">Daily 8pm EAT summaries generated automatically for directors/admin.</p>
        </div>
        <Link
          href="/reports"
          className="shrink-0 rounded-lg border border-cres-border px-4 py-2 text-sm font-medium text-cres-text hover:bg-cres-surface"
        >
          Back to Reports →
        </Link>
      </div>

      {!loadedOnce && (
        <div className="shell">
          <p className="text-sm text-cres-text-muted">Loading AI reports…</p>
        </div>
      )}

      {loadedOnce && (
        <div className="shell border-cres-border bg-cres-card/80">
          {reports.length === 0 ? (
            <p className="text-sm text-cres-text-muted">No AI reports yet. The first one will appear after 8pm EAT.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto sm:mx-0">
              <table className="min-w-[40rem] w-full text-left text-sm sm:min-w-full">
                <caption className="sr-only">AI reports by date</caption>
                <thead>
                  <tr className="border-b border-cres-border text-xs font-medium uppercase tracking-wide text-cres-text-muted">
                    <th className="px-2 py-2 sm:px-3">Date</th>
                    <th className="px-2 py-2 sm:px-3">Subject</th>
                    <th className="px-2 py-2 sm:px-3">Generated</th>
                    <th className="min-w-[12rem] px-2 py-2 sm:px-3">Body</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const dateLabel = (() => {
                      const d = new Date(`${r.dateKey}T12:00:00`);
                      return Number.isNaN(d.getTime()) ? r.dateKey : d.toLocaleDateString();
                    })();
                    return (
                      <tr key={r.id} className="border-b border-cres-border align-top text-cres-text">
                        <td className="whitespace-nowrap px-2 py-3 text-cres-text-muted sm:px-3">{dateLabel}</td>
                        <td className="min-w-0 px-2 py-3 font-medium sm:px-3">{r.subject}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs text-cres-text-muted sm:px-3">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="min-w-0 px-2 py-3 sm:px-3">
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-cres-text">
                            {r.body}
                          </pre>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
