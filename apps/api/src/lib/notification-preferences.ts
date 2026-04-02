import { NOTIFICATION_TIERS } from "../modules/role-notifications";

export type NotificationPreferences = {
  /** Tier keys from NOTIFICATION_TIERS — hidden from bell & unseen count */
  mutedTiers?: string[];
  /** When true, no in-app items shown and badge stays at 0 */
  muteAllInApp?: boolean;
};

const VALID_TIERS = new Set<string>(Object.values(NOTIFICATION_TIERS));

export function parseNotificationPreferences(raw: unknown): Required<NotificationPreferences> {
  if (!raw || typeof raw !== "object") {
    return { mutedTiers: [], muteAllInApp: false };
  }
  const o = raw as Record<string, unknown>;
  const muted = Array.isArray(o.mutedTiers)
    ? o.mutedTiers.filter((t): t is string => typeof t === "string" && VALID_TIERS.has(t))
    : [];
  return {
    mutedTiers: [...new Set(muted)],
    muteAllInApp: Boolean(o.muteAllInApp)
  };
}

export function mergeNotificationPreferences(
  current: unknown,
  patch: NotificationPreferences
): Required<NotificationPreferences> {
  const base = parseNotificationPreferences(current);
  return {
    muteAllInApp: patch.muteAllInApp !== undefined ? Boolean(patch.muteAllInApp) : base.muteAllInApp,
    mutedTiers: patch.mutedTiers !== undefined ? parseNotificationPreferences({ mutedTiers: patch.mutedTiers }).mutedTiers : base.mutedTiers
  };
}
