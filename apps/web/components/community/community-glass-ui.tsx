"use client";

import type { ReactNode } from "react";
import { communityGlass } from "./community-glass-theme";

const DROPLETS = [
  { className: "community-droplet community-droplet-a left-[5%] top-[10%] h-32 w-32" },
  { className: "community-droplet community-droplet-b left-[76%] top-[6%] h-40 w-40" },
  { className: "community-droplet community-droplet-c left-[42%] top-[52%] h-24 w-24" },
  { className: "community-droplet community-droplet-d left-[90%] top-[38%] h-20 w-20" },
  { className: "community-droplet community-droplet-e left-[12%] top-[70%] h-36 w-36" },
  { className: "community-droplet community-droplet-f left-[58%] top-[18%] h-16 w-16" },
  { className: "community-droplet community-droplet-clear community-droplet-g left-[28%] top-[28%] h-14 w-14" },
  { className: "community-droplet community-droplet-clear community-droplet-h left-[68%] top-[72%] h-12 w-12" },
  { className: "community-droplet community-droplet-clear community-droplet-i left-[48%] top-[82%] h-10 w-10" },
  { className: "community-droplet community-droplet-clear community-droplet-j left-[82%] top-[58%] h-8 w-8" }
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
