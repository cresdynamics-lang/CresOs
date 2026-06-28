"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { devNeu } from "../../components/developer/developer-theme";
import { ALL_APP_ROLE_KEYS } from "../../lib/app-roles";

export type DeveloperSection =
  | "overview"
  | "tasks"
  | "reports"
  | "projects"
  | "community"
  | "settings";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  section: DeveloperSection;
  group: "workspace" | "delivery" | "app";
  roles: string[];
  match?: "exact" | "prefix";
};

const DEVELOPER_NAV_ITEMS: NavItem[] = [
  {
    href: "/developer",
    label: "Overview",
    shortLabel: "Overview",
    section: "overview",
    group: "workspace",
    roles: ["developer"],
    match: "exact"
  },
  {
    href: "/schedule",
    label: "Tasks",
    shortLabel: "Tasks",
    section: "tasks",
    group: "workspace",
    roles: ["developer"],
    match: "prefix"
  },
  {
    href: "/developer-reports",
    label: "Reports",
    shortLabel: "Reports",
    section: "reports",
    group: "workspace",
    roles: ["developer"],
    match: "prefix"
  },
  {
    href: "/projects",
    label: "Projects",
    shortLabel: "Projects",
    section: "projects",
    group: "delivery",
    roles: ["developer"],
    match: "prefix"
  }
];

const DEVELOPER_APP_NAV: NavItem[] = [
  {
    href: "/community",
    label: "Community",
    shortLabel: "Community",
    section: "community",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  },
  {
    href: "/settings/account",
    label: "Settings",
    shortLabel: "Settings",
    section: "settings",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  workspace: "Workspace",
  delivery: "Delivery",
  app: "App"
};

const GROUP_ORDER: NavItem["group"][] = ["workspace", "delivery", "app"];

export function navForDeveloperRoles(roleKeys: string[]): NavItem[] {
  const main = DEVELOPER_NAV_ITEMS.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
  const app = DEVELOPER_APP_NAV.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
  return [...main, ...app];
}

export function developerNavGroupsForRoles(roleKeys: string[]): { title: string; items: NavItem[] }[] {
  const visible = navForDeveloperRoles(roleKeys);
  return GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    items: visible.filter((item) => item.group === group)
  })).filter((g) => g.items.length > 0);
}

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.match === "prefix") {
    if (item.href === "/settings/account") return pathname.startsWith("/settings");
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.href === "/developer") return pathname === "/developer";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function DeveloperNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const groups = developerNavGroupsForRoles(auth.roleKeys);

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? devNeu.navActive : devNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Developer workspace" className="flex flex-col gap-4 px-2 py-3">
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
                const active = isNavActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active)}
                  >
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  const flat = navForDeveloperRoles(auth.roleKeys);
  return (
    <nav
      aria-label="Developer workspace"
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

export function DeveloperNav() {
  return <DeveloperNavLinks />;
}

export function DeveloperSideNav() {
  return <DeveloperNavLinks vertical />;
}

export const DEVELOPER_PAGE_TITLES: Record<DeveloperSection, { title: string; description: string }> = {
  overview: {
    title: "Developer workspace",
    description: "Your tasks, reports, and project delivery in one place."
  },
  tasks: {
    title: "Tasks",
    description: "Schedule work, track deadlines, and manage assignments."
  },
  reports: {
    title: "Developer reports",
    description: "Submit progress reports and respond to director questions."
  },
  projects: {
    title: "Projects",
    description: "View assigned projects, milestones, and delivery status."
  },
  community: {
    title: "Community",
    description: "Team chat, calls, and collaboration."
  },
  settings: {
    title: "Settings",
    description: "Account, profile, and notification preferences."
  }
};
