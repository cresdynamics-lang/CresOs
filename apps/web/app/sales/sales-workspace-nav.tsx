"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";

type NavItem = { href: string; label: string; roles: string[]; match: "exact" | "prefix" };

const ITEMS: NavItem[] = [
  { href: "/sales", label: "Sales hub", roles: ["admin", "sales", "director_admin", "finance"], match: "exact" },
  { href: "/sales/invoices", label: "Invoices", roles: ["admin", "sales"], match: "prefix" },
  { href: "/leads", label: "Leads", roles: ["admin", "director_admin", "sales", "finance"], match: "prefix" },
  { href: "/crm", label: "CRM", roles: ["admin", "sales", "director_admin", "finance"], match: "prefix" },
  { href: "/reports", label: "Sales reports", roles: ["admin", "director_admin", "sales"], match: "prefix" },
  { href: "/projects", label: "Projects", roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"], match: "prefix" },
  { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"], match: "prefix" }
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SalesWorkspaceNav() {
  const pathname = usePathname();
  const { auth } = useAuth();
  const keys = auth.roleKeys;
  const visible = ITEMS.filter((item) => item.roles.some((r) => keys.includes(r)));

  if (visible.length === 0) return null;

  return (
    <nav
      className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2"
      aria-label="Sales workspace"
    >
      {visible.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand/15 text-brand ring-1 ring-brand/40"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
