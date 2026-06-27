"use client";

import type { ReactNode } from "react";
import { devGlass } from "./developer-glass-theme";

export function DeveloperGlassCanvas({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${devGlass.workspace} ${devGlass.canvas} flex flex-col gap-6 ${className}`.trim()}>
      <div className={devGlass.canvasGlow} aria-hidden />
      <div className={devGlass.content}>{children}</div>
    </div>
  );
}

export function DevGlassPanel({
  children,
  className = "",
  inset = false
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div className={`${inset ? devGlass.panelInset : devGlass.shell} ${className}`.trim()}>{children}</div>
  );
}

export { devGlass };
