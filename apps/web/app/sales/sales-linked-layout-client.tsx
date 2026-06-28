"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { salesWs } from "../../components/sales/sales-theme";
import { WorkspaceRouteShell } from "../../components/workspace/workspace-route-shell";

/** Sales workspace chrome for pipeline routes (/leads, /crm, /reports). */
export function SalesLinkedLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, hydrated } = useAuth();
  const canAccess = auth.roleKeys.some((r) =>
    ["admin", "sales", "director_admin", "finance"].includes(r)
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccess) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccess, router]);

  if (!hydrated || !auth.accessToken) {
    return (
      <div
        className={`${salesWs.workspace} flex h-full items-center justify-center text-sm text-slate-400 ${salesWs.canvas}`}
      >
        Loading…
      </div>
    );
  }

  if (!canAccess) return null;

  return <WorkspaceRouteShell workspace="sales">{children}</WorkspaceRouteShell>;
}
