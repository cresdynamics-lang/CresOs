import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "./auth-context";

export const metadata = {
  title: "CresOS – Operating System for Growth",
  description:
    "CresOS connects visibility → leads → deals → delivery → invoices → revenue → analytics in one workflow."
};

const navItems = [
  { href: "/", label: "Story", roles: ["*"] },
  { href: "/dashboard", label: "Dashboard", roles: ["director_admin", "finance", "analyst"] },
  { href: "/crm", label: "CRM", roles: ["sales"] },
  { href: "/projects", label: "Projects", roles: ["ops", "director_admin"] },
  { href: "/finance", label: "Finance", roles: ["finance", "director_admin", "analyst"] },
  { href: "/analytics", label: "Analytics", roles: ["director_admin", "analyst", "finance"] },
  { href: "/approvals", label: "Approvals", roles: ["director_admin", "finance"] }
];

function ShellLayout({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const roles = auth.roleKeys;

  const visibleNav = navItems.filter((item) =>
    item.roles.includes("*") || item.roles.some((r) => roles.includes(r))
  );

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
          <header className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-xl bg-brand/20 ring-2 ring-brand/60" />
                <div>
                  <p className="text-sm font-semibold tracking-wide text-brand">
                    CresOS
                  </p>
                  <p className="text-xs text-slate-400">
                    Operating System for Growth
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>cresos.cresdynamics.com</span>
              {roles.length > 0 && (
                <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide">
                  {roles.join(" · ")}
                </span>
              )}
            </div>
          </header>
          <nav className="shell mb-2 flex flex-wrap gap-2 text-sm">
            {visibleNav.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ShellLayout>{children}</ShellLayout>
    </AuthProvider>
  );
}


