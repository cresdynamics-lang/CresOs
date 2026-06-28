"use client";

import { CommunityGlassCanvas } from "../../components/community/community-glass-ui";

export function CommunityLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <CommunityGlassCanvas className="flex-1 overflow-hidden p-0">
      {children}
    </CommunityGlassCanvas>
  );
}
