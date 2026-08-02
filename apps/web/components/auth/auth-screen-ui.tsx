"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/** Shared modern “screen glass” shell for login / register. */
export function AuthScreenShell({
  children,
  backHref = "/",
  backLabel = "← Back to home"
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-[#1A1D26]">
      {/* Atmospheric background “screen” */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[#E8EEF2]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_-10%,rgba(45,90,90,0.18),transparent_55%),radial-gradient(ellipse_70%_50%_at_90%_10%,rgba(45,90,90,0.12),transparent_50%),radial-gradient(ellipse_60%_45%_at_50%_100%,rgba(28,31,46,0.06),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }}
        />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#2D5A5A]/15 blur-3xl" />
        <div className="absolute -right-16 bottom-16 h-80 w-80 rounded-full bg-[#2D5A5A]/10 blur-3xl" />
      </div>

      <header className="relative z-[1] border-b border-white/40 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href={backHref}
            className="text-sm font-medium text-[#5B6472] transition-colors hover:text-[#1A1D26]"
          >
            {backLabel}
          </Link>
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold text-[#1A1D26]">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/70 shadow-sm backdrop-blur-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LOGO.jpg" width={32} height={32} alt="" className="h-7 w-7 rounded-lg" />
            </span>
            CresOS
          </Link>
        </div>
      </header>

      <main className="relative z-[1] flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}

export function AuthScreenCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white/55 p-6 shadow-[0_8px_40px_rgba(28,31,46,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl sm:p-8">
      <div
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
        aria-hidden
      />
      {children}
    </div>
  );
}

export const authScreenField =
  "w-full rounded-xl border border-[#E5E9EF]/90 bg-white/70 px-3.5 py-2.5 text-sm text-[#1A1D26] placeholder:text-[#8B93A1] shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none backdrop-blur-md transition-all focus:border-[#2D5A5A]/50 focus:bg-white/90 focus:ring-2 focus:ring-[#2D5A5A]/15";

export const authScreenButton =
  "mt-1 inline-flex w-full items-center justify-center rounded-xl bg-[#2D5A5A]/95 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(45,90,90,0.25)] backdrop-blur-sm transition-all hover:bg-[#244848] hover:shadow-[0_10px_28px_rgba(45,90,90,0.3)] disabled:pointer-events-none disabled:opacity-55";

export const authScreenLabel =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#5B6472]";
