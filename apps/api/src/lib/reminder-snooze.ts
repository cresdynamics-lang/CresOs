const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export type SnoozeParseResult = {
  until: Date;
  label: string;
};

function addMs(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

function nextWeekday(from: Date, targetDow: number): Date {
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  const current = d.getDay();
  let delta = (targetDow - current + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function startOfTomorrow(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Parse natural-language snooze phrases (e.g. "remind me in 5 minutes", "tomorrow", "monday").
 */
export function parseReminderSnoozePhrase(phrase: string, now = new Date()): SnoozeParseResult | null {
  const raw = phrase.trim().toLowerCase();
  if (!raw) return null;

  const normalized = raw
    .replace(/^remind\s+me\s+(?:in\s+|again\s+in\s+|at\s+)?/i, "")
    .replace(/^snooze\s+(?:for\s+)?/i, "")
    .trim();

  const minuteMatch = normalized.match(/^(\d+)\s*(?:min(?:ute)?s?|m)\b/);
  if (minuteMatch) {
    const mins = Number(minuteMatch[1]);
    if (mins > 0 && mins <= 24 * 60) {
      return { until: addMs(now, mins * 60_000), label: `in ${mins} minute${mins === 1 ? "" : "s"}` };
    }
  }

  const hourMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) {
    const hrs = Number(hourMatch[1]);
    if (hrs > 0 && hrs <= 168) {
      const ms = Math.round(hrs * 60 * 60_000);
      return { until: addMs(now, ms), label: `in ${hrs} hour${hrs === 1 ? "" : "s"}` };
    }
  }

  if (/^tomorrow\b/.test(normalized) || normalized === "tmrw") {
    return { until: startOfTomorrow(now), label: "tomorrow morning" };
  }

  for (let i = 0; i < WEEKDAYS.length; i++) {
    const day = WEEKDAYS[i];
    if (normalized === day || normalized.startsWith(`${day} `) || normalized.endsWith(` ${day}`)) {
      const until = nextWeekday(now, i);
      const label = until.getTime() - now.getTime() < 36 * 60 * 60_000 ? `later today` : `on ${day.charAt(0).toUpperCase()}${day.slice(1)}`;
      return {
        until,
        label: normalized.includes("next") ? `next ${day}` : until.getDate() === now.getDate() + 1 && i === (now.getDay() + 1) % 7 ? `tomorrow (${day})` : `on ${day.charAt(0).toUpperCase()}${day.slice(1)}`
      };
    }
  }

  const presets: Record<string, { ms?: number; fn?: () => Date; label: string }> = {
    "5": { ms: 5 * 60_000, label: "in 5 minutes" },
    "15": { ms: 15 * 60_000, label: "in 15 minutes" },
    "20": { ms: 20 * 60_000, label: "in 20 minutes" },
    "30": { ms: 30 * 60_000, label: "in 30 minutes" },
    "1h": { ms: 60 * 60_000, label: "in 1 hour" },
    "2h": { ms: 2 * 60 * 60_000, label: "in 2 hours" },
    "5h": { ms: 5 * 60 * 60_000, label: "in 5 hours" },
    "12h": { ms: 12 * 60 * 60_000, label: "in 12 hours" }
  };

  for (const [key, p] of Object.entries(presets)) {
    if (normalized === key || normalized === `${key} min` || normalized === `${key} minutes`) {
      return { until: addMs(now, p.ms!), label: p.label };
    }
  }

  return null;
}

/** Preset snooze options for API + UI (minutes from now unless noted). */
export const SNOOZE_PRESET_OPTIONS = [
  { key: "5m", minutes: 5, label: "5 min" },
  { key: "15m", minutes: 15, label: "15 min" },
  { key: "20m", minutes: 20, label: "20 min" },
  { key: "30m", minutes: 30, label: "30 min" },
  { key: "1h", minutes: 60, label: "1 hour" },
  { key: "2h", minutes: 120, label: "2 hours" },
  { key: "5h", minutes: 300, label: "5 hours" },
  { key: "12h", minutes: 720, label: "12 hours" },
  { key: "tomorrow", special: "tomorrow" as const, label: "Tomorrow" }
] as const;

export function snoozeUntilFromPreset(
  presetKey: string,
  now = new Date()
): SnoozeParseResult | null {
  const key = presetKey.trim().toLowerCase();
  if (key === "tomorrow") {
    return { until: startOfTomorrow(now), label: "tomorrow morning" };
  }
  const opt = SNOOZE_PRESET_OPTIONS.find((o) => o.key === key);
  if (!opt || !("minutes" in opt)) return null;
  return {
    until: addMs(now, opt.minutes * 60_000),
    label: `in ${opt.label}`
  };
}
