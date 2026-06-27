"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { salesWs } from "../../components/sales/sales-theme";

type NavItem = { href: string; label: string; shortLabel?: string; roles: string[]; match: "exact" | "prefix" };

const ITEMS: NavItem[] = [
  { href: "/sales", label: "Overview", shortLabel: "Overview", roles: ["admin", "sales", "director_admin", "finance"], match: "exact" },
  { href: "/sales/messages", label: "Mails", shortLabel: "Mails", roles: ["admin", "sales"], match: "prefix" },
  { href: "/sales/invoices", label: "Invoices", roles: ["admin", "sales"], match: "prefix" },
  { href: "/leads", label: "Leads", roles: ["admin", "director_admin", "sales", "finance"], match: "prefix" },
  { href: "/crm", label: "CRM", roles: ["admin", "sales", "director_admin", "finance"], match: "prefix" },
  { href: "/reports", label: "Sales reports", shortLabel: "Reports", roles: ["admin", "director_admin", "sales"], match: "prefix" },
  { href: "/projects", label: "Projects", roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"], match: "prefix" },
  { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"], match: "prefix" }
];

export function navForSalesRoles(roleKeys: string[]): NavItem[] {
  return ITEMS.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SalesNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const visible = navForSalesRoles(auth.roleKeys);

  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Sales workspace"
      className={
        vertical
          ? "flex flex-col gap-0.5 px-2 py-2"
          : "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
      }
    >
      {visible.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              vertical
                ? "min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-medium touch-manipulation lg:min-h-0"
                : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
              active ? salesWs.navActive : salesWs.navIdle
            ].join(" ")}
          >
            {vertical ? item.label : item.shortLabel ?? item.label}
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
