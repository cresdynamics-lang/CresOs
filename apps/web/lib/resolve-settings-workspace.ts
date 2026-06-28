import { isDeveloperOnly } from "./resolve-workspace-for-user";

export type SettingsWorkspaceKey = "developer" | "finance" | "sales" | "global";

/** Pick settings chrome theme from the user's primary workspace role. */
export function resolveSettingsWorkspace(roleKeys: string[]): SettingsWorkspaceKey {
  if (isDeveloperOnly(roleKeys)) return "developer";
  if (roleKeys.includes("finance") || roleKeys.includes("analyst")) return "finance";
  if (roleKeys.includes("sales") || roleKeys.includes("director_admin")) return "sales";
  return "global";
}

export function settingsBackLink(key: SettingsWorkspaceKey): { href: string; label: string } {
  switch (key) {
    case "developer":
      return { href: "/developer", label: "← Back to Developer" };
    case "finance":
      return { href: "/finance", label: "← Back to Finance" };
    case "sales":
      return { href: "/sales", label: "← Back to Sales" };
    default:
      return { href: "/dashboard", label: "← Back to dashboard" };
  }
}
