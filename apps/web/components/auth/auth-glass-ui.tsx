"use client";

import type { ReactNode } from "react";
import { authGlass } from "./auth-glass-theme";

const DROPLETS = [
  { className: "auth-droplet auth-droplet-a left-[6%] top-[14%] h-28 w-28" },
  { className: "auth-droplet auth-droplet-b left-[78%] top-[6%] h-36 w-36" },
  { className: "auth-droplet auth-droplet-c left-[42%] top-[58%] h-20 w-20" },
  { className: "auth-droplet auth-droplet-d left-[92%] top-[38%] h-16 w-16" },
  { className: "auth-droplet auth-droplet-e left-[14%] top-[72%] h-32 w-32" },
  { className: "auth-droplet auth-droplet-f left-[62%] top-[18%] h-16 w-16" },
  { className: "auth-droplet auth-droplet-g left-[28%] top-[32%] h-12 w-12" },
  { className: "auth-droplet auth-droplet-h left-[52%] top-[82%] h-20 w-20" }
];

export function AuthDroplets() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {DROPLETS.map((d) => (
        <span key={d.className} className={d.className} />
      ))}
    </div>
  );
}

export function AuthGlassCanvas({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${authGlass.workspace} ${authGlass.canvas} flex flex-col ${className}`.trim()}>
      <div className={authGlass.canvasGlow} aria-hidden />
      <AuthDroplets />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function AuthGlassCard({ children }: { children: ReactNode }) {
  return (
    <div className={`relative ${authGlass.card}`}>
      <div className={authGlass.cardShine} aria-hidden />
      {children}
    </div>
  );
}

export { authGlass };
