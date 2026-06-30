"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { ALL_APP_ROLE_KEYS } from "../../lib/app-roles";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";
import {
  PmIconCheckIns,
  PmIconCommunity,
  PmIconOverview,
  PmIconPayments,
  PmIconProjects,
  PmIconReports,
  PmIconSettings,
  PmIconTasks,
  PmIconTeam,
  type PmNavIconComponent
} from "../../components/pm/pm-nav-icons";
import { PmSideNavDivider, PmSideNavGroup, PmSideNavLink } from "../../components/pm/pm-workspace-aside";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  description?: string;
  group: "delivery" | "app";
  icon: PmNavIconComponent;
  match?: "exact" | "prefix";
};

const PM_NAV_ITEMS: NavItem[] = [
  {
    href: "/pm",
    label: "Overview",
    shortLabel: "Home",
    description: "Delivery snapshot & priorities",
    group: "delivery",
    icon: PmIconOverview,
    match: "exact"
  },
  {
    href: "/pm/projects",
    label: "Projects",
    shortLabel: "Projects",
    description: "Success criteria & milestones",
    group: "delivery",
    icon: PmIconProjects
  },
  {
    href: "/pm/team",
    label: "Team",
    shortLabel: "Team",
    description: "Developers on active work",
    group: "delivery",
    icon: PmIconTeam
  },
  {
    href: "/pm/reports",
    label: "Team reports",
    shortLabel: "Reports",
    description: "Developer daily reports",
    group: "delivery",
    icon: PmIconReports
  },
  {
    href: "/pm/check-ins",
    label: "Check-ins",
    shortLabel: "Check-ins",
    description: "Daily agile pulse to devs",
    group: "delivery",
    icon: PmIconCheckIns
  },
  {
    href: "/pm/knowledge",
    label: "Knowledge pool",
    shortLabel: "Knowledge",
    description: "Actions, chats & AI analytics",
    group: "delivery",
    icon: PmIconReports
  },
  {
    href: "/pm/payments",
    label: "Payments",
    shortLabel: "Pay",
    description: "Your compensation outlook",
    group: "delivery",
    icon: PmIconPayments
  }
];

const PM_APP_NAV: NavItem[] = [
  {
    href: "/schedule",
    label: "Tasks",
    shortLabel: "Tasks",
    description: "Assign & track delivery",
    group: "app",
    icon: PmIconTasks,
    match: "prefix"
  },
  {
    href: "/community",
    label: "Talks",
    shortLabel: "Talks",
    description: "PM messages to developers",
    group: "app",
    icon: PmIconCommunity,
    match: "prefix"
  },
  {
    href: "/settings/account",
    label: "Settings",
    shortLabel: "Settings",
    description: "Account & preferences",
    group: "app",
    icon: PmIconSettings,
    match: "prefix"
  }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  delivery: "Delivery operations",
  app: "App"
};

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.match === "prefix") {
    if (item.href === "/settings/account") return pathname.startsWith("/settings");
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.href === "/pm") return pathname === "/pm";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function PmNavLinks({ vertical = false, onNavClick }: { vertical?: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();
  const { auth } = useAuth();

  if (!canAccessPmWorkspace(auth.roleKeys)) return null;

  const appItems = PM_APP_NAV.filter((item) => ALL_APP_ROLE_KEYS.some((r) => auth.roleKeys.includes(r)));

  const groups = [
    { title: GROUP_LABELS.delivery, items: PM_NAV_ITEMS },
    { title: GROUP_LABELS.app, items: appItems }
  ];

  const linkClass = (active: boolean) =>
    [
      vertical
        ? ""
        : "min-h-[44px] shrink-0 snap-start touch-manipulation rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:min-h-0 sm:py-2",
      !vertical && (active ? pmNeu.navActive : pmNeu.navIdle)
    ]
      .filter(Boolean)
      .join(" ");

  if (vertical) {
    return (
      <nav aria-label="PM workspace" className="flex flex-col">
        {groups.map((group, groupIdx) => (
          <div key={group.title}>
            {groupIdx > 0 ? <PmSideNavDivider /> : null}
            <PmSideNavGroup title={group.title}>
              {group.items.map((item) => {
                const active = isNavActive(pathname, item);
                const Icon = item.icon;
                return (
                  <PmSideNavLink
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
            </PmSideNavGroup>
          </div>
        ))}
      </nav>
    );
  }

  const flat = [...PM_NAV_ITEMS, ...appItems];
  return (
    <nav
      aria-label="PM sections"
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

export function PmNav() {
  return <PmNavLinks />;
}

export function PmSideNav({ onNavClick }: { onNavClick?: () => void }) {
  return <PmNavLinks vertical onNavClick={onNavClick} />;
}
