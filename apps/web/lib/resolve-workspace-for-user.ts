import type { WorkspaceKey } from "./resolve-workspace";
import { resolveWorkspace } from "./resolve-workspace";
import { isDirectorOnly } from "./is-director-only";
import { isAdminOnly } from "./is-admin-only";
import { isClientOnly } from "./is-client-only";
import { canAccessHrWorkspace, isHrOnly } from "./is-hr-only";
import { canAccessPmWorkspace, isPmOnly } from "./is-pm-only";

function hasRole(roleKeys: string[], role: string): boolean {
  return roleKeys.includes(role);
}

/** Developer workspace chrome (neu UI) — developer role without leadership or other workspace roles. */
export function isDeveloperOnly(roleKeys: string[]): boolean {
  return (
    hasRole(roleKeys, "developer") &&
    !hasRole(roleKeys, "admin") &&
    !hasRole(roleKeys, "sales") &&
    !hasRole(roleKeys, "finance") &&
    !hasRole(roleKeys, "analyst") &&
    !hasRole(roleKeys, "director_admin") &&
    !hasRole(roleKeys, "client")
  );
}

/** Sales workspace schedule UI — sales or director_admin without developer-only isolation. */
export function isSalesScheduleNeu(roleKeys: string[]): boolean {
  if (isDeveloperOnly(roleKeys)) return false;
  return hasRole(roleKeys, "sales") || hasRole(roleKeys, "director_admin");
}

function isSharedWorkspacePath(path: string): boolean {
  if (path.startsWith("/projects/management")) return false;
  return (
    path === "/schedule" ||
    path.startsWith("/schedule/") ||
    path === "/community" ||
    path.startsWith("/community/") ||
    path === "/projects" ||
    path.startsWith("/projects/")
  );
}

/** Pick workspace chrome for shared routes (tasks, community, projects) based on roles. */
function pickSharedWorkspace(path: string, roleKeys: string[]): WorkspaceKey | null {
  if (isDeveloperOnly(roleKeys)) return "developer";

  const hasSales = hasRole(roleKeys, "sales") || hasRole(roleKeys, "director_admin");
  const hasFinance =
    hasRole(roleKeys, "finance") ||
    hasRole(roleKeys, "analyst") ||
    (hasRole(roleKeys, "admin") && hasRole(roleKeys, "finance"));
  const hasDeveloper = hasRole(roleKeys, "developer");

  if (path.startsWith("/projects")) {
    if (hasSales) return "sales";
    if (hasDeveloper) return "developer";
    if (hasFinance || hasRole(roleKeys, "admin")) return "finance";
    return null;
  }

  if (hasFinance) return "finance";
  if (hasSales) return "sales";
  if (hasDeveloper) return "developer";
  return null;
}

/** Workspace for current path and user — used for side panel + hiding global nav. */
export function resolveWorkspaceForUser(pathname: string, roleKeys: string[]): WorkspaceKey | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (path.startsWith("/settings")) return null;

  if (path.startsWith("/hr") && canAccessHrWorkspace(roleKeys)) {
    return "hr";
  }

  if (path.startsWith("/pm") && canAccessPmWorkspace(roleKeys)) {
    return "pm";
  }

  if (isPmOnly(roleKeys) && (path === "/schedule" || path.startsWith("/schedule/") || path === "/community" || path.startsWith("/community/"))) {
    return "pm";
  }

  if (isDirectorOnly(roleKeys)) {
    return "director";
  }

  if (isAdminOnly(roleKeys)) {
    return "admin";
  }

  if (isHrOnly(roleKeys)) {
    return "hr";
  }

  if (isPmOnly(roleKeys)) {
    return "pm";
  }

  if (isClientOnly(roleKeys)) {
    return "client";
  }

  const pathBased = resolveWorkspace(path);
  if (pathBased) return pathBased;
  if (!isSharedWorkspacePath(path)) return null;
  return pickSharedWorkspace(path, roleKeys);
}
