"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  group: "administration" | "automation";
  match?: "exact" | "prefix";
};

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/users", label: "Users", group: "administration" },
  { href: "/admin/org", label: "Departments", group: "administration" },
  { href: "/admin/roles", label: "Roles", group: "administration" },
  { href: "/admin/email-automation", label: "Email automation", group: "automation", match: "prefix" }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  administration: "Administration",
  automation: "Emil-AI"
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "prefix") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function AdminNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const groups: NavItem["group"][] = ["administration", "automation"];

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active
        ? "border border-sky-500/30 bg-sky-950/50 text-sky-200"
        : "border border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Admin workspace" className="flex flex-col gap-4 px-2 py-3">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {GROUP_LABELS[group]}
            </p>
            <div className="flex flex-col gap-0.5">
              {ADMIN_NAV_ITEMS.filter((item) => item.group === group).map((item) => {
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
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            {item.label}
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
