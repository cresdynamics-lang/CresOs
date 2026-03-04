/**
 * Browser notifications that ring: request permission, show system notification, play a short sound.
 */

const NOTIFICATION_SOUND_DURATION_MS = 300;
const NOTIFICATION_SOUND_FREQ = 880;

function playNotifySound(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = NOTIFICATION_SOUND_FREQ;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + NOTIFICATION_SOUND_DURATION_MS / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + NOTIFICATION_SOUND_DURATION_MS / 1000);
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const perm = await Notification.requestPermission();
  return perm;
}

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

/**
 * Show a system notification and play a short sound so reminders "ring".
 * tag: optional, avoids duplicate windows with the same tag.
 */
export function notify(title: string, options?: { body?: string; tag?: string; playSound?: boolean }): void {
  if (!canNotify()) return;
  const { body, tag, playSound = true } = options ?? {};
  try {
    if (playSound) playNotifySound();
    new Notification(title, {
      body: body ?? "",
      tag: tag ?? undefined,
      icon: typeof window !== "undefined" && window.location.origin ? `${window.location.origin}/favicon.ico` : undefined
    });
  } catch {
    // ignore
  }
}
