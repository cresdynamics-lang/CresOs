export const NAIROBI_TZ = "Africa/Nairobi";

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: NAIROBI_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
};

/** Format an occasion timestamp in Nairobi local time (EAT). */
export function formatNairobiDateTime(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", { ...DEFAULT_OPTS, ...options });
}

export function formatNairobiDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", {
    timeZone: NAIROBI_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/** Live Nairobi clock label — updates when called on an interval. */
export function formatNairobiNow(): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: NAIROBI_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(new Date());
}

/** For `<input type="datetime-local">` — wall time in Nairobi (EAT, UTC+3). */
export function toNairobiDatetimeLocalValue(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

/** Parse datetime-local value as Nairobi wall time → UTC ISO string. */
export function nairobiDatetimeLocalToIso(local: string): string {
  if (!local.trim()) return new Date().toISOString();
  const normalized = local.length === 16 ? `${local}:00` : local;
  return new Date(`${normalized}+03:00`).toISOString();
}
