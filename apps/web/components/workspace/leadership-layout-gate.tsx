"use client";

import type { ReactNode } from "react";
import { useAuth } from "../../app/auth-context";
import { AdminLayoutClient } from "../../app/admin/admin-layout-client";
import { DirectorLayoutClient } from "../../app/director/director-layout-client";
import { isAdminOnly } from "../../lib/is-admin-only";
import { isDirectorOnly } from "../../lib/is-director-only";

/** Wraps children with director or admin unified workspace chrome when role is isolated. */
export function LeadershipLayoutGate({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  if (isDirectorOnly(auth.roleKeys)) {
    return <DirectorLayoutClient>{children}</DirectorLayoutClient>;
  }
  if (isAdminOnly(auth.roleKeys)) {
    return <AdminLayoutClient>{children}</AdminLayoutClient>;
  }
  return <>{children}</>;
}
