import type { PrismaClient } from "@prisma/client";

/** Same default as daily ops / director briefing (Africa/Nairobi). */
export const DEFAULT_ORG_DAY_TZ = process.env.DAILY_OPS_TZ?.trim() || "Africa/Nairobi";

export function assertDateKey(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid dateKey");
  return s;
}

export function assertZonedTz(tz: string): string {
  if (!/^[A-Za-z0-9/_+-]+$/.test(tz)) throw new Error("Invalid timezone");
  return tz;
}

export function getZonedDateKey(d: Date, tz: string = DEFAULT_ORG_DAY_TZ): string {
  const t = assertZonedTz(tz);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: t,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return assertDateKey(f.format(d));
}

function addCalendarDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return assertDateKey(dt.toISOString().slice(0, 10));
}

/** UTC bounds for one calendar day in `tz` (e.g. Africa/Nairobi). */
export async function getUtcRangeForZonedDate(
  prisma: PrismaClient,
  dateKey: string,
  tz: string = DEFAULT_ORG_DAY_TZ
): Promise<{ start: Date; end: Date }> {
  const dk = assertDateKey(dateKey);
  const t = assertZonedTz(tz);
  const next = addCalendarDay(dk);
  const rows = await prisma.$queryRawUnsafe<Array<{ start: Date; end: Date }>>(
    `SELECT (timestamp '${dk} 00:00:00' AT TIME ZONE '${t}') AS start, (timestamp '${next} 00:00:00' AT TIME ZONE '${t}') AS end`
  );
  if (!rows?.[0]) throw new Error("day range query failed");
  return { start: rows[0].start, end: rows[0].end };
}
