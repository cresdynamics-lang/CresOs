"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { WorkspaceRouteShell } from "../../components/workspace/workspace-route-shell";

export function DeveloperReportsLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
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
      <div className="developer-glass flex h-full items-center justify-center bg-[#080b12] text-sm text-slate-400">
        Loading reports…
      </div>
    );
  }

  if (!canAccess) return null;

  return <WorkspaceRouteShell workspace="developer">{children}</WorkspaceRouteShell>;
}
