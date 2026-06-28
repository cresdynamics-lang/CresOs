"use client";

import type { ReactNode } from "react";
import { LeadershipLayoutGate } from "../../components/workspace/leadership-layout-gate";

/** Wraps dashboard with director or admin workspace chrome when user is role-isolated. */
export function DashboardLayoutClient({ children }: { children: ReactNode }) {
  return <LeadershipLayoutGate>{children}</LeadershipLayoutGate>;
}
