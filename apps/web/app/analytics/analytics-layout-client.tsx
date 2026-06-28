"use client";

import type { ReactNode } from "react";
import { LeadershipLayoutGate } from "../../components/workspace/leadership-layout-gate";

export function AnalyticsLayoutClient({ children }: { children: ReactNode }) {
  return <LeadershipLayoutGate>{children}</LeadershipLayoutGate>;
}
