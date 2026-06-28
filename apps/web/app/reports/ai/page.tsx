"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";
import { DirectorBriefingDocument, briefingAtAGlance } from "../../../components/director/director-briefing-view";
import { directorNeu } from "../../../components/director/director-theme";
import { WorkspaceDashboardIntro } from "../../../components/workspace-dashboard-intro";

type AiReport = {
  id: string;
  dateKey: string;
  subject: string;
  body: string;
  createdAt: string;
};

function formatDateKey(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? dateKey
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function AiReportsPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const [reports, setReports] = useState<AiReport[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
          if (list.length > 0) {
            setSelectedId((prev) => prev ?? list[0].id);
          }
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

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5">
      <WorkspaceDashboardIntro
        title="Director briefings"
        description="End-of-day AI summaries for leadership — structured by delivery, pipeline, team accountability, and risks. Generated automatically around 7pm org time."
        eyebrow="AI reports"
        actions={
          <Link href="/reports" className={`shrink-0 ${directorNeu.btnGhost}`}>
            ← Back to reports
          </Link>
        }
      />

      {!loadedOnce && (
        <div className={directorNeu.panel}>
          <p className="text-sm text-slate-400">Loading briefings…</p>
        </div>
      )}

      {loadedOnce && reports.length === 0 && (
        <div className={`${directorNeu.panel} text-center`}>
          <p className="font-medium text-slate-200">No briefings yet</p>
          <p className="mt-2 text-sm text-slate-500">
            The first director briefing appears after the scheduled daily run (around 7pm org time).
          </p>
        </div>
      )}

      {loadedOnce && reports.length > 0 && (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(15rem,18rem)_1fr] lg:gap-5">
          <aside className={`flex min-h-0 flex-col ${directorNeu.panel} !p-0`}>
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Archive</p>
              <p className="mt-0.5 text-sm text-slate-300">{reports.length} briefing{reports.length === 1 ? "" : "s"}</p>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label="Briefing dates">
              {reports.map((r) => {
                const active = selected?.id === r.id;
                const preview = briefingAtAGlance(r.body, 72);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setSelectedId(r.id)}
                      className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${
                        active
                          ? `${directorNeu.navActive} border`
                          : `${directorNeu.listRow} hover:border-sky-500/15`
                      }`}
                    >
                      <p className="text-xs font-medium text-sky-300/90">{formatDateKey(r.dateKey)}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{preview}</p>
                      <p className="mt-1.5 text-[10px] text-slate-600">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="min-h-0 min-w-0 overflow-y-auto">
            {selected && (
              <DirectorBriefingDocument
                body={selected.body}
                dateKey={selected.dateKey}
                subject={selected.subject}
                generatedAt={selected.createdAt}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
