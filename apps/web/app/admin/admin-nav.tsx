"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNeu } from "../../components/admin/admin-theme";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: "overview" | "command" | "workspaces" | "governance" | "pipeline" | "insights" | "administration" | "portal" | "app";
  match?: "exact" | "prefix";
  badge?: number;
  icon: "grid" | "spark" | "book" | "mail" | "chart" | "pulse" | "wallet" | "cart" | "check" | "folder" | "users" | "building" | "shield" | "globe" | "calendar" | "chat" | "settings";
};

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", shortLabel: "Home", group: "overview", match: "exact", icon: "grid" },
  { href: "/admin/ai-command", label: "AI Command", group: "command", match: "prefix", icon: "spark" },
  { href: "/admin/onboarding", label: "Playbook", group: "command", match: "prefix", icon: "book" },
  { href: "/admin/email-automation", label: "Email AI", group: "command", match: "prefix", icon: "mail" },
  { href: "/analytics", label: "Analytics", group: "command", match: "prefix", icon: "chart" },
  { href: "/activity", label: "Activity log", shortLabel: "Activity", group: "command", match: "prefix", icon: "pulse" },
  { href: "/finance", label: "Finance", group: "workspaces", match: "prefix", icon: "wallet" },
  { href: "/sales", label: "Sales", group: "workspaces", match: "prefix", icon: "cart" },
  { href: "/approvals", label: "Approvals", group: "governance", match: "prefix", icon: "check" },
  { href: "/projects", label: "Projects", group: "governance", match: "prefix", icon: "folder" },
  { href: "/projects/management", label: "Managed projects", shortLabel: "Managed", group: "governance", match: "prefix", icon: "folder" },
  { href: "/leads", label: "Leads", group: "pipeline", match: "prefix", icon: "users" },
  { href: "/crm", label: "CRM & clients", shortLabel: "CRM", group: "pipeline", match: "prefix", icon: "users" },
  { href: "/reports", label: "Sales reports", shortLabel: "Sales RPT", group: "insights", match: "prefix", icon: "chart" },
  { href: "/developer-reports", label: "Developer reports", shortLabel: "Dev RPT", group: "insights", match: "prefix", icon: "chart" },
  { href: "/reports/ai", label: "AI briefings", group: "insights", match: "prefix", icon: "spark" },
  { href: "/admin/users", label: "Users", group: "administration", match: "prefix", icon: "users" },
  { href: "/admin/org", label: "Departments", group: "administration", match: "prefix", icon: "building" },
  { href: "/admin/roles", label: "Roles", group: "administration", match: "prefix", icon: "shield" },
  { href: "/admin/client-portal", label: "Client portal", shortLabel: "Clients", group: "portal", match: "prefix", icon: "globe" },
  { href: "/schedule", label: "Tasks", group: "app", match: "prefix", icon: "calendar" },
  { href: "/community", label: "Community", group: "app", match: "prefix", icon: "chat" },
  { href: "/settings/account", label: "Settings", group: "app", match: "prefix", icon: "settings" }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  overview: "Overview",
  command: "Command",
  workspaces: "Workspaces",
  governance: "Governance",
  pipeline: "Pipeline",
  insights: "Insights",
  administration: "Administration",
  portal: "Client access",
  app: "General"
};

const GROUP_ORDER: NavItem["group"][] = [
  "overview",
  "command",
  "workspaces",
  "governance",
  "pipeline",
  "insights",
  "administration",
  "portal",
  "app"
];

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
    book: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V6.5A2.5 2.5 0 016.5 4H20v13H6.5A2.5 2.5 0 004 19.5z" />,
    mail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16v12H4V6zm0 0l8 7 8-7" />,
    chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 19V9m5 10V5m5 14v-8m5 8V8" />,
    pulse: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12h4l2-5 4 10 2-5h6" />,
    wallet: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7h18v12H3V7zm14 6h4M3 10h18" />,
    cart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 5h2l2 12h12l2-8H7M9 21a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    folder: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zm9 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
    building: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M9 9h2M9 13h2M9 17h2M14 21h6V10h-4" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />,
    globe: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5 0 4.5-4 4.5-9S14.5 3 12 3 7.5 7 7.5 12s2 9 4.5 9zM3 12h18" />,
    calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />,
    chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 118-8 8 8 0 0110 5z" />,
    settings: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 00-1.7-1L12.8 2h-1.6L10.8 4.5a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 000 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 001.7 1L11.2 22h1.6l.4-2.5a7.6 7.6 0 001.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" />
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href || (item.href === "/admin" && pathname === "/admin/");
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
  if (item.href === "/admin") return pathname === "/admin" || pathname === "/admin/";
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
