import { ROLE_KEYS } from "../modules/auth-middleware";

/** Canonical onboarding audiences — one playbook + knowledge filter each. */
export type OnboardingAudience =
  | "developer"
  | "sales"
  | "director"
  | "project_manager"
  | "hr"
  | "finance"
  | "admin";

/** Knowledge sourceTypes allowed per audience (admin = unrestricted). */
const ROLE_SOURCE_ALLOWLIST: Record<Exclude<OnboardingAudience, "admin">, string[]> = {
  developer: [
    "developer_report",
    "developer_report_comment",
    "task",
    "milestone",
    "project_snapshot",
    "pm_check_in",
    "planning_note",
    "team_member",
    "schedule_item",
    "message"
  ],
  sales: [
    "sales_report",
    "sales_report_comment",
    "lead_comment",
    "lead_activity",
    "deal_activity",
    "email_thread",
    "meeting_request",
    "planning_note",
    "team_member",
    "project_snapshot",
    "invoice",
    "message"
  ],
  director: [
    "director_report",
    "director_communication",
    "admin_ai_report",
    "admin_activity",
    "event_log",
    "sales_report",
    "developer_report",
    "project_snapshot",
    "planning_note",
    "team_member",
    "approval",
    "message"
  ],
  project_manager: [
    "pm_check_in",
    "planning_note",
    "project_snapshot",
    "task",
    "milestone",
    "developer_report",
    "project_handoff",
    "change_request",
    "team_member",
    "message"
  ],
  hr: [
    "team_member",
    "admin_activity",
    "event_log",
    "message",
    "schedule_item"
  ],
  finance: [
    "invoice",
    "payment",
    "expense",
    "project_snapshot",
    "event_log",
    "admin_activity",
    "team_member",
    "message"
  ]
};

export function resolveOnboardingAudience(roleKeys: string[]): OnboardingAudience {
  if (roleKeys.includes(ROLE_KEYS.admin)) return "admin";
  if (roleKeys.includes(ROLE_KEYS.director)) return "director";
  if (roleKeys.includes(ROLE_KEYS.project_manager)) return "project_manager";
  if (roleKeys.includes(ROLE_KEYS.hr)) return "hr";
  if (roleKeys.includes(ROLE_KEYS.finance)) return "finance";
  if (roleKeys.includes(ROLE_KEYS.sales)) return "sales";
  if (roleKeys.includes(ROLE_KEYS.developer)) return "developer";
  // Analysts get finance-adjacent onboarding; clients get sales-lite via sales playbook blocked later
  if (roleKeys.includes(ROLE_KEYS.analyst)) return "finance";
  return "developer";
}

export function allowedSourceTypesForAudience(audience: OnboardingAudience): string[] | null {
  if (audience === "admin") return null; // unrestricted
  return ROLE_SOURCE_ALLOWLIST[audience];
}

export function onboardingAccessRoles(): string[] {
  return [
    ROLE_KEYS.admin,
    ROLE_KEYS.director,
    ROLE_KEYS.project_manager,
    ROLE_KEYS.hr,
    ROLE_KEYS.finance,
    ROLE_KEYS.sales,
    ROLE_KEYS.developer,
    ROLE_KEYS.analyst
  ];
}

export function audienceLabel(audience: OnboardingAudience): string {
  const labels: Record<OnboardingAudience, string> = {
    admin: "Admin",
    director: "Director",
    project_manager: "Project Manager",
    hr: "HR",
    finance: "Finance",
    sales: "Sales",
    developer: "Developer"
  };
  return labels[audience];
}
