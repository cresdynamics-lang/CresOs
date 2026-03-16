"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";

type Props = { onOpenAccountSettings?: () => void };

export function OnboardingPrompt({ onOpenAccountSettings }: Props) {
  const { apiFetch, auth } = useAuth();
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) {
      setProfileCompleted(true);
      return;
    }
    let cancelled = false;
    apiFetch("/account/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setProfileCompleted(Boolean(data.profileCompletedAt));
      })
      .catch(() => setProfileCompleted(true));
    return () => { cancelled = true; };
  }, [apiFetch, auth.accessToken]);

  useEffect(() => {
    function handleCompleted() {
      setProfileCompleted(true);
    }
    window.addEventListener("cresos:profileCompleted", handleCompleted);
    return () => {
      window.removeEventListener("cresos:profileCompleted", handleCompleted);
    };
  }, []);

  if (profileCompleted !== false || dismissed) return null;

  return (
    <div className="border-b border-amber-800/60 bg-amber-950/40 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-amber-200">
          Complete your profile so we can send you notifications (meetings, reminders, alerts). It only takes a minute.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAccountSettings}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
          >
            Add my details
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
