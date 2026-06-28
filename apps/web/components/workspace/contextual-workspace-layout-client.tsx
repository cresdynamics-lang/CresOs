"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "../../app/auth-context";
import { resolveWorkspaceForUser } from "../../lib/resolve-workspace-for-user";
import { WorkspaceRouteShell } from "./workspace-route-shell";

/** Wraps shared routes (tasks, projects, community) with the correct workspace side panel. */
export function ContextualWorkspaceLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const workspace = useMemo(
    () => resolveWorkspaceForUser(pathname, auth.roleKeys),
    [pathname, auth.roleKeys]
  );

  if (!workspace || workspace === "admin" || workspace === "client") {
    return <>{children}</>;
  }

  return <WorkspaceRouteShell workspace={workspace}>{children}</WorkspaceRouteShell>;
}
