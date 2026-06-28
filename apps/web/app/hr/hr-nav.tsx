"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { hrNeu } from "../../components/hr/hr-theme";
import { ALL_APP_ROLE_KEYS } from "../../lib/app-roles";
import { canAccessHrWorkspace } from "../../lib/is-hr-only";
import {
  HrIconAnalytics,
  HrIconCommunity,
  HrIconOverview,
  HrIconPayroll,
  HrIconPeople,
  HrIconSettings,
  HrIconTasks,
  type HrNavIconComponent
} from "../../components/hr/hr-nav-icons";
import {
  HrSideNavDivider,
  HrSideNavGroup,
  HrSideNavLink
} from "../../components/hr/hr-workspace-aside";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  description?: string;
  group: "people" | "app";
  icon: HrNavIconComponent;
  match?: "exact" | "prefix";
};

const HR_NAV_ITEMS: NavItem[] = [
  {
    href: "/hr",
    label: "Overview",
    shortLabel: "Home",
    description: "Charts & workforce snapshot",
    group: "people",
    icon: HrIconOverview,
    match: "exact"
  },
  {
    href: "/hr/analytics",
    label: "Analytics",
    shortLabel: "Charts",
    description: "Graphs, trends & team insights",
    group: "people",
    icon: HrIconAnalytics
  },
  {
    href: "/hr/employees",
    label: "Employees",
    shortLabel: "People",
    description: "Roster, roles & managers",
    group: "people",
    icon: HrIconPeople
  },
  {
    href: "/hr/payroll",
    label: "Payroll",
    shortLabel: "Payroll",
    description: "Salaries & finance sync",
    group: "people",
    icon: HrIconPayroll
  }
];

const HR_APP_NAV: NavItem[] = [
  {
    href: "/schedule",
    label: "Tasks",
    shortLabel: "Tasks",
    description: "Team delivery schedule",
    group: "app",
    icon: HrIconTasks,
    match: "prefix"
  },
  {
    href: "/community",
    label: "Community",
    shortLabel: "Community",
    description: "Messages & announcements",
    group: "app",
    icon: HrIconCommunity,
    match: "prefix"
  },
  {
    href: "/settings/account",
    label: "Settings",
    shortLabel: "Settings",
    description: "Account & preferences",
    group: "app",
    icon: HrIconSettings,
    match: "prefix"
  }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  people: "People operations",
  app: "App"
};

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.match === "prefix") {
    if (item.href === "/settings/account") return pathname.startsWith("/settings");
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.href === "/hr") return pathname === "/hr";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function HrNavLinks({ vertical = false, onNavClick }: { vertical?: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();
  const { auth } = useAuth();

  if (!canAccessHrWorkspace(auth.roleKeys)) return null;

  const appItems = HR_APP_NAV.filter((item) =>
    ALL_APP_ROLE_KEYS.some((r) => auth.roleKeys.includes(r))
  );

  const groups = [
    { title: GROUP_LABELS.people, items: HR_NAV_ITEMS },
    { title: GROUP_LABELS.app, items: appItems }
  ];

  const linkClass = (active: boolean) =>
    [
      vertical
        ? ""
        : "min-h-[44px] shrink-0 snap-start touch-manipulation rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:min-h-0 sm:py-2",
      !vertical && (active ? hrNeu.navActive : hrNeu.navIdle)
    ]
      .filter(Boolean)
      .join(" ");

  if (vertical) {
    return (
      <nav aria-label="HR workspace" className="flex flex-col">
        {groups.map((group, groupIdx) => (
          <div key={group.title}>
            {groupIdx > 0 ? <HrSideNavDivider /> : null}
            <HrSideNavGroup title={group.title}>
              {group.items.map((item) => {
                const active = isNavActive(pathname, item);
                const Icon = item.icon;
                return (
                  <HrSideNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    description={item.description}
                    icon={<Icon />}
                    active={active}
                    onClick={onNavClick}
                  />
                );
              })}
            </HrSideNavGroup>
          </div>
        ))}
      </nav>
    );
  }

  const flat = [...HR_NAV_ITEMS, ...appItems];
  return (
    <nav
      aria-label="HR sections"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {flat.map((item) => {
        const active = isNavActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            <span className="whitespace-nowrap sm:hidden">{item.shortLabel ?? item.label}</span>
            <span className="hidden whitespace-nowrap sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function HrNav() {
  return <HrNavLinks />;
}

export function HrSideNav({ onNavClick }: { onNavClick?: () => void }) {
  return <HrNavLinks vertical onNavClick={onNavClick} />;
}
