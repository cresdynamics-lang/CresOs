"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../app/auth-context";
import { profileAvatarUrl } from "../../lib/profile-avatar-url";
import { getDisplayFirstName } from "../../lib/personalized-greeting";
import { useWorkspaceLogout } from "../../lib/use-workspace-logout";

type HeaderProfileMenuProps = {
  /** Optional logout override (defaults to workspace logout). */
  onLogout?: () => void;
  className?: string;
};

export function HeaderProfileMenu({ onLogout, className = "" }: HeaderProfileMenuProps) {
  const { auth } = useAuth();
  const defaultLogout = useWorkspaceLogout();
  const handleLogout = onLogout ?? defaultLogout;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const firstName = getDisplayFirstName(auth.userName, auth.userEmail);
  const email = auth.userEmail?.trim() || "";
  const initial = (firstName.charAt(0) || email.charAt(0) || "U").toUpperCase();
  const avatarSrc = profileAvatarUrl(auth.profilePicture);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#E5E9EF] bg-[#2D5A5A] font-label text-sm font-bold text-white shadow-sm ring-2 ring-white hover:ring-[#2D5A5A]/30 focus:outline-none focus:ring-2 focus:ring-[#2D5A5A]/40"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        title={email || firstName}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#E5E9EF] bg-white shadow-[0_8px_24px_rgba(28,31,46,0.12)]"
        >
          <div className="border-b border-[#E5E9EF] px-3 py-3">
            <p className="truncate font-body text-sm font-semibold text-[#1A1D26]">{firstName}</p>
            {email ? <p className="mt-0.5 truncate font-body text-xs text-[#5B6472]">{email}</p> : null}
          </div>
          <div className="p-1.5">
            <Link
              href="/settings/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-body text-sm font-semibold text-[#1A1D26] hover:bg-[#F4F7F9]"
            >
              <SettingsIcon />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 font-body text-sm font-semibold text-[#C62828] hover:bg-[#FEF2F2]"
            >
              <SignOutIcon />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#5B6472]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}
