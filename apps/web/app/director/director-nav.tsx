"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { directorNeu } from "../../components/director/director-theme";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: "command" | "pipeline" | "delivery" | "insights" | "app";
  match: "exact" | "prefix";
};

const DIRECTOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Command center", shortLabel: "Home", group: "command", match: "exact" },
  { href: "/analytics", label: "Analytics", group: "command", match: "prefix" },
  { href: "/activity", label: "Activity log", shortLabel: "Activity", group: "command", match: "prefix" },
  { href: "/leads", label: "Leads", group: "pipeline", match: "prefix" },
  { href: "/crm", label: "CRM", group: "pipeline", match: "prefix" },
  { href: "/reports", label: "Sales reports", shortLabel: "Sales RPT", group: "pipeline", match: "prefix" },
  { href: "/projects", label: "Projects", group: "delivery", match: "prefix" },
  { href: "/developer-reports", label: "Developer reports", shortLabel: "Dev RPT", group: "delivery", match: "prefix" },
  { href: "/approvals", label: "Approvals", group: "insights", match: "prefix" },
  { href: "/reports/ai", label: "AI summaries", group: "insights", match: "prefix" },
  { href: "/schedule", label: "Tasks", group: "app", match: "prefix" },
  { href: "/community", label: "Community", group: "app", match: "prefix" },
  { href: "/settings/account", label: "Settings", group: "app", match: "prefix" }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  command: "Command",
  pipeline: "Pipeline",
  delivery: "Delivery",
  insights: "Insights",
  app: "App"
};

const GROUP_ORDER: NavItem["group"][] = ["command", "pipeline", "delivery", "insights", "app"];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.href === "/settings/account") return pathname.startsWith("/settings");
  if (item.href === "/reports") {
    return (
      (pathname === "/reports" || pathname.startsWith("/reports/")) && !pathname.startsWith("/reports/ai")
    );
  }
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function DirectorNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const groups = GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    items: DIRECTOR_NAV.filter((item) => item.group === group)
  }));

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? directorNeu.navActive : directorNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Director workspace" className="flex flex-col gap-4 px-2 py-3">
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
      aria-label="Director workspace"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {DIRECTOR_NAV.map((item) => {
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

export function DirectorNav() {
  return <DirectorNavLinks />;
}

export function DirectorSideNav() {
  return <DirectorNavLinks vertical />;
}
