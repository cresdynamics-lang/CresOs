import type { UserPreferences } from "./user-preferences";

const FONT_CLASSES = ["user-font-small", "user-font-medium", "user-font-large", "user-font-extra-large"] as const;

/** Apply visual + document preferences (theme is handled by ThemeProvider). */
export function applyUserPreferencesToDocument(prefs: UserPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.lang = prefs.language === "sw" ? "sw" : "en";
  root.dataset.timezone = prefs.timezone;
  root.dataset.dateFormat = prefs.dateFormat;
  root.dataset.timeFormat = prefs.timeFormat;

  root.classList.toggle("user-reduce-motion", prefs.accessibility.reduceMotion);
  root.classList.toggle("user-high-contrast", prefs.accessibility.highContrast);
  root.classList.toggle("user-screen-reader", prefs.accessibility.screenReader);

  for (const cls of FONT_CLASSES) root.classList.remove(cls);
  root.classList.add(`user-font-${prefs.accessibility.fontSize}`);
}

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function getDesktopNotificationState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Request browser permission when user enables desktop notifications. */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}
