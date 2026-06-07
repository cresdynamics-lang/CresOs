import { assertZonedTz, DEFAULT_ORG_DAY_TZ } from "../modules/org-zoned-day";

export { DEFAULT_ORG_DAY_TZ as NAIROBI_TZ };

export function getZonedHourMinute(
  d: Date,
  tz: string = DEFAULT_ORG_DAY_TZ
): { hour: number; minute: number } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: assertZonedTz(tz),
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = f.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/** 0 = Sunday … 6 = Saturday (Nairobi calendar day). */
export function getZonedWeekday(d: Date, tz: string = DEFAULT_ORG_DAY_TZ): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: assertZonedTz(tz),
    weekday: "short"
  }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? 0;
}

export function formatNairobiDateLabel(d: Date, tz: string = DEFAULT_ORG_DAY_TZ): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: assertZonedTz(tz),
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

export function formatNairobiTimeLabel(d: Date, tz: string = DEFAULT_ORG_DAY_TZ): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: assertZonedTz(tz),
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(d);
}

export function formatNairobiDateTime(d: Date, tz: string = DEFAULT_ORG_DAY_TZ): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: assertZonedTz(tz),
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(d);
}

export function firstNameFromUser(name: string | null | undefined, email: string): string {
  const fromName = (name ?? "").trim().split(/\s+/)[0];
  if (fromName && fromName.length >= 2) {
    return fromName.charAt(0).toUpperCase() + fromName.slice(1).toLowerCase();
  }
  const local = (email.split("@")[0] ?? "").replace(/[._+\-0-9]+/g, " ").trim().split(/\s+/)[0];
  if (local && local.length >= 2) {
    return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
  }
  return "there";
}
