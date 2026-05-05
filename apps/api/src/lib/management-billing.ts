/** Default monthly management fee when director enrolls a project (KES). */
export const DEFAULT_MANAGEMENT_MONTHLY_KES = 2000;

export type YearMonth = { year: number; month: number };

/** Billable UTC calendar months from management start through end cap (inclusive). */
export function billableMonthsUtc(
  managementStartedAt: Date,
  managementMonths: number | null | undefined,
  now: Date = new Date()
): YearMonth[] {
  const out: YearMonth[] = [];
  let y = managementStartedAt.getUTCFullYear();
  let m = managementStartedAt.getUTCMonth() + 1;
  const capY = now.getUTCFullYear();
  const capM = now.getUTCMonth() + 1;

  let endY = capY;
  let endM = capM;

  if (managementMonths != null && managementMonths > 0) {
    let ey = y;
    let em = m;
    for (let i = 0; i < managementMonths - 1; i++) {
      em += 1;
      if (em > 12) {
        em = 1;
        ey += 1;
      }
    }
    if (ey < capY || (ey === capY && em <= capM)) {
      endY = ey;
      endM = em;
    }
  }

  let cy = y;
  let cm = m;
  while (cy < endY || (cy === endY && cm <= endM)) {
    out.push({ year: cy, month: cm });
    cm += 1;
    if (cm > 12) {
      cm = 1;
      cy += 1;
    }
  }
  return out;
}

export function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
