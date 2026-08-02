"use client";

import { useNavigationHistory } from "./navigation-history";

type AppBackButtonProps = {
  /** Optional fixed fallback when no in-app history is available. */
  fallbackHref?: string;
  label?: string;
  className?: string;
  /** Icon-only (compact toolbars). */
  iconOnly?: boolean;
  /** Visual style for dark/light shells. */
  tone?: "light" | "dark" | "brand";
};

const toneClass: Record<NonNullable<AppBackButtonProps["tone"]>, string> = {
  light:
    "border-[#E5E9EF] bg-white text-[#1A1D26] hover:bg-[#F4F7F9]",
  dark:
    "border-white/15 bg-white/5 text-white hover:bg-white/10",
  brand:
    "border-brand/30 bg-brand/10 text-brand hover:bg-brand/15 hover:text-brand-dark"
};

/**
 * App-wide back control. Uses in-app navigation stack, then parent path / home.
 */
export function AppBackButton({
  fallbackHref,
  label = "Back",
  className = "",
  iconOnly = false,
  tone = "light"
}: AppBackButtonProps) {
  const { goBack } = useNavigationHistory();

  return (
    <button
      type="button"
      onClick={() => goBack(fallbackHref)}
      className={[
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border font-body font-semibold transition",
        iconOnly ? "h-9 w-9" : "h-9 px-2.5 text-xs",
        toneClass[tone],
        className
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {!iconOnly ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  );
}
