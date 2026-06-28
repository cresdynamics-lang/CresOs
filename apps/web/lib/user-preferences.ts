import type { ThemeMode } from "./theme-provider";

export type FontSizePref = "small" | "medium" | "large" | "extra-large";
export type ProfileVisibility = "all" | "team" | "none";

export type UserPreferences = {
  theme: ThemeMode;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    desktop: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    showLastSeen: boolean;
    allowDirectMessages: boolean;
    profileVisibility: ProfileVisibility;
  };
  accessibility: {
    fontSize: FontSizePref;
    highContrast: boolean;
    reduceMotion: boolean;
    screenReader: boolean;
  };
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "dark",
  language: "en",
  timezone: "Africa/Nairobi",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  notifications: {
    email: true,
    push: true,
    sms: false,
    desktop: true
  },
  privacy: {
    showOnlineStatus: true,
    showLastSeen: false,
    allowDirectMessages: true,
    profileVisibility: "all"
  },
  accessibility: {
    fontSize: "medium",
    highContrast: false,
    reduceMotion: false,
    screenReader: false
  }
};

const TIMEZONE_OPTIONS = [
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC"
] as const;

export function getTimezoneOptions(): readonly string[] {
  return TIMEZONE_OPTIONS;
}

export function detectBrowserTimezone(): string {
  if (typeof Intl === "undefined") return DEFAULT_USER_PREFERENCES.timezone;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === "string" ? tz : DEFAULT_USER_PREFERENCES.timezone;
  } catch {
    return DEFAULT_USER_PREFERENCES.timezone;
  }
}

export function detectBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.split("-")[0]?.toLowerCase();
  return lang === "sw" ? "sw" : "en";
}

export function browserPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function browserPrefersColorScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

/** Merge API / partial payload into a full preferences object. */
export function normalizeUserPreferences(raw: unknown): UserPreferences {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const n =
    o.notifications && typeof o.notifications === "object" && !Array.isArray(o.notifications)
      ? (o.notifications as Record<string, unknown>)
      : {};
  const p =
    o.privacy && typeof o.privacy === "object" && !Array.isArray(o.privacy)
      ? (o.privacy as Record<string, unknown>)
      : {};
  const a =
    o.accessibility && typeof o.accessibility === "object" && !Array.isArray(o.accessibility)
      ? (o.accessibility as Record<string, unknown>)
      : {};

  const themeRaw = asString(o.theme, DEFAULT_USER_PREFERENCES.theme);
  const theme: ThemeMode =
    themeRaw === "light" || themeRaw === "dark" || themeRaw === "auto" ? themeRaw : "dark";

  const fontSizeRaw = asString(a.fontSize, DEFAULT_USER_PREFERENCES.accessibility.fontSize);
  const fontSize: FontSizePref =
    fontSizeRaw === "small" ||
    fontSizeRaw === "medium" ||
    fontSizeRaw === "large" ||
    fontSizeRaw === "extra-large"
      ? fontSizeRaw
      : "medium";

  const visibilityRaw = asString(p.profileVisibility, DEFAULT_USER_PREFERENCES.privacy.profileVisibility);
  const profileVisibility: ProfileVisibility =
    visibilityRaw === "team" || visibilityRaw === "none" ? visibilityRaw : "all";

  const timeFormatRaw = asString(o.timeFormat, DEFAULT_USER_PREFERENCES.timeFormat);
  const timeFormat: "12h" | "24h" = timeFormatRaw === "12h" ? "12h" : "24h";

  return {
    theme,
    language: asString(o.language, DEFAULT_USER_PREFERENCES.language),
    timezone: asString(o.timezone, DEFAULT_USER_PREFERENCES.timezone),
    dateFormat: asString(o.dateFormat, DEFAULT_USER_PREFERENCES.dateFormat),
    timeFormat,
    notifications: {
      email: asBool(n.email, DEFAULT_USER_PREFERENCES.notifications.email),
      push: asBool(n.push, DEFAULT_USER_PREFERENCES.notifications.push),
      sms: asBool(n.sms, DEFAULT_USER_PREFERENCES.notifications.sms),
      desktop: asBool(n.desktop, DEFAULT_USER_PREFERENCES.notifications.desktop)
    },
    privacy: {
      showOnlineStatus: asBool(p.showOnlineStatus, DEFAULT_USER_PREFERENCES.privacy.showOnlineStatus),
      showLastSeen: asBool(p.showLastSeen, DEFAULT_USER_PREFERENCES.privacy.showLastSeen),
      allowDirectMessages: asBool(p.allowDirectMessages, DEFAULT_USER_PREFERENCES.privacy.allowDirectMessages),
      profileVisibility
    },
    accessibility: {
      fontSize,
      highContrast: asBool(a.highContrast, DEFAULT_USER_PREFERENCES.accessibility.highContrast),
      reduceMotion: asBool(a.reduceMotion, DEFAULT_USER_PREFERENCES.accessibility.reduceMotion),
      screenReader: asBool(a.screenReader, DEFAULT_USER_PREFERENCES.accessibility.screenReader)
    }
  };
}

export function preferencesSnapshot(prefs: UserPreferences): string {
  return JSON.stringify(prefs);
}

export const USER_PREFS_CHANGED_EVENT = "cresos:userPreferencesChanged";

export function dispatchPreferencesChanged(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(USER_PREFS_CHANGED_EVENT, { detail: prefs }));
}
