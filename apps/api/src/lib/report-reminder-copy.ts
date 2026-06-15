import {
  NAIROBI_TZ,
  firstNameFromUser,
  formatNairobiDateLabel,
  getZonedWeekday
} from "./nairobi-datetime";

function pickVariant(seed: string, count: number): number {
  if (count <= 1) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % count;
}

const SALES_BY_DAY: Record<number, string[]> = {
  1: [
    "Hi {name}, hope Monday is off to a good start — when you have a minute, send through today's sales update on CresOS.",
    "{name}, quick check-in: I still need your sales report for {date}. Share what moved today when you can.",
    "Morning {name} — please log today's sales activity in CresOS before you sign off."
  ],
  2: [
    "Hi {name}, following up on today's sales report — still open on my end. What did you close or progress today?",
    "{name}, could you send your Tuesday sales update on CresOS? Even a short summary helps.",
    "Hey {name}, I haven't seen today's sales report yet — drop it in when you get a chance."
  ],
  3: [
    "Hi {name}, midweek check — please submit today's sales report on CresOS when you're free.",
    "{name}, still waiting on your sales update for {date}. Ping me if anything is blocking you.",
    "Hey {name}, can you file today's sales report? I want to capture pipeline movement while it's fresh."
  ],
  4: [
    "Hi {name}, please send through today's sales report on CresOS — helps us stay aligned for the week.",
    "{name}, your sales update for {date} is still pending. Share leads, calls, and follow-ups when you can.",
    "Hey {name}, before the day runs away — log today's sales activity on CresOS."
  ],
  5: [
    "Hi {name}, end-of-week sales report still needed for today. Send what you moved on CresOS.",
    "{name}, please close out today's sales report — even a brief Friday summary works.",
    "Hey {name}, I don't have your sales update for {date} yet. File it when you wrap up."
  ],
  6: [
    "Hi {name}, Saturday check-in — please submit today's sales report on CresOS if you're working today.",
    "{name}, when you get a moment today, send your sales update for {date}.",
    "Hey {name}, still need today's sales report from you on CresOS."
  ]
};

const DEV_BY_DAY: Record<number, string[]> = {
  1: [
    "Hi {name}, please send today's developer report on CresOS — what shipped, what's blocked, and what needs attention.",
    "{name}, Monday dev update still pending. Share progress on tasks and milestones when you can.",
    "Hey {name}, I haven't received your dev report for {date} yet. Log it before you sign off."
  ],
  2: [
    "Hi {name}, quick one — today's developer report is still open. Update tasks and note any blockers on CresOS.",
    "{name}, could you file your dev report for {date}? I need visibility on delivery today.",
    "Hey {name}, please submit today's developer update — what worked, blockers, and next steps."
  ],
  3: [
    "Hi {name}, midweek dev report still missing for {date}. Share what you completed and what's stuck.",
    "{name}, when you get a minute, send today's developer report on CresOS.",
    "Hey {name}, I still need your dev update for today — tasks, milestones, and anything needing a decision."
  ],
  4: [
    "Hi {name}, please log today's developer report on CresOS — progress, blockers, and tomorrow's plan.",
    "{name}, your dev report for {date} hasn't come through yet. Update assigned work when you can.",
    "Hey {name}, send today's developer update so we can keep projects on track."
  ],
  5: [
    "Hi {name}, Friday dev report still pending — share what you closed this week and what's carrying over.",
    "{name}, please submit today's developer report before you wrap up.",
    "Hey {name}, I don't have your dev update for {date} yet. File it on CresOS when you're done for the day."
  ],
  6: [
    "Hi {name}, if you're working today, please send your developer report on CresOS.",
    "{name}, Saturday dev update still needed for {date} when you have a moment.",
    "Hey {name}, please log today's developer report — tasks, blockers, and focus for next week if relevant."
  ]
};

function fillTemplate(template: string, name: string, dateLabel: string, director: string): string {
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{date\}/g, dateLabel)
    .replace(/\{director\}/g, director);
}

function directorReminderPhrase(directorName: string | null | undefined): string {
  const label = directorName?.trim();
  return label ? ` Submit to ${label} for review on CresOS.` : "";
}

export function buildPersonalizedReportReminder(opts: {
  role: "sales" | "developer";
  userId: string;
  dateKey: string;
  userName: string | null;
  userEmail: string;
  directorName?: string | null;
  now: Date;
  tz?: string;
}): { subject: string; body: string } {
  const tz = opts.tz ?? NAIROBI_TZ;
  const weekday = getZonedWeekday(opts.now, tz);
  const pool = opts.role === "sales" ? SALES_BY_DAY[weekday] : DEV_BY_DAY[weekday];
  const name = firstNameFromUser(opts.userName, opts.userEmail);
  const dateLabel = formatNairobiDateLabel(opts.now, tz);

  const templates =
    pool ??
    (opts.role === "sales"
      ? ["Hi {name}, please submit today's sales report on CresOS for {date}."]
      : ["Hi {name}, please submit today's developer report on CresOS for {date}."]);

  const directorLabel = opts.directorName?.trim() ?? "";
  const variant = pickVariant(`${opts.userId}:${opts.dateKey}:${opts.role}`, templates.length);
  const body =
    fillTemplate(templates[variant], name, dateLabel, directorLabel) + directorReminderPhrase(directorLabel);

  const directorSubject = directorLabel ? ` — submit to ${directorLabel}` : "";
  const subject =
    opts.role === "sales"
      ? weekday === 5
        ? `${name}, today's sales report${directorSubject}`
        : `Sales update for ${dateLabel.split(",")[0] ?? "today"}${directorSubject}`
      : `${name}, today's dev report${directorSubject}`;

  return { subject, body };
}
