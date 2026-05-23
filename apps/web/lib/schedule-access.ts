import { ALL_APP_ROLE_KEYS } from "./app-roles";

/** Every org role can use Tasks & schedule (matches API + sidebar). */
export const SCHEDULE_APP_ROLES: readonly string[] = ALL_APP_ROLE_KEYS;

export function canAccessSchedule(roleKeys: string[]): boolean {
  return roleKeys.some((r) => SCHEDULE_APP_ROLES.includes(r));
}

export function canViewOrgSchedule(roleKeys: string[]): boolean {
  return roleKeys.some((r) => ["admin", "director_admin"].includes(r));
}

export function canDeleteScheduleItems(roleKeys: string[]): boolean {
  return roleKeys.some((r) => ["admin", "director_admin"].includes(r));
}

const ROLE_SCHEDULE_HINTS: Record<string, string> = {
  admin: "Use org-wide view to confirm anyone’s meetings and keep the team accountable.",
  director_admin: "Use org-wide view to review and confirm your team’s scheduled meetings and calls.",
  finance: "Track approval deadlines, payout reviews, and finance follow-ups in one place.",
  developer: "Plan delivery work alongside project tasks — standups, reviews, and report deadlines.",
  sales: "Stay on top of client calls, meetings, and daily report commitments.",
  analyst: "Schedule research, CRM follow-ups, and reporting checkpoints.",
  client: "View and plan your meetings and deliverables with the Cres Dynamics team."
};

export function scheduleDescriptionForRoles(roleKeys: string[]): string {
  const base =
    "Schedule meetings, calls, reports, and tasks. Review by day, week, month, or quarter to stay accountable.";
  const hints = roleKeys.map((r) => ROLE_SCHEDULE_HINTS[r]).filter(Boolean);
  const unique = Array.from(new Set(hints));
  return unique.length > 0 ? `${base} ${unique[0]}` : base;
}

/** Neutral page eyebrow — no role name in the header. */
export const SCHEDULE_PAGE_EYEBROW = "Tasks & schedule";

export type ScheduleAttentionCopy = {
  sectionTitle: string;
  summary: string;
  bullets: string[];
};

const ROLE_ATTENTION: Record<string, ScheduleAttentionCopy> = {
  admin: {
    sectionTitle: "What needs your attention",
    summary: "You see the full org calendar when you need it — your own queue first.",
    bullets: [
      "Pending team meetings and calls that still need a done/attended confirmation.",
      "Your own reports, approvals checkpoints, and governance follow-ups in the selected period.",
      "Turn on org-wide view to review anyone’s schedule before end of week or month."
    ]
  },
  director_admin: {
    sectionTitle: "What needs your attention",
    summary: "Stay ahead of delivery and sales rhythm across your team.",
    bullets: [
      "Team meetings, client calls, and report slots you must confirm or reschedule.",
      "Developers and sales with empty or overdue items in the period you’re reviewing.",
      "Enable org-wide view to mark attendance on your team’s scheduled work."
    ]
  },
  finance: {
    sectionTitle: "What needs your attention",
    summary: "Keep finance deadlines visible next to delivery — not buried in email.",
    bullets: [
      "Approval and payout follow-ups tied to dates in this period.",
      "Meetings with admin or directors about outstanding requests.",
      "Report and task rows you added for month-end or quarter close."
    ]
  },
  developer: {
    sectionTitle: "What needs your attention",
    summary: "Your delivery queue and report rhythm in one place.",
    bullets: [
      "Project tasks and milestones due in the window you select (today through quarter).",
      "Daily or activity report deadlines and any standups or reviews on your calendar.",
      "Pending items with reminders — enable browser notifications for calls and meetings (not generic task rows)."
    ]
  },
  sales: {
    sectionTitle: "What needs your attention",
    summary: "Client motion and reporting discipline for the period you pick.",
    bullets: [
      "Calls and meetings with leads or clients that are still open in this period.",
      "Daily sales report commitments and follow-ups you scheduled as tasks.",
      "Turn on reminders for calls and meetings so you can prepare before they start."
    ]
  },
  analyst: {
    sectionTitle: "What needs your attention",
    summary: "Research and CRM work with clear dates.",
    bullets: [
      "Scheduled interviews, data reviews, and stakeholder calls in the selected period.",
      "Reporting or analytics deliverables you logged as tasks or reports.",
      "Anything still pending when you filter by week or month."
    ]
  },
  client: {
    sectionTitle: "What needs your attention",
    summary: "Your touchpoints with the Cres Dynamics team.",
    bullets: [
      "Upcoming meetings and calls in the period you’re viewing.",
      "Deliverable or review dates shared with you as tasks.",
      "Enable browser notifications if you want a heads-up before a scheduled call."
    ]
  }
};

const ATTENTION_PRIORITY = [
  "admin",
  "director_admin",
  "finance",
  "sales",
  "developer",
  "analyst",
  "client"
] as const;

/** Role-specific “what needs your attention” for the schedule welcome block. */
export function scheduleAttentionForRoles(roleKeys: string[]): ScheduleAttentionCopy {
  for (const key of ATTENTION_PRIORITY) {
    if (roleKeys.includes(key) && ROLE_ATTENTION[key]) {
      return ROLE_ATTENTION[key];
    }
  }
  return {
    sectionTitle: "What needs your attention",
    summary: "Your meetings, calls, reports, and tasks for the period you choose.",
    bullets: [
      "Use the colored period pills and accountability stats to see total, done, and pending.",
      "Filter the list to pending items when you want a focused queue.",
      "Allow browser notifications if you want reminders before meetings and calls."
    ]
  };
}
