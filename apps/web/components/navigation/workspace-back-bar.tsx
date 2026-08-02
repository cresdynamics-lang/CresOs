"use client";

import type { ReactNode } from "react";
import { AppBackButton } from "./app-back-button";

/** Compact sticky nav strip with back control for workspace content columns. */
export function WorkspaceBackBar({
  tone = "light",
  fallbackHref,
  trailing
}: {
  tone?: "light" | "dark";
  fallbackHref?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={[
        "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 sm:px-4",
        tone === "dark" ? "border-white/10 bg-transparent" : "border-[#E5E9EF] bg-white/90"
      ].join(" ")}
    >
      <AppBackButton
        tone={tone === "dark" ? "dark" : "light"}
        fallbackHref={fallbackHref}
        iconOnly={false}
      />
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
