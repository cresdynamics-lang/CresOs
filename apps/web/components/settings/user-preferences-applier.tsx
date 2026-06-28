"use client";

import { useCallback, useEffect } from "react";
import { useAuth } from "../../app/auth-context";
import { applyUserPreferencesToDocument } from "../../lib/apply-user-preferences";
import {
  DEFAULT_USER_PREFERENCES,
  dispatchPreferencesChanged,
  normalizeUserPreferences,
  USER_PREFS_CHANGED_EVENT,
  type UserPreferences
} from "../../lib/user-preferences";
import { useTheme } from "../../lib/theme-provider";

/** Load saved UI preferences after login and apply to the document. */
export function UserPreferencesApplier() {
  const { apiFetch, auth, hydrated } = useAuth();
  const { setTheme } = useTheme();

  const apply = useCallback(
    (prefs: UserPreferences) => {
      if (prefs.theme === "light" || prefs.theme === "dark" || prefs.theme === "auto") {
        setTheme(prefs.theme);
      }
      applyUserPreferencesToDocument(prefs);
    },
    [setTheme]
  );

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/user/preferences");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { data?: unknown };
        const prefs = normalizeUserPreferences(data.data ?? DEFAULT_USER_PREFERENCES);
        apply(prefs);
        dispatchPreferencesChanged(prefs);
      } catch {
        apply(DEFAULT_USER_PREFERENCES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, auth.accessToken, apiFetch, apply]);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<UserPreferences>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener(USER_PREFS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(USER_PREFS_CHANGED_EVENT, onChanged);
  }, [apply]);

  return null;
}
