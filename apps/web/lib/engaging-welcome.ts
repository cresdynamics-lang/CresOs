/** Time- and activity-aware lines that speak directly to the user by first name. */

export type EngagingWelcomeContext = {
  firstName: string;
  activeMinutes: number;
  pendingCheckIns?: number;
  criticalProjects?: number;
  overdueMilestones?: number;
  openTasks?: number;
  orgHealth?: number;
  activeProjects?: number;
  reportsToday?: number;
  now?: Date;
};

type DayPart = "morning" | "afternoon" | "evening" | "night";

function dayPart(date: Date): DayPart {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

function dayHash(date: Date): number {
  const key = date.toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 9973;
  return h;
}

export function formatSessionDuration(totalMinutes: number): string {
  if (totalMinutes < 1) return "a few minutes";
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h}h ${m}m`;
}

const TIME_OPENERS: Record<DayPart, string[]> = {
  morning: [
    "Hope you're having a great morning",
    "Good morning",
    "Hope your morning's going well",
    "Morning"
  ],
  afternoon: [
    "Hope you're having a productive afternoon",
    "Good afternoon",
    "Hope your afternoon's going well"
  ],
  evening: [
    "Hope you're having a good evening",
    "Good evening",
    "Hope your evening's going well"
  ],
  night: [
    "Hope you're doing okay tonight",
    "Good evening",
    "Hope tonight's treating you gently"
  ]
};

function timeOpener(part: DayPart, now: Date): string {
  const options = TIME_OPENERS[part];
  return options[dayHash(now) % options.length];
}

/** Warm, emotion-tagged lines — never nudge about breaks. */
export function buildEmotionalCheckIn(
  name: string,
  opener: string,
  duration: string,
  now: Date,
  stressLevel: "light" | "moderate" | "heavy"
): string {
  const h = dayHash(now) + duration.length;
  const light = [
    `${opener}, ${name} — hope you're doing okay today.`,
    `${name}, just checking in — hope you're feeling alright.`,
    `${opener}, ${name} — hope the day's treating you kindly.`
  ];
  const moderate = [
    `${name}, hope you're holding up — you've been in the flow ${duration}.`,
    `${opener}, ${name} — hope you're in a good headspace; ${duration} is a real stretch.`,
    `${name}, hope you're doing okay — ${duration} in the workspace shows real commitment.`
  ];
  const heavy = [
    `${name}, hope you're not feeling overwhelmed — you've been at it ${duration} and the queue is demanding.`,
    `${opener}, ${name} — hope you're alright; it's been ${duration} and there's a lot on your plate.`,
    `${name}, hope you're steady — ${duration} deep with pressure building is a lot for anyone.`
  ];
  const pool = stressLevel === "heavy" ? heavy : stressLevel === "moderate" ? moderate : light;
  return pool[h % pool.length];
}

/**
 * One prominent sentence for the welcome hero — varies by clock time, session length, and PM work signals.
 */
export function buildEngagingWelcomeMessage(ctx: EngagingWelcomeContext): string {
  const name = ctx.firstName.trim() || "there";
  const now = ctx.now ?? new Date();
  const part = dayPart(now);
  const mins = Math.max(0, ctx.activeMinutes);
  const duration = formatSessionDuration(mins);
  const opener = timeOpener(part, now);

  const critical = ctx.criticalProjects ?? 0;
  const checkIns = ctx.pendingCheckIns ?? 0;
  const overdue = ctx.overdueMilestones ?? 0;
  const health = ctx.orgHealth ?? 0;
  const active = ctx.activeProjects ?? 0;
  const reports = ctx.reportsToday ?? 0;

  if (critical > 0) {
    if (mins >= 90) {
      return `${opener}, ${name} — ${critical} project${critical === 1 ? "" : "s"} need you, and hope you're holding up through ${duration}.`;
    }
    return `${opener}, ${name} — ${critical} project${critical === 1 ? " is" : "s are"} in critical state and need you first.`;
  }

  if (checkIns > 0) {
    return `${opener}, ${name} — ${checkIns} developer check-in${checkIns === 1 ? "" : "s"} ${checkIns === 1 ? "is" : "are"} waiting on your reply.`;
  }

  if (overdue > 0) {
    return `${opener}, ${name} — ${overdue} milestone${overdue === 1 ? "" : "s"} overdue; worth a look before standup.`;
  }

  if (mins >= 120) {
    return buildEmotionalCheckIn(name, opener, duration, now, "moderate");
  }

  if (part === "night" && mins >= 60) {
    return buildEmotionalCheckIn(name, opener, duration, now, "light");
  }

  if (reports >= 3 && part !== "morning") {
    return `${opener}, ${name} — ${reports} developer reports filed today; great signal across the team.`;
  }

  if (mins >= 45 && health > 0) {
    return `${opener}, ${name} — you've been in the workspace ${duration}, org health ${health}/100.`;
  }

  if (active > 0 && health >= 85) {
    return `${opener}, ${name} — ${active} active project${active === 1 ? "" : "s"} and delivery looks healthy.`;
  }

  if (active > 0) {
    return `${opener}, ${name} — your delivery cockpit is ready with ${active} active project${active === 1 ? "" : "s"}.`;
  }

  if (mins >= 30) {
    return buildEmotionalCheckIn(name, opener, duration, now, "light");
  }

  return `${opener}, ${name}.`;
}
