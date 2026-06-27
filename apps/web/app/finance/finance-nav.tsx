"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { financeNeu } from "../../components/finance/finance-theme";

export type FinanceSection =
  | "overview"
  | "invoices"
  | "payments"
  | "expenses"
  | "ledger"
  | "projects"
  | "project_analysis"
  | "clients_due";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  section: FinanceSection;
  /** Show if user has any of these roles */
  roles: string[];
};

const ADMIN_NAV: NavItem[] = [
  { href: "/finance", label: "Overview", shortLabel: "Overview", section: "overview", roles: ["admin", "finance", "analyst", "director_admin"] },
  { href: "/finance/messages", label: "Mails", shortLabel: "Mails", section: "overview", roles: ["admin", "finance"] },
  { href: "/finance/invoices", label: "Invoices", section: "invoices", roles: ["admin", "finance", "analyst", "director_admin"] },
  { href: "/finance/payments", label: "Payments", section: "payments", roles: ["admin", "finance", "analyst", "director_admin"] },
  { href: "/finance/expenses", label: "Expenses", section: "expenses", roles: ["admin"] },
  { href: "/finance/projects", label: "Projects status", shortLabel: "Projects", section: "projects", roles: ["admin", "finance", "analyst", "director_admin"] },
  { href: "/finance/projects/analysis", label: "Project analysis", shortLabel: "Analysis", section: "project_analysis", roles: ["admin"] },
  { href: "/finance/ledger", label: "All transactions", shortLabel: "Ledger", section: "ledger", roles: ["admin", "finance", "analyst", "director_admin"] }
];

const FINANCE_NAV: NavItem[] = [
  { href: "/finance", label: "Overview", shortLabel: "Overview", section: "overview", roles: ["finance"] },
  { href: "/finance/messages", label: "Mails", shortLabel: "Mails", section: "overview", roles: ["finance"] },
  { href: "/finance/invoices", label: "Invoices", section: "invoices", roles: ["finance"] },
  { href: "/finance/payments", label: "Payments", section: "payments", roles: ["finance"] },
  { href: "/finance/expenses", label: "Expenses", section: "expenses", roles: ["finance"] },
  { href: "/finance/projects", label: "Projects status", shortLabel: "Projects", section: "projects", roles: ["finance"] },
  { href: "/finance/clients-due", label: "Clients due", shortLabel: "Due", section: "clients_due", roles: ["finance"] },
  { href: "/finance/ledger", label: "All transactions", shortLabel: "Ledger", section: "ledger", roles: ["finance"] }
];

function navForRoles(roleKeys: string[]): NavItem[] {
  const isAdmin = roleKeys.includes("admin");
  const isFinance = roleKeys.includes("finance");
  if (isAdmin) return ADMIN_NAV;
  if (isFinance) return FINANCE_NAV;
  return ADMIN_NAV.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
}

export function FinanceNav() {
  const pathname = usePathname();
  const { auth } = useAuth();
  const items = navForRoles(auth.roleKeys);

  return (
    <nav
      aria-label="Finance sections"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === "/finance"
            ? pathname === "/finance"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "min-h-[44px] shrink-0 snap-start touch-manipulation rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:min-h-0 sm:py-2",
              active ? financeNeu.navActive : financeNeu.navIdle
            ].join(" ")}
          >
            <span className="whitespace-nowrap sm:hidden">{item.shortLabel ?? item.label}</span>
            <span className="hidden whitespace-nowrap sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const FINANCE_PAGE_TITLES: Record<FinanceSection, { title: string; description: string }> = {
  overview: {
    title: "Finance overview",
    description:
      "Invoices, payments, expenses, and payouts in one place. All amounts in Kenyan Shillings (KES)."
  },
  invoices: {
    title: "Invoices",
    description: "View and download invoices linked to projects. Create new invoices with the button above."
  },
  payments: {
    title: "Payments",
    description: "Record and confirm payments; match to invoices for cash flow and project received amounts."
  },
  expenses: {
    title: "Expenses",
    description: "Expense requests and approvals. Finance submits; admin approves in Approvals."
  },
  ledger: {
    title: "All transactions",
    description: "Unified ledger: payments in, expenses and payouts out."
  },
  projects: {
    title: "Projects finance status",
    description: "Allocated vs received per project; update amounts to match bank reality."
  },
  project_analysis: {
    title: "Project finance analysis",
    description: "Aggregate totals across approved projects."
  },
  clients_due: {
    title: "Clients due",
    description: "Outstanding balances and monthly reminder days per client."
  }
};
