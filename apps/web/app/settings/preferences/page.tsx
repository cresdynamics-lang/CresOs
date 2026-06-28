"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth-context";
import { useTheme, type ThemeMode } from "../../../lib/theme-provider";
import {
  applyUserPreferencesToDocument,
  getDesktopNotificationState,
  requestDesktopNotificationPermission,
  type NotificationPermissionState
} from "../../../lib/apply-user-preferences";
import {
  DEFAULT_USER_PREFERENCES,
  detectBrowserLanguage,
  detectBrowserTimezone,
  dispatchPreferencesChanged,
  getTimezoneOptions,
  normalizeUserPreferences,
  preferencesSnapshot,
  type UserPreferences
} from "../../../lib/user-preferences";
import {
  SettingsField,
  SettingsFormGrid,
  SettingsPage,
  SettingsPanel,
  SettingsSaveBar,
  SettingsSection,
  SettingsToggle,
  useSettingsTheme
} from "../../../components/settings/settings-primitives";

function ThemeChoice({
  mode,
  selected,
  resolved,
  onSelect
}: {
  mode: ThemeMode;
  selected: ThemeMode;
  resolved: "dark" | "light";
  onSelect: (m: ThemeMode) => void;
}) {
  const themeTokens = useSettingsTheme();
  const active = selected === mode;
  const hint =
    mode === "auto"
      ? `Matches device (${resolved})`
      : mode === "dark"
        ? "Dark surfaces"
        : "Light surfaces";

  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      aria-pressed={active}
      className={`flex min-w-[5.5rem] flex-col items-center gap-1 rounded-xl px-4 py-3 text-sm capitalize transition-all ${
        active ? themeTokens.navActive : themeTokens.navIdle
      }`}
    >
      <span className="font-semibold">{mode}</span>
      <span className="text-[10px] font-normal normal-case text-slate-500">{hint}</span>
    </button>
  );
}

function desktopStatusLabel(state: NotificationPermissionState): string {
  if (state === "unsupported") return "Not supported in this browser";
  if (state === "granted") return "Browser permission granted";
  if (state === "denied") return "Blocked in browser — enable in site settings";
  return "Permission not requested yet";
}

