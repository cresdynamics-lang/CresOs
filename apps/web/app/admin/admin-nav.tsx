"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNeu } from "../../components/admin/admin-theme";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: "command" | "workspaces" | "governance" | "pipeline" | "insights" | "administration" | "portal" | "app";
  match?: "exact" | "prefix";
};

/** Full admin workspace navigation — side panel is the single source of truth. */
const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Command center", shortLabel: "Home", group: "command", match: "exact" },
  { href: "/admin/email-automation", label: "Email AI", shortLabel: "Email AI", group: "command", match: "prefix" },
  { href: "/analytics", label: "Analytics", group: "command", match: "prefix" },
  { href: "/activity", label: "Activity log", shortLabel: "Activity", group: "command", match: "prefix" },
  { href: "/finance", label: "Finance", group: "workspaces", match: "prefix" },
  { href: "/sales", label: "Sales workspace", shortLabel: "Sales", group: "workspaces", match: "prefix" },
  { href: "/approvals", label: "Approvals", group: "governance", match: "prefix" },
  { href: "/projects", label: "Projects", group: "governance", match: "prefix" },
  { href: "/projects/management", label: "Managed projects", shortLabel: "Managed", group: "governance", match: "prefix" },
  { href: "/leads", label: "Leads", group: "pipeline", match: "prefix" },
  { href: "/crm", label: "CRM & clients", shortLabel: "CRM", group: "pipeline", match: "prefix" },
  { href: "/reports", label: "Sales reports", shortLabel: "Sales RPT", group: "insights", match: "prefix" },
  { href: "/developer-reports", label: "Developer reports", shortLabel: "Dev RPT", group: "insights", match: "prefix" },
  { href: "/reports/ai", label: "AI briefings", group: "insights", match: "prefix" },
  { href: "/admin/users", label: "Users", group: "administration", match: "prefix" },
  { href: "/admin/org", label: "Departments", group: "administration", match: "prefix" },
  { href: "/admin/roles", label: "Roles", group: "administration", match: "prefix" },
  { href: "/admin/client-portal", label: "Client portal", shortLabel: "Clients", group: "portal", match: "prefix" },
  { href: "/schedule", label: "Tasks", group: "app", match: "prefix" },
  { href: "/community", label: "Community", group: "app", match: "prefix" },
  { href: "/settings/account", label: "Settings", group: "app", match: "prefix" }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  command: "Command",
  workspaces: "Workspaces",
  governance: "Governance",
  pipeline: "Pipeline",
  insights: "Insights",
  administration: "Administration",
  portal: "Client access",
  app: "App"
};

const GROUP_ORDER: NavItem["group"][] = [
  "command",
  "workspaces",
  "governance",
  "pipeline",
  "insights",
  "administration",
  "portal",
  "app"
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.href === "/settings/account") return pathname.startsWith("/settings");
  if (item.href === "/reports") {
    return (
      (pathname === "/reports" || pathname.startsWith("/reports/")) && !pathname.startsWith("/reports/ai")
    );
  }
  if (item.href === "/projects") {
    return (
      (pathname === "/projects" || pathname.startsWith("/projects/")) &&
      !pathname.startsWith("/projects/management")
    );
  }
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function AdminNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const groups = GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    items: ADMIN_NAV.filter((item) => item.group === group)
  }));

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? adminNeu.navActive : adminNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Admin workspace" className="flex flex-col gap-4 px-2 py-3">
        {groups.map((group) => (
          <div key={group.title}>
            {group.title === "App" ? (
              <div className="mx-2 mb-3 border-t border-white/[0.06] pt-3" aria-hidden />
            ) : null}
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Admin workspace"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            {item.shortLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNav() {
  return <AdminNavLinks />;
}

export function AdminSideNav() {
  return <AdminNavLinks vertical />;
}
