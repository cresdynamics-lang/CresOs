export type WorkspaceKey = "finance" | "sales" | "developer" | "director" | "admin" | "client" | "hr";

/** Routes that use a workspace side panel instead of the global app sidebar. */
export function resolveWorkspace(pathname: string): WorkspaceKey | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (path.startsWith("/finance") || path.startsWith("/approvals")) return "finance";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/hr")) return "hr";
  if (
    path.startsWith("/sales") ||
    path.startsWith("/leads") ||
    path.startsWith("/crm") ||
    (path.startsWith("/reports") && !path.startsWith("/reports/ai"))
  ) {
    return "sales";
  }
  if (path.startsWith("/developer") || path.startsWith("/developer-reports")) return "developer";
  if (path.startsWith("/client")) return "client";
  return null;
}

export function isWorkspaceRoute(pathname: string): boolean {
  return resolveWorkspace(pathname) !== null;
}
