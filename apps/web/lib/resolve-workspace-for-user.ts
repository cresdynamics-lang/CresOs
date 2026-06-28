import type { WorkspaceKey } from "./resolve-workspace";
import { resolveWorkspace } from "./resolve-workspace";

function hasRole(roleKeys: string[], role: string): boolean {
  return roleKeys.includes(role);
}

function isDeveloperOnly(roleKeys: string[]): boolean {
  return (
    hasRole(roleKeys, "developer") &&
    !hasRole(roleKeys, "admin") &&
    !hasRole(roleKeys, "sales") &&
    !hasRole(roleKeys, "finance") &&
    !hasRole(roleKeys, "analyst") &&
    !hasRole(roleKeys, "director_admin")
  );
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
  const pathBased = resolveWorkspace(path);
  if (pathBased) return pathBased;
  if (!isSharedWorkspacePath(path)) return null;
  return pickSharedWorkspace(path, roleKeys);
}
