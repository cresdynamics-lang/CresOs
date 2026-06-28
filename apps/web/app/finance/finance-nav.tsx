"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { financeNeu } from "../../components/finance/finance-theme";

export type FinanceSection =
  | "overview"
  | "messages"
  | "invoices"
  | "payments"
  | "expenses"
  | "ledger"
  | "projects"
  | "project_analysis"
  | "clients_due"
  | "approvals"
  | "reports";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  section: FinanceSection;
  group: "overview" | "records" | "projects" | "review";
  roles: string[];
  match?: "exact" | "prefix";
};

/** Single source of truth — role-filtered at render time. */
const FINANCE_NAV_ITEMS: NavItem[] = [
  {
    href: "/finance",
    label: "Overview",
    shortLabel: "Overview",
    section: "overview",
    group: "overview",
    roles: ["admin", "finance", "analyst", "director_admin"],
    match: "exact"
  },
  {
    href: "/finance/messages",
    label: "Mails",
    shortLabel: "Mails",
    section: "messages",
    group: "overview",
    roles: ["admin", "finance"]
  },
  {
    href: "/finance/invoices",
    label: "Invoices",
    section: "invoices",
    group: "records",
    roles: ["admin", "finance", "analyst", "director_admin"]
  },
  {
    href: "/finance/payments",
    label: "Payments",
    section: "payments",
    group: "records",
    roles: ["admin", "finance", "analyst", "director_admin"]
  },
  {
    href: "/finance/expenses",
    label: "Expenses",
    section: "expenses",
    group: "records",
    roles: ["admin", "finance"]
  },
  {
    href: "/finance/ledger",
    label: "All transactions",
    shortLabel: "Ledger",
    section: "ledger",
    group: "records",
    roles: ["admin", "finance", "analyst", "director_admin"]
  },
  {
    href: "/finance/projects",
    label: "Projects status",
    shortLabel: "Projects",
    section: "projects",
    group: "projects",
    roles: ["admin", "finance", "analyst", "director_admin"]
  },
  {
    href: "/finance/clients-due",
    label: "Clients due",
    shortLabel: "Due",
    section: "clients_due",
    group: "projects",
    roles: ["admin", "finance"]
  },
  {
    href: "/finance/projects/analysis",
    label: "Project analysis",
    shortLabel: "Analysis",
    section: "project_analysis",
    group: "projects",
    roles: ["admin"]
  },
  {
    href: "/approvals",
    label: "Approvals",
    section: "approvals",
    group: "review",
    roles: ["admin", "director_admin", "finance"]
  },
  {
    href: "/finance/reports",
    label: "Reports",
    section: "reports",
    group: "review",
    roles: ["admin", "finance", "analyst", "director_admin"]
  }
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  overview: "Workspace",
  records: "Records",
  projects: "Projects",
  review: "Review"
};

const GROUP_ORDER: NavItem["group"][] = ["overview", "records", "projects", "review"];

export function navForRoles(roleKeys: string[]): NavItem[] {
  return FINANCE_NAV_ITEMS.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
}

export function navGroupsForRoles(roleKeys: string[]): { title: string; items: NavItem[] }[] {
  const visible = navForRoles(roleKeys);
  return GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    items: visible.filter((item) => item.group === group)
  })).filter((g) => g.items.length > 0);
}

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.href === "/finance") return pathname === "/finance";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function FinanceNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const groups = navGroupsForRoles(auth.roleKeys);

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start touch-manipulation rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:min-h-0 sm:py-2",
      active ? financeNeu.navActive : financeNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Finance sections" className="flex flex-col gap-4 px-2 py-3">
        {groups.map((group) => (
          <div key={group.title}>
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

  const flat = navForRoles(auth.roleKeys);
  return (
    <nav
      aria-label="Finance sections"
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

export function FinanceNav() {
  return <FinanceNavLinks />;
}

export function FinanceSideNav() {
  return <FinanceNavLinks vertical />;
}

export const FINANCE_PAGE_TITLES: Record<FinanceSection, { title: string; description: string }> = {
  overview: {
    title: "Finance overview",
    description: "Invoices, payments, expenses, and cash flow in one place. All amounts in Kenyan Shillings (KES)."
  },
  messages: {
    title: "Finance mail",
    description: "Send and track finance emails to clients and internal recipients."
  },
  invoices: {
    title: "Invoices",
    description: "Create and manage invoices linked to clients and projects."
  },
  payments: {
    title: "Payments",
    description:
      "Client revenue in — record confirmed invoice payments. Clients receive an automatic receipt with project progress."
  },
  expenses: {
    title: "Expenses",
    description:
      "Outflows — HR salaries & payroll, developer project payments, tools, and ops. Beneficiaries and admins are notified automatically."
  },
  ledger: {
    title: "All transactions",
    description: "Unified ledger: payments in, expenses and payouts out."
  },
  projects: {
    title: "Projects status",
    description: "Allocated vs received per project; keep amounts aligned with bank reality."
  },
  project_analysis: {
    title: "Project analysis",
    description: "Aggregate finance totals across approved projects."
  },
  clients_due: {
    title: "Clients due",
    description: "Outstanding balances and monthly reminder days per client."
  },
  approvals: {
    title: "Approvals",
    description: "Review and approve pending expenses, payouts, and finance items."
  },
  reports: {
    title: "Financial reports",
    description:
      "Download or email period reports (weekly, monthly, 6 months, yearly, custom). Payments in vs HR salaries & project ops out."
  }
};
