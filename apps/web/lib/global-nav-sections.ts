import { ALL_APP_ROLE_KEYS } from "./app-roles";

export type GlobalNavItem = {
  href: string;
  label: string;
  roles: string[];
};

export type GlobalNavSection = {
  title: string;
  items: GlobalNavItem[];
};

/**
 * Global (non-workspace) side panel. Admin-only users use AdminSideNav instead.
 * For admins who land here (multi-role / shared shell), combined areas point at hubs —
 * not Finance/Sales/Projects/Approvals as separate buttons.
 */
export const GLOBAL_NAV_SECTIONS: GlobalNavSection[] = [
  {
    title: "Home",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: [...ALL_APP_ROLE_KEYS] },
      { href: "/admin", label: "Admin", roles: ["admin"] },
      { href: "/developer", label: "Developer workspace", roles: ["developer"] },
      { href: "/client", label: "Client portal", roles: ["client"] }
    ]
  },
  {
    title: "Work",
    items: [
      { href: "/schedule", label: "Tasks", roles: [...ALL_APP_ROLE_KEYS] },
      { href: "/community", label: "Community", roles: [...ALL_APP_ROLE_KEYS] }
    ]
  },
  {
    title: "Workspaces",
    items: [
      // Admin hubs only — no Finance / Sales / Approvals / Projects duplicates
      { href: "/admin/management", label: "Management", roles: ["admin"] },
      { href: "/admin/reports", label: "Reports", roles: ["admin"] },
      { href: "/admin/email-automation", label: "Email AI", roles: ["admin"] },
      { href: "/admin/organisation", label: "Organisation", roles: ["admin"] },
      { href: "/admin/ai-command", label: "AI Command", roles: ["admin"] },
      // Role-specific workspaces (non-admin)
      { href: "/sales", label: "Sales", roles: ["sales", "director_admin"] },
      { href: "/finance", label: "Finance", roles: ["finance", "analyst", "director_admin"] },
      { href: "/hr", label: "HR", roles: ["admin", "hr"] },
      { href: "/pm", label: "Project Management", roles: ["admin", "director_admin", "project_manager"] }
    ]
  },
  {
    title: "Delivery",
    items: [
      {
        href: "/projects",
        label: "Projects",
        roles: ["director_admin", "developer", "sales", "analyst", "finance"]
      },
      {
        href: "/projects/management",
        label: "Managed projects",
        roles: ["director_finance", "finance"]
      }
    ]
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", roles: ["admin", "director_admin", "finance", "analyst"] },
      { href: "/approvals", label: "Approvals", roles: ["director_admin", "finance"] }
    ]
  }
];

export function filterGlobalNavSections(
  roleKeys: string[],
  options?: { canSeeFinance?: boolean }
): GlobalNavSection[] {
  const directorFinanceOk =
    options?.canSeeFinance === true ||
    roleKeys.includes("admin") ||
    roleKeys.includes("finance") ||
    roleKeys.includes("analyst");

  return GLOBAL_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.roles.includes("director_finance")) {
        return roleKeys.includes("director_admin") && directorFinanceOk;
      }
      return item.roles.some((r) => roleKeys.includes(r));
    })
  })).filter((s) => s.items.length > 0);
}