export default function PreferencesPage() {
  const { apiFetch } = useAuth();
  const { resolved, setTheme } = useTheme();
  const themeTokens = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [savedSnap, setSavedSnap] = useState(preferencesSnapshot(DEFAULT_USER_PREFERENCES));
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermissionState>("default");
  const [browserTz] = useState(() => detectBrowserTimezone());
  const [browserLang] = useState(() => detectBrowserLanguage());

  const timezoneOptions = useMemo(() => {
    const base = [...getTimezoneOptions()];
    if (browserTz && !base.includes(browserTz)) base.unshift(browserTz);
    return base;
  }, [browserTz]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/user/preferences");
      if (res.ok) {
        const data = (await res.json()) as { data?: unknown };
        const merged = normalizeUserPreferences(data.data ?? DEFAULT_USER_PREFERENCES);
        const perm = getDesktopNotificationState();
        const withDesktop =
          perm !== "granted"
            ? { ...merged, notifications: { ...merged.notifications, desktop: false } }
            : merged;
        setPrefs(withDesktop);
        setSavedSnap(preferencesSnapshot(withDesktop));
        setTheme(withDesktop.theme);
        applyUserPreferencesToDocument(withDesktop);
      }
    } catch {
      setError("Could not load preferences.");
    } finally {
      setLoading(false);
      setDesktopPerm(getDesktopNotificationState());
    }
  }, [apiFetch, setTheme]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => preferencesSnapshot(prefs) !== savedSnap, [prefs, savedSnap]);

  const patch = useCallback((updater: (p: UserPreferences) => UserPreferences) => {
    setSuccess(null);
    setError(null);
    setPrefs(updater);
  }, []);

  const persist = useCallback(
    async (next: UserPreferences, opts?: { silent?: boolean }) => {
      setSaving(true);
      if (!opts?.silent) {
        setSuccess(null);
        setError(null);
      }
      try {
        const res = await apiFetch("/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next)
        });
        if (res.ok) {
          const normalized = normalizeUserPreferences(next);
          setPrefs(normalized);
          setSavedSnap(preferencesSnapshot(normalized));
          applyUserPreferencesToDocument(normalized);
          dispatchPreferencesChanged(normalized);
          if (!opts?.silent) setSuccess("Preferences saved.");
          return true;
        }
        if (!opts?.silent) setError("Could not save preferences.");
        return false;
      } catch {
        if (!opts?.silent) setError("Network error.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [apiFetch]
  );

  const applyTheme = async (mode: ThemeMode) => {
    setTheme(mode);
    setPrefs((p) => ({ ...p, theme: mode }));
    try {
      const res = await apiFetch("/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: mode })
      });
      if (res.ok) {
        const saved = normalizeUserPreferences(JSON.parse(savedSnap));
        const synced = { ...saved, theme: mode };
        setSavedSnap(preferencesSnapshot(synced));
        applyUserPreferencesToDocument({ ...prefs, theme: mode });
        dispatchPreferencesChanged({ ...prefs, theme: mode });
      }
    } catch {
      /* theme still applied locally */
    }
  };

  const useBrowserTimezone = () => {
    patch((p) => ({ ...p, timezone: browserTz }));
  };

  const useBrowserLanguage = () => {
    patch((p) => ({ ...p, language: browserLang }));
  };

  const onDesktopToggle = async (enabled: boolean) => {
    if (!enabled) {
      patch((p) => ({ ...p, notifications: { ...p.notifications, desktop: false } }));
      return;
    }
    const perm = await requestDesktopNotificationPermission();
    setDesktopPerm(perm);
    if (perm === "granted") {
      patch((p) => ({ ...p, notifications: { ...p.notifications, desktop: true } }));
    } else {
      patch((p) => ({ ...p, notifications: { ...p.notifications, desktop: false } }));
      setError(
        perm === "denied"
          ? "Desktop notifications are blocked in your browser."
          : "Desktop notification permission was not granted."
      );
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading preferences…</p>
      </div>
    );
  }

  return (
    <SettingsPage className="pb-4">
      <SettingsPanel>
        <SettingsSection
          label="Display"
          title="Appearance"
          description="Theme applies immediately and syncs to your account."
        >
          <SettingsField label="Theme" hint="Applies immediately when selected. Auto follows your device.">
            <div className="flex flex-wrap gap-2">
              {(["dark", "light", "auto"] as ThemeMode[]).map((mode) => (
                <ThemeChoice
                  key={mode}
                  mode={mode}
                  selected={prefs.theme}
                  resolved={resolved}
                  onSelect={applyTheme}
                />
              ))}
            </div>
          </SettingsField>
          <SettingsFormGrid className="mt-6">
            <SettingsField label="Language" hint={`Browser: ${browserLang === "sw" ? "Swahili" : "English"}`}>
              <div className="flex flex-col gap-2">
                <select
                  value={prefs.language}
                  onChange={(e) => patch((p) => ({ ...p, language: e.target.value }))}
                  className={themeTokens.input}
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                </select>
                <button type="button" onClick={useBrowserLanguage} className={`self-start text-xs ${themeTokens.accentText}`}>
                  Use browser language
                </button>
              </div>
            </SettingsField>
            <SettingsField label="Timezone" hint={`Device: ${browserTz}`}>
              <div className="flex flex-col gap-2">
                <select
                  value={prefs.timezone}
                  onChange={(e) => patch((p) => ({ ...p, timezone: e.target.value }))}
                  className={themeTokens.input}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                      {tz === browserTz ? " (this device)" : ""}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={useBrowserTimezone} className={`self-start text-xs ${themeTokens.accentText}`}>
                  Use device timezone
                </button>
              </div>
            </SettingsField>
            <SettingsField label="Date format">
              <select
                value={prefs.dateFormat}
                onChange={(e) => patch((p) => ({ ...p, dateFormat: e.target.value }))}
                className={themeTokens.input}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </SettingsField>
            <SettingsField label="Time format">
              <select
                value={prefs.timeFormat}
                onChange={(e) =>
                  patch((p) => ({ ...p, timeFormat: e.target.value === "12h" ? "12h" : "24h" }))
                }
                className={themeTokens.input}
              >
                <option value="24h">24-hour</option>
                <option value="12h">12-hour</option>
              </select>
            </SettingsField>
          </SettingsFormGrid>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection
          label="Channels"
          title="Notifications"
          description="Channel preferences stored on your profile. Desktop uses browser permission."
        >
          <div className="max-w-3xl divide-y divide-white/[0.06]">
            <div className="py-3 first:pt-0">
              <SettingsToggle
                label="Email notifications"
                description="Receive notifications via email to your notification address."
                on={prefs.notifications.email}
                onChange={(email) => patch((p) => ({ ...p, notifications: { ...p.notifications, email } }))}
              />
            </div>
            <div className="py-3">
              <SettingsToggle
                label="Push notifications"
                description="Mobile and web push when supported by your device."
                on={prefs.notifications.push}
                onChange={(push) => patch((p) => ({ ...p, notifications: { ...p.notifications, push } }))}
              />
            </div>
            <div className="py-3">
              <SettingsToggle
                label="SMS notifications"
                description="Text messages for urgent alerts (when enabled for your org)."
                on={prefs.notifications.sms}
                onChange={(sms) => patch((p) => ({ ...p, notifications: { ...p.notifications, sms } }))}
              />
            </div>
            <div className="py-3">
              <SettingsToggle
                label="Desktop notifications"
                description={desktopStatusLabel(desktopPerm)}
                on={prefs.notifications.desktop}
                onChange={(v) => void onDesktopToggle(v)}
                disabled={desktopPerm === "unsupported"}
              />
            </div>
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection label="Visibility" title="Privacy" description="Control how others see you in the workspace.">
          <div className="max-w-3xl divide-y divide-white/[0.06]">
            <div className="py-3 first:pt-0">
              <SettingsToggle
                label="Show online status"
                description="Let others see when you're online."
                on={prefs.privacy.showOnlineStatus}
                onChange={(showOnlineStatus) =>
                  patch((p) => ({ ...p, privacy: { ...p.privacy, showOnlineStatus } }))
                }
              />
            </div>
            <div className="py-3">
              <SettingsToggle
                label="Show last seen"
                description="Let others see when you were last active."
                on={prefs.privacy.showLastSeen}
                onChange={(showLastSeen) =>
                  patch((p) => ({ ...p, privacy: { ...p.privacy, showLastSeen } }))
                }
              />
            </div>
            <div className="py-3">
              <SettingsToggle
                label="Allow direct messages"
                description="Let others send you direct messages."
                on={prefs.privacy.allowDirectMessages}
                onChange={(allowDirectMessages) =>
                  patch((p) => ({ ...p, privacy: { ...p.privacy, allowDirectMessages } }))
                }
              />
            </div>
            <div className="py-3">
              <SettingsField label="Profile visibility">
                <select
                  value={prefs.privacy.profileVisibility}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      privacy: {
                        ...p.privacy,
                        profileVisibility:
                          e.target.value === "team" || e.target.value === "none" ? e.target.value : "all"
                      }
                    }))
                  }
                  className={themeTokens.input}
                >
                  <option value="all">Everyone in the org</option>
                  <option value="team">Team members only</option>
                  <option value="none">Only me</option>
                </select>
              </SettingsField>
            </div>
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection
          label="Comfort"
          title="Accessibility"
          description="Adjust display for comfort and assistive needs."
        >
          <div className="max-w-3xl space-y-4">
            <SettingsField label="Font size">
              <select
                value={prefs.accessibility.fontSize}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    accessibility: {
                      ...p.accessibility,
                      fontSize:
                        e.target.value === "small" ||
                        e.target.value === "large" ||
                        e.target.value === "extra-large"
                          ? e.target.value
                          : "medium"
                    }
                  }))
                }
                className={themeTokens.input}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="extra-large">Extra large</option>
              </select>
            </SettingsField>
            <SettingsToggle
              label="High contrast"
              description="Increase contrast for better visibility."
              on={prefs.accessibility.highContrast}
              onChange={(highContrast) =>
                patch((p) => ({ ...p, accessibility: { ...p.accessibility, highContrast } }))
              }
            />
            <SettingsToggle
              label="Reduce motion"
              description="Reduce animations and transitions across the app."
              on={prefs.accessibility.reduceMotion}
              onChange={(reduceMotion) =>
                patch((p) => ({ ...p, accessibility: { ...p.accessibility, reduceMotion } }))
              }
            />
            <SettingsToggle
              label="Screen reader support"
              description="Stronger focus rings and larger touch targets."
              on={prefs.accessibility.screenReader}
              onChange={(screenReader) =>
                patch((p) => ({ ...p, accessibility: { ...p.accessibility, screenReader } }))
              }
            />
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void persist(prefs)}
        label="Save preferences"
        successMessage={success}
        errorMessage={error}
      />
    </SettingsPage>
  );
}
