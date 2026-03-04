"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";

type NavSection = {
  title: string;
  items: { href: string; label: string; roles: string[] }[];
};

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: ["admin", "director_admin", "finance", "ops", "sales", "analyst", "client"] }
    ]
  },
  {
    title: "Sales & CRM",
    items: [
      { href: "/crm", label: "CRM", roles: ["admin", "director_admin", "sales", "analyst"] }
    ]
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", roles: ["admin", "director_admin", "ops", "analyst"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Finance", roles: ["admin", "director_admin", "finance", "analyst"] },
      { href: "/approvals", label: "Approvals", roles: ["admin", "director_admin", "finance"] }
    ]
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", roles: ["admin", "director_admin", "finance", "analyst"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { href: "/admin", label: "Users & org", roles: ["admin"] }
    ]
  }
];

function roleLabel(key: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    director_admin: "Director",
    finance: "Finance",
    ops: "Ops",
    sales: "Sales",
    analyst: "Analyst",
    client: "Client"
  };
  return labels[key] ?? key;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { auth, setAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const roles = auth.roleKeys;

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.roles.some((r) => roles.includes(r))
    )
  })).filter((s) => s.items.length > 0);

  const handleLogout = () => {
    setAuth({ accessToken: null, roleKeys: [] });
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Side panel */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
          <span className="h-9 w-9 rounded-xl bg-brand/20 ring-2 ring-brand/60" />
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand">CresOS</p>
            <p className="text-[10px] text-slate-400">Operating System for Growth</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand/15 text-brand border border-brand/40"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {roles.map((r) => (
              <span
                key={r}
                className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300"
              >
                {roleLabel(r)}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
