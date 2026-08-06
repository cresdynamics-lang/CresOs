"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { salesNeu } from "../../components/sales/sales-theme";
import { ALL_APP_ROLE_KEYS } from "../../lib/app-roles";

type NavGroup = "workspace" | "pipeline" | "delivery" | "review" | "app";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: NavGroup;
  roles: string[];
  match: "exact" | "prefix";
};

export type SalesCrmToggle = {
  href: string;
  label: string;
  roles: string[];
  match: "exact" | "prefix";
};

/** CRM activities — toggled after opening CRM in the side panel. */
export const SALES_CRM_TOGGLES: SalesCrmToggle[] = [
  { href: "/sales/messages", label: "Mails", roles: ["admin", "sales"], match: "prefix" },
  { href: "/sales/invoices", label: "Invoices", roles: ["admin", "sales"], match: "prefix" },
  { href: "/leads", label: "Leads", roles: ["admin", "director_admin", "sales", "finance"], match: "prefix" },
  { href: "/crm", label: "Contacts", roles: ["admin", "sales", "director_admin", "finance"], match: "prefix" },
  { href: "/schedule", label: "Tasks", roles: [...ALL_APP_ROLE_KEYS], match: "prefix" }
];

const CRM_PANEL_STORAGE_KEY = "cresos.sales.crmPanelOpen";

const SALES_NAV_ITEMS: NavItem[] = [
  {
    href: "/sales",
    label: "Overview",
    shortLabel: "Overview",
    group: "workspace",
    roles: ["admin", "sales", "director_admin", "finance"],
    match: "exact"
  },
  {
    href: "/sales/onboarding",
    label: "Playbook",
    shortLabel: "Playbook",
    group: "workspace",
    roles: ["admin", "sales", "director_admin"],
    match: "prefix"
  },
  {
    href: "/reports",
    label: "Sales reports",
    shortLabel: "Reports",
    group: "pipeline",
    roles: ["admin", "director_admin", "sales"],
    match: "prefix"
  },
  {
    href: "/projects",
    label: "Projects",
    group: "delivery",
    roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"],
    match: "prefix"
  },
  {
    href: "/approvals",
    label: "Approvals",
    group: "review",
    roles: ["admin", "director_admin", "finance"],
    match: "prefix"
  }
];

const SALES_APP_NAV: NavItem[] = [
  {
    href: "/community",
    label: "Community",
    shortLabel: "Community",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  },
  {
    href: "/settings/account",
    label: "Settings",
    shortLabel: "Settings",
    group: "app",
    roles: [...ALL_APP_ROLE_KEYS],
    match: "prefix"
  }
];

const GROUP_LABELS: Record<NavGroup, string> = {
  workspace: "Workspace",
  pipeline: "Pipeline",
  delivery: "Delivery",
  review: "Review",
  app: "App"
};

const GROUP_ORDER: NavGroup[] = ["workspace", "pipeline", "delivery", "review", "app"];

export function crmTogglesForRoles(roleKeys: string[]): SalesCrmToggle[] {
  return SALES_CRM_TOGGLES.filter((t) => t.roles.some((r) => roleKeys.includes(r)));
}

export function isSalesCrmPath(pathname: string): boolean {
  return SALES_CRM_TOGGLES.some((t) => isCrmToggleActive(pathname, t));
}

export function isCrmToggleActive(pathname: string, item: SalesCrmToggle): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function navForSalesRoles(roleKeys: string[]): NavItem[] {
  const main = SALES_NAV_ITEMS.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
  const app = SALES_APP_NAV.filter((item) => item.roles.some((r) => roleKeys.includes(r)));
  return [...main, ...app];
}

