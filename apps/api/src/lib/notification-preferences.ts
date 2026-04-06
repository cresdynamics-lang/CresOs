import { NOTIFICATION_TIERS } from "../modules/role-notifications";

export type NotificationPreferences = {
  /** Tier keys from NOTIFICATION_TIERS — hidden from bell & unseen count */
  mutedTiers?: string[];
  /** When true, no in-app items shown and badge stays at 0 */
  muteAllInApp?: boolean;
  /** Optional: play a sound on incoming Community chat messages (web-only). */
  playCommunitySound?: boolean;
};

const VALID_TIERS = new Set<string>(Object.values(NOTIFICATION_TIERS));

export function parseNotificationPreferences(raw: unknown): Required<NotificationPreferences> {
  const base: Record<string, unknown> = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const muted = Array.isArray(base.mutedTiers)
    ? (base.mutedTiers as unknown[]).filter((t): t is string => typeof t === "string" && VALID_TIERS.has(t))
    : [];
  return {
    ...(base as any),
    mutedTiers: [...new Set(muted)],
    muteAllInApp: Boolean(base.muteAllInApp),
    playCommunitySound: Boolean(base.playCommunitySound)
  };
}

export function mergeNotificationPreferences(
  current: unknown,
  patch: NotificationPreferences
): Required<NotificationPreferences> {
  const base = parseNotificationPreferences(current);
  return {
    ...base,
    muteAllInApp: patch.muteAllInApp !== undefined ? Boolean(patch.muteAllInApp) : base.muteAllInApp,
    mutedTiers:
      patch.mutedTiers !== undefined
        ? parseNotificationPreferences({ ...base, mutedTiers: patch.mutedTiers }).mutedTiers
        : base.mutedTiers,
    playCommunitySound:
      patch.playCommunitySound !== undefined ? Boolean(patch.playCommunitySound) : base.playCommunitySound
  };
}
