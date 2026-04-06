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
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-cres-border bg-cres-surface/40 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-cres-text">{r.subject}</p>
                      <p className="text-xs text-cres-text-muted">Date: {r.dateKey}</p>
                    </div>
                    <p className="text-xs text-cres-text-muted">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-cres-text">{r.body}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