export function salesNavGroupsForRoles(roleKeys: string[]): { title: string; key: NavGroup; items: NavItem[] }[] {
  const visible = navForSalesRoles(roleKeys);
  return GROUP_ORDER.map((group) => ({
    title: GROUP_LABELS[group],
    key: group,
    items: visible.filter((item) => item.group === group)
  })).filter((g) => g.items.length > 0);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.href === "/settings/account") return pathname.startsWith("/settings");
  if (item.href === "/reports") {
    return (
      (pathname === "/reports" || pathname.startsWith("/reports/")) &&
      !pathname.startsWith("/reports/ai")
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Segmented CRM activity toggles (Mails · Invoices · Leads · …). */
export function SalesCrmToggleBar({
  onSelect,
  className = ""
}: {
  onSelect?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const toggles = crmTogglesForRoles(auth.roleKeys);

  if (toggles.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="CRM activities"
      className={`flex flex-wrap gap-1.5 ${className}`.trim()}
    >
      {toggles.map((item) => {
        const active = isCrmToggleActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect?.()}
            className={[
              "min-h-[36px] rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors touch-manipulation",
              active
                ? "bg-[#005CAB] text-white"
                : "border border-[#D1D1D1] bg-white text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB]"
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function SalesNavLinks({
  vertical = false,
  onNavigate
}: {
  vertical?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const groups = salesNavGroupsForRoles(auth.roleKeys);
  const crmToggles = useMemo(() => crmTogglesForRoles(auth.roleKeys), [auth.roleKeys]);
  const onCrmRoute = isSalesCrmPath(pathname);

  const [crmPanelOpen, setCrmPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CRM_PANEL_STORAGE_KEY);
      if (stored === "1") setCrmPanelOpen(true);
      else setCrmPanelOpen(false);
    } catch {
      setCrmPanelOpen(false);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CRM_PANEL_STORAGE_KEY, crmPanelOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [crmPanelOpen, hydrated]);

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? salesNeu.navActive : salesNeu.navIdle
    ].join(" ");

  const openCrmPanel = () => setCrmPanelOpen(true);
  const closeCrmPanel = () => setCrmPanelOpen(false);

  if (vertical) {
    if (crmPanelOpen) {
      return (
        <nav aria-label="Sales CRM" className="flex flex-col gap-3 px-2 py-3">
          <button
            type="button"
            onClick={closeCrmPanel}
            className="flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#005CAB] transition-colors hover:bg-[#F5F5F5]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="px-1">
            <p className={salesNeu.eyebrow}>CRM</p>
            <p className={`mt-0.5 ${salesNeu.sectionTitle}`}>Choose an activity</p>
            <p className={`mt-1 ${salesNeu.muted}`}>Mails, invoices, leads, contacts, and tasks.</p>
          </div>

          <div className="flex flex-col gap-1.5 px-1">
            {crmToggles.map((item) => {
              const active = isCrmToggleActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onNavigate?.();
                    closeCrmPanel();
                  }}
                  className={[
                    "flex min-h-[44px] items-center justify-between rounded-md border px-3 py-2.5 text-[13px] font-semibold transition-colors touch-manipulation",
                    active
                      ? "border-[#005CAB] bg-[#005CAB] text-white"
                      : "border-[#E1DFDD] bg-white text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB]"
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {active ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">Open</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      );
    }

    return (
      <nav aria-label="Sales workspace" className="flex flex-col gap-4 px-2 py-3">
        {groups.map((group) => (
          <div key={group.key}>
            {group.key === "app" ? (
              <div className="mx-2 mb-3 border-t border-[#E1DFDD] pt-3" aria-hidden />
            ) : null}
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A8886]">
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active)}
                    onClick={() => onNavigate?.()}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {group.key === "workspace" && crmToggles.length > 0 ? (
                <button
                  type="button"
                  onClick={openCrmPanel}
                  aria-pressed={onCrmRoute}
                  className={[
                    "min-h-[40px] rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all touch-manipulation lg:min-h-0",
                    onCrmRoute ? salesNeu.navActive : salesNeu.navIdle
                  ].join(" ")}
                >
                  CRM
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  // Horizontal: CRM opens hub; child routes keep CRM highlighted
  const flat = navForSalesRoles(auth.roleKeys);
  const horizontalItems: { key: string; href: string; label: string; active: boolean }[] = [];
  for (const item of flat) {
    horizontalItems.push({
      key: item.href + item.label,
      href: item.href,
      label: item.shortLabel ?? item.label,
      active: isActive(pathname, item)
    });
    if (item.href === "/sales" && crmToggles.length > 0) {
      horizontalItems.push({
        key: "crm-hub",
        href: "/sales/crm",
        label: "CRM",
        active: onCrmRoute || pathname.startsWith("/sales/crm")
      });
    }
  }

  return (
    <nav
      aria-label="Sales workspace"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {horizontalItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={linkClass(item.active)}
          onClick={() => onNavigate?.()}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SalesWorkspaceNav() {
  return <SalesNavLinks />;
}

export function SalesNav() {
  return <SalesNavLinks />;
}

export function SalesSideNav({ onNavigate }: { onNavigate?: () => void }) {
  return <SalesNavLinks vertical onNavigate={onNavigate} />;
}
