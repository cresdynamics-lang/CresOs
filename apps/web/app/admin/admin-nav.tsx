"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNeu } from "../../components/admin/admin-theme";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: "primary" | "more";
  match?: "exact" | "prefix";
  badge?: number;
  icon: "grid" | "spark" | "chart" | "briefcase" | "building" | "calendar" | "chat" | "mail";
};

/**
 * Side panel order: Dashboard → Tasks → Management → Reports → Community,
 * then Email AI, AI Command, Analytics, Organisation.
 */
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", shortLabel: "Home", group: "primary", match: "exact", icon: "grid" },
  { href: "/schedule", label: "Tasks", group: "primary", match: "prefix", icon: "calendar" },
  { href: "/admin/management", label: "Management", shortLabel: "Manage", group: "primary", match: "prefix", icon: "briefcase" },
  { href: "/admin/reports", label: "Reports", group: "primary", match: "prefix", icon: "chart" },
  { href: "/community", label: "Community", group: "primary", match: "prefix", icon: "chat" },
  { href: "/admin/email-automation", label: "Email AI", shortLabel: "Email", group: "more", match: "prefix", icon: "mail" },
  { href: "/admin/ai-command", label: "AI Command", shortLabel: "AI", group: "more", match: "prefix", icon: "spark" },
  { href: "/analytics", label: "Analytics", group: "more", match: "prefix", icon: "chart" },
  { href: "/admin/organisation", label: "Organisation", shortLabel: "Org", group: "more", match: "prefix", icon: "building" }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  primary: "Main",
  more: "More"
};

const GROUP_ORDER: NavItem["group"][] = ["primary", "more"];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = {
    className: "h-4 w-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    "aria-hidden": true as const
  };
  const paths: Record<NavItem["icon"], ReactNode> = {
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />,
    spark: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />,
    chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 19V9m5 10V5m5 14v-8m5 8V8" />,
    briefcase: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9zm0 4h16"
      />
    ),
    building: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M9 9h2M9 13h2M9 17h2M14 21h6V10h-4" />,
    calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />,
    chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 118-8 8 8 0 0110 5z" />,
    mail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16v12H4V6zm0 0l8 7 8-7" />
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function isManagementPath(pathname: string): boolean {
  if (pathname.startsWith("/admin/management")) return true;
  if (pathname.startsWith("/approvals")) return true;
  if (pathname.startsWith("/sales")) return true;
  if (pathname.startsWith("/leads")) return true;
  if (pathname.startsWith("/crm")) return true;
  if (pathname.startsWith("/finance") && !pathname.startsWith("/finance/reports")) return true;
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
  return false;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href || (item.href === "/admin" && pathname === "/admin/");
  if (item.href === "/admin/management") {
    return isManagementPath(pathname);
  }
  if (item.href === "/admin/reports") {
    return (
      pathname.startsWith("/admin/reports") ||
      pathname === "/reports" ||
      pathname.startsWith("/reports/") ||
      pathname === "/developer-reports" ||
      pathname.startsWith("/developer-reports/") ||
      pathname === "/director-reports" ||
      pathname.startsWith("/director-reports/") ||
      pathname === "/finance/reports" ||
      pathname.startsWith("/finance/reports/")
    );
  }
  if (item.href === "/admin/ai-command") {
    return pathname.startsWith("/admin/ai-command") || pathname.startsWith("/admin/onboarding");
  }
  if (item.href === "/admin/email-automation") {
    return pathname.startsWith("/admin/email-automation");
  }
  if (item.href === "/admin/organisation") {
    return (
      pathname.startsWith("/admin/organisation") ||
      pathname.startsWith("/admin/organization") ||
      pathname.startsWith("/admin/users") ||
      pathname === "/admin/org" ||
      pathname.startsWith("/admin/org/") ||
      pathname.startsWith("/admin/roles") ||
      pathname.startsWith("/admin/client-portal")
    );
  }
  if (item.href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function AdminNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const groups = GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    items: ADMIN_NAV.filter((item) => item.group === group)
  })).filter((g) => g.items.length > 0);

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "relative flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2 font-body text-[13px] font-semibold transition-colors touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 font-body text-sm font-semibold whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? adminNeu.navActive : adminNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Admin workspace" className="flex flex-col gap-4 px-2 py-3">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B93A1]">
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
                    <NavIcon name={item.icon} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-[#E85D5D] px-1.5 py-0.5 font-label text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
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
            className={[
              "min-h-[40px] shrink-0 rounded-lg px-3 py-2 font-body text-sm font-semibold",
              active
                ? "bg-[#2D5A5A] text-white"
                : "border border-[#E5E9EF] bg-white text-[#1A1D26] hover:bg-[#F4F7F9]"
            ].join(" ")}
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
