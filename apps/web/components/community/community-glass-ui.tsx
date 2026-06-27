"use client";

import type { ReactNode } from "react";
import { communityGlass } from "./community-glass-theme";

const DROPLETS = [
  { className: "community-droplet community-droplet-a left-[8%] top-[12%] h-24 w-24" },
  { className: "community-droplet community-droplet-b left-[72%] top-[8%] h-32 w-32" },
  { className: "community-droplet community-droplet-c left-[45%] top-[55%] h-20 w-20" },
  { className: "community-droplet community-droplet-d left-[88%] top-[42%] h-16 w-16" },
  { className: "community-droplet community-droplet-e left-[18%] top-[68%] h-28 w-28" },
  { className: "community-droplet community-droplet-f left-[58%] top-[22%] h-14 w-14" }
];

export function CommunityDroplets() {
  return (
    <div className={`${communityGlass.droplets} pointer-events-none absolute inset-0 overflow-hidden`} aria-hidden>
      {DROPLETS.map((d) => (
        <span key={d.className} className={d.className} />
      ))}
    </div>
  );
}

export function CommunityGlassCanvas({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${communityGlass.workspace} ${communityGlass.canvas} flex h-full min-h-0 w-full flex-1 flex-col ${className}`.trim()}
    >
      <div className={communityGlass.canvasGlow} aria-hidden />
      <CommunityDroplets />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export { communityGlass };
