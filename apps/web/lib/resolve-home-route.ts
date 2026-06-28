const LEADERSHIP_ROLES = ["admin", "director_admin", "finance", "analyst"] as const;

/** Sales reps use the fullscreen sales workspace instead of the legacy command-center dashboard. */
export function shouldUseSalesWorkspace(roleKeys: string[]): boolean {
  return roleKeys.includes("sales") && !roleKeys.some((r) => LEADERSHIP_ROLES.includes(r as (typeof LEADERSHIP_ROLES)[number]));
}

/** Post-login / home route for the signed-in user. */
export function resolveHomeRouteForUser(roleKeys: string[]): string {
  const isClientOnly =
    roleKeys.includes("client") &&
    !roleKeys.some((r) => ["admin", "director_admin", "finance", "sales", "developer", "analyst"].includes(r));
  if (isClientOnly) return "/client";

  const isDeveloperOnly =
    roleKeys.includes("developer") &&
    !roleKeys.some((r) => ["admin", "director_admin", "finance", "sales", "analyst"].includes(r));
  if (isDeveloperOnly) return "/developer";

  if (shouldUseSalesWorkspace(roleKeys)) return "/sales";

  const isFinanceOnly =
    (roleKeys.includes("finance") || roleKeys.includes("analyst")) &&
    !roleKeys.some((r) => ["admin", "director_admin"].includes(r));
  if (isFinanceOnly) return "/finance";

  return "/dashboard";
}
