"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { salesNeu } from "../../components/sales/sales-theme";
import { ALL_APP_ROLE_KEYS } from "../../lib/app-roles";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: "workspace" | "pipeline" | "delivery" | "review" | "app";
  roles: string[];
  match: "exact" | "prefix";
};

const SALES_NAV_ITEMS: NavItem[] = [
  {
    href: "/sales",
    label: "Overview",
    shortLabel: "Overview",
    group: "workspace",
    roles: ["admin", "sales", "director_admin", "finance"],
    match: "exact"
  },
  {
    href: "/sales/messages",
    label: "Mails",
    shortLabel: "Mails",
    group: "workspace",
    roles: ["admin", "sales"],
    match: "prefix"
  },
  {
    href: "/sales/invoices",
    label: "Invoices",
    group: "pipeline",
    roles: ["admin", "sales"],
    match: "prefix"
  },
  {
    href: "/leads",
    label: "Leads",
    group: "pipeline",
    roles: ["admin", "director_admin", "sales", "finance"],
    match: "prefix"
  },
  {
    href: "/crm",
    label: "CRM",
    group: "pipeline",
    roles: ["admin", "sales", "director_admin", "finance"],
    match: "prefix"
  },
  {
    href: "/reports",
    label: "Sales reports",
    shortLabel: "Reports",
    group: "pipeline",
    roles: ["admin", "director_admin", "sales"],
    match: "prefix"
  },
  {
    href: "/projects",
    label: "Projects",
    group: "delivery",
    roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"],
    match: "prefix"
  },
  {
    href: "/approvals",
    label: "Approvals",
    group: "review",
    roles: ["admin", "director_admin", "finance"],
    match: "prefix"
  }
];

const SALES_APP_NAV: NavItem[] = [
  {
    href: "/schedule",
    label: "Tasks",
    shortLabel: "Tasks",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  },
  {
    href: "/community",
    label: "Community",
    shortLabel: "Community",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  },
  {
    href: "/settings/account",
    label: "Settings",
    shortLabel: "Settings",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  workspace: "Workspace",
  pipeline: "Pipeline",
  delivery: "Delivery",
  review: "Review",
  app: "App"
};

const GROUP_ORDER: NavItem["group"][] = ["workspace", "pipeline", "delivery", "review", "app"];

export function navForSalesRoles(roleKeys: string[]): NavItem[] {
  const main = SALES_NAV_ITEMS.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
  const app = SALES_APP_NAV.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
  return [...main, ...app];
}

export function salesNavGroupsForRoles(roleKeys: string[]): { title: string; items: NavItem[] }[] {
  const visible = navForSalesRoles(roleKeys);
  return GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    items: visible.filter((item) => item.group === group)
  })).filter((g) => g.items.length > 0);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.href === "/settings/account") return pathname.startsWith("/settings");
  if (item.href === "/reports") {
    return (
      (pathname === "/reports" || pathname.startsWith("/reports/")) &&
      !pathname.startsWith("/reports/ai")
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SalesNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const groups = salesNavGroupsForRoles(auth.roleKeys);

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? salesNeu.navActive : salesNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Sales workspace" className="flex flex-col gap-4 px-2 py-3">
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
                    key={item.href + item.label}
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

  const flat = navForSalesRoles(auth.roleKeys);
  return (
    <nav
      aria-label="Sales workspace"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {flat.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href + item.label}
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

export function SalesWorkspaceNav() {
  return <SalesNavLinks />;
}

export function SalesNav() {
  return <SalesNavLinks />;
}

export function SalesSideNav() {
  return <SalesNavLinks vertical />;
}
