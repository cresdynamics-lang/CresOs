"use client";

import { DeveloperGlassCanvas } from "../../components/developer/developer-glass-ui";

export function DeveloperReportsLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <DeveloperGlassCanvas className="min-h-0 flex-1 gap-4">
      {children}
    </DeveloperGlassCanvas>
  );
}
