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

export const GLOBAL_NAV_SECTIONS: GlobalNavSection[] = [
  {
    title: "Home",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: [...ALL_APP_ROLE_KEYS] },
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
      { href: "/sales", label: "Sales", roles: ["admin", "sales", "director_admin", "finance"] },
      { href: "/finance", label: "Finance", roles: ["admin", "finance", "analyst", "director_admin"] },
      { href: "/hr", label: "HR", roles: ["admin", "hr"] },
      { href: "/pm", label: "Project Management", roles: ["admin", "director_admin", "project_manager"] },
      { href: "/admin/users", label: "Admin", roles: ["admin"] }
    ]
  },
  {
    title: "Delivery",
    items: [
      {
        href: "/projects",
        label: "Projects",
        roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"]
      },
      {
        href: "/projects/management",
        label: "Managed projects",
        roles: ["admin", "director_finance", "finance"]
      }
    ]
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", roles: ["admin", "director_admin", "finance", "analyst"] },
      { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"] }
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
