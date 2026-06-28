"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmDataBlock, PmFullscreenPage, PmPageHero } from "../../components/pm/pm-shell";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";

type DevReport = {
  id: string;
  reportDate: string;
  summary?: string | null;
  blockers?: string | null;
  submittedBy?: { id: string; name: string; email: string };
};

export function PmReportsConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const [reports, setReports] = useState<DevReport[]>([]);

  const load = useCallback(async () => {
    const res = await apiFetch("/pm/reports");
    if (res.ok) setReports((await res.json()) as DevReport[]);
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  if (!canAccess) return null;

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Team reports"
        title="Developer daily reports"
        description="Reports flow to directors and project managers — delivery signal from engineering only."
        backHref="/pm"
      />
      <PmDataBlock>
        {reports.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">No developer reports yet.</p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className={pmNeu.listRow}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-100">{r.submittedBy?.name ?? "Developer"}</p>
                <p className="text-xs text-slate-500">
                  {new Date(r.reportDate).toLocaleDateString("en-KE", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                  })}
                </p>
              </div>
              {r.summary ? <p className="mt-2 text-sm text-slate-300">{r.summary}</p> : null}
              {r.blockers ? (
                <p className="mt-1 text-xs text-amber-400/90">Blockers: {r.blockers}</p>
              ) : null}
            </div>
          ))
        )}
      </PmDataBlock>
    </PmFullscreenPage>
  );
}
