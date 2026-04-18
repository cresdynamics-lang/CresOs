/**
 * Which in-app notifications should play a sound / system popup.
 * Task/schedule reminders: no sound (see schedule page + suppressed types).
 * Admin users: never automatic sounds; dev / sales / director get sounds for Community-classified,
 * project, and report-related notifications (see browserNotificationSoundAllowed).
 */

export type AttentionSignalKind = "message" | "project" | "inquiry";

type NotifLike = {
  type?: string | null;
  subject?: string | null;
  body?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

/** Mirrors and automated task nags — no ring, no browser toast. */
export function isNotificationSuppressed(n: NotifLike): boolean {
  const t = norm(n.type);
  if (!t) return false;
  if (t.includes(".admin_mirror")) return true;
  if (t.includes("task_due_reminder")) return true;
  if (t.includes("report_submission_reminder")) return true;
  if (t === "ai_alignment_sent") return true;
  return false;
}

/**
 * Classify for UX + sound: message (chat / @mention / report thread), project delivery signals, or sales inquiry.
 */
export function classifyAttentionSignal(n: NotifLike): AttentionSignalKind | null {
  if (isNotificationSuppressed(n)) return null;

  const t = norm(n.type);
  const subject = norm(n.subject);
  const body = norm(n.body);
  const blob = `${t} ${subject} ${body}`;

  // —— Inquiry / pipeline ——
  if (
    t.includes("lead.") ||
    t.includes("meeting_request") ||
    t.includes("inquiry") ||
    (t.includes("approval") && (blob.includes("lead") || blob.includes("deal")))
  ) {
    return "inquiry";
  }

  // —— Human messages ——
  if (
    t === "task.mention" ||
    t.includes("community") ||
    t.includes("chat") ||
    t.includes("direct") ||
    t.includes("message") ||
    t.includes("crm.bulk_message")
  ) {
    return "message";
  }

  // —— Director broadcast (disambiguate lead vs project) ——
  if (t === "director.activity") {
    if (blob.includes("lead") || blob.includes("deal") || blob.includes("inquiry") || blob.includes("pipeline")) {
      return "inquiry";
    }
    if (blob.includes("project")) {
      return "project";
    }
    return null;
  }

  // —— Project / delivery updates ——
  if (
    t.startsWith("project.") ||
    t === "project.execution" ||
    t.includes("milestone.") ||
    t.includes("change_request") ||
    t.includes("handoff") ||
    t === "developer_report.submitted" ||
    t.includes("sales_report.submitted")
  ) {
    return "project";
  }

  return null;
}

export function shouldRingBrowserNotification(n: NotifLike): boolean {
  return classifyAttentionSignal(n) !== null;
}

/** Roles that should hear browser / UI notification sounds (Community, projects, reports, inquiries). */
const SOUND_ROLE_KEYS = new Set<string>(["developer", "sales", "director_admin"]);

/**
 * Admins never get automatic notification sounds (they still see items on the dashboard and in-app).
 * Developers, sales, and directors do when the notification matches {@link shouldRingBrowserNotification}.
 */
export function browserNotificationSoundAllowed(roleKeys: string[]): boolean {
  if (!roleKeys?.length) return false;
  if (roleKeys.includes("admin")) return false;
  return roleKeys.some((k) => SOUND_ROLE_KEYS.has(k));
}

/** Combine role policy with notification classification. */
export function shouldPlayBrowserSoundForUser(n: NotifLike, roleKeys: string[]): boolean {
  if (!browserNotificationSoundAllowed(roleKeys)) return false;
  return shouldRingBrowserNotification(n);
}
