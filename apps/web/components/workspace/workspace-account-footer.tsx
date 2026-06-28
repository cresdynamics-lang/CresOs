"use client";

import Link from "next/link";
import { useAuth } from "../../app/auth-context";
import { getDisplayFirstName } from "../../lib/personalized-greeting";

type ThemeKey = "finance" | "sales" | "developer" | "director" | "admin" | "client" | "hr" | "global";

const ACCENT: Record<ThemeKey, { ring: string; avatar: string; signOut: string }> = {
  finance: {
    ring: "ring-emerald-500/20",
    avatar: "bg-emerald-500/15 text-emerald-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  sales: {
    ring: "ring-amber-500/20",
    avatar: "bg-amber-500/15 text-amber-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  developer: {
    ring: "ring-violet-500/20",
    avatar: "bg-violet-500/15 text-violet-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  director: {
    ring: "ring-sky-500/20",
    avatar: "bg-sky-500/15 text-sky-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  admin: {
    ring: "ring-sky-500/20",
    avatar: "bg-sky-500/15 text-sky-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  client: {
    ring: "ring-teal-500/20",
    avatar: "bg-teal-500/15 text-teal-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  hr: {
    ring: "ring-rose-500/20",
    avatar: "bg-rose-500/15 text-rose-300",
    signOut: "border-white/[0.06] text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  },
  global: {
    ring: "ring-brand/20",
    avatar: "bg-brand/15 text-brand",
    signOut: "border-slate-700 text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-200"
  }
};

type WorkspaceAccountFooterProps = {
  themeKey?: ThemeKey;
  onLogout: () => void;
  /** Show link to full account page (default true). */
  showAccountLink?: boolean;
  /** Show name/email identity card (default false — dashboards greet the user). */
  showIdentity?: boolean;
};

export function WorkspaceAccountFooter({
  themeKey = "global",
  onLogout,
  showAccountLink = true,
  showIdentity = false
}: WorkspaceAccountFooterProps) {
  const { auth } = useAuth();
  const accent = ACCENT[themeKey] ?? ACCENT.global;
  const firstName = getDisplayFirstName(auth.userName, auth.userEmail);
  const initial = (firstName.charAt(0) || auth.userEmail?.charAt(0) || "U").toUpperCase();
  const email = auth.userEmail?.trim() || "";

  return (
    <div className="flex flex-col gap-2 px-1">
      {showIdentity ? (
        <div
          className={`flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-2.5 ring-1 ${accent.ring}`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${accent.avatar}`}
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{firstName}</p>
            {email ? <p className="truncate text-[11px] text-slate-500">{email}</p> : null}
          </div>
        </div>
      ) : null}

      {showAccountLink ? (
        <Link
          href="/settings/account"
          className="flex min-h-[40px] items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-200"
        >
          <SettingsIcon />
          Account settings
        </Link>
      ) : null}

      <button
        type="button"
        onClick={onLogout}
        className={`flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors touch-manipulation ${accent.signOut}`}
      >
        <SignOutIcon />
        Sign out
      </button>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}
