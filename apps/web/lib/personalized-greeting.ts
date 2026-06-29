/** Derive a friendly first name from profile or email — never hard-coded. */
export function getDisplayFirstName(userName?: string | null, userEmail?: string | null): string {
  const n = userName?.trim();
  if (n) {
    const part = n.split(/\s+/)[0] ?? n;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  const local = userEmail?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (local) {
    const part = local.split(/\s+/)[0] ?? local;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  return "there";
}

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

const TIME_GREETINGS: Record<DayPart, string[]> = {
  morning: ["Good morning", "Morning", "Hope you're having a great morning", "Hope you're having a good morning"],
  afternoon: ["Good afternoon", "Good afternoon", "Hope your afternoon's going well"],
  evening: ["Good evening", "Good evening", "Hope your evening's going well"],
  night: ["Good evening", "Working late", "Good to see you this evening"]
};

const WARM_GREETINGS = [
  "Welcome back",
  "Nice to see you again",
  "Good to have you back",
  "Welcome",
  "Glad you're here"
];

/**
 * One friendly headline per calendar day (stable on refresh), e.g. "Good afternoon, Wilson".
 */
export function buildWelcomeHeadlineForName(displayName: string, now = new Date()): string {
  const name = displayName.trim() || "there";
  const h = dayHash(now);
  const part = dayPart(now);

  if (h % 5 === 0) {
    const warm = WARM_GREETINGS[h % WARM_GREETINGS.length];
    return `${warm}, ${name}`;
  }

  const options = TIME_GREETINGS[part];
  const prefix = options[h % options.length];
  return `${prefix}, ${name}`;
}

export function buildWelcomeHeadline(
  userName?: string | null,
  userEmail?: string | null,
  now = new Date()
): string {
  return buildWelcomeHeadlineForName(getDisplayFirstName(userName, userEmail), now);
}

const SUPPORT_LINES = [
  "Here's what matters for you right now.",
  "We've pulled your priorities together below.",
  "Your queue is ready — take it one step at a time.",
  "Nice to have you in the workspace today."
];

/** Companion line under the headline (rotates daily). */
export function buildWelcomeSupportLine(now = new Date()): string {
  return SUPPORT_LINES[dayHash(now) % SUPPORT_LINES.length];
}
