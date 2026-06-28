"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmDataBlock, PmFullscreenPage, PmPageHero } from "../../components/pm/pm-shell";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  currentFocusProject?: { id: string; name: string } | null;
};

export function PmTeamConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const load = useCallback(async () => {
    const res = await apiFetch("/pm/team");
    if (res.ok) setTeam((await res.json()) as TeamMember[]);
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  if (!canAccess) return null;

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Team"
        title="Developers in delivery"
        description="People on active projects — use check-ins and tasks to keep momentum."
        backHref="/pm"
      />
      <PmDataBlock>
        {team.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">No developers on active projects.</p>
        ) : (
          team.map((m) => (
            <div key={m.id} className={`${pmNeu.listRow} flex flex-wrap items-center justify-between gap-2`}>
              <div>
                <p className="font-medium text-slate-100">{m.name}</p>
                <p className="text-xs text-slate-500">{m.jobTitle || m.email}</p>
                {m.currentFocusProject ? (
                  <p className="mt-1 text-xs text-teal-400/80">Focus: {m.currentFocusProject.name}</p>
                ) : null}
              </div>
              <Link href={`/pm/check-ins?developer=${m.id}`} className={pmNeu.btnGhost}>
                Check-in
              </Link>
            </div>
          ))
        )}
      </PmDataBlock>
    </PmFullscreenPage>
  );
}
