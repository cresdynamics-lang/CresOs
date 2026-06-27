"use client";

import { DeveloperGlassCanvas } from "../../components/developer/developer-glass-ui";

export function DeveloperReportsLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <DeveloperGlassCanvas className="min-h-[calc(100dvh-6.5rem)] max-lg:min-h-[calc(100dvh-10rem)] gap-4">
      {children}
    </DeveloperGlassCanvas>
  );
}
