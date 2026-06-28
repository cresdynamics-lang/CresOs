"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceRouteShell } from "../../components/workspace/workspace-route-shell";
import { devNeu } from "../../components/developer/developer-theme";
import { LeadershipLayoutGate } from "../../components/workspace/leadership-layout-gate";
import { isDirectorOnly } from "../../lib/is-director-only";
import { isAdminOnly } from "../../lib/is-admin-only";

export function DeveloperReportsLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();

  if (isDirectorOnly(auth.roleKeys) || isAdminOnly(auth.roleKeys)) {
    return <LeadershipLayoutGate>{children}</LeadershipLayoutGate>;
  }

  const canAccess =
    auth.roleKeys.includes("developer") ||
    auth.roleKeys.includes("admin") ||
    auth.roleKeys.includes("director_admin");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${devNeu.workspace} developer-fullscreen flex min-h-[16rem] flex-1 items-center justify-center text-sm text-slate-400 ${devNeu.canvas}`}
      >
        Loading reports…
      </div>
    );
  }

  if (!canAccess) return null;

  return <WorkspaceRouteShell workspace="developer">{children}</WorkspaceRouteShell>;
}
