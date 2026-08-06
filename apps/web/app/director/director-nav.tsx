"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { directorNeu } from "../../components/director/director-theme";

type NavGroup = "command" | "delivery" | "insights" | "app";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  group: NavGroup;
  match: "exact" | "prefix";
};

type PanelToggle = {
  href: string;
  label: string;
  match: "exact" | "prefix";
};

type PanelMode = "main" | "crm" | "reports";

/** Same CRM map as Sales — Mails · Invoices · Leads · Contacts · Tasks */
const DIRECTOR_CRM_TOGGLES: PanelToggle[] = [
  { href: "/sales/messages", label: "Mails", match: "prefix" },
  { href: "/sales/invoices", label: "Invoices", match: "prefix" },
  { href: "/leads", label: "Leads", match: "prefix" },
  { href: "/crm", label: "Contacts", match: "prefix" },
  { href: "/schedule", label: "Tasks", match: "prefix" }
];

/** Combined reports — Sales · Developers · AI */
const DIRECTOR_REPORTS_TOGGLES: PanelToggle[] = [
  { href: "/reports", label: "Sales", match: "prefix" },
  { href: "/developer-reports", label: "Developers", match: "prefix" },
  { href: "/reports/ai", label: "AI summaries", match: "prefix" }
];

const PANEL_STORAGE_KEY = "cresos.director.navPanel";

const DIRECTOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Command center", shortLabel: "Home", group: "command", match: "exact" },
  { href: "/director/onboarding", label: "Playbook", shortLabel: "Playbook", group: "command", match: "prefix" },
  { href: "/analytics", label: "Analytics", group: "command", match: "prefix" },
  { href: "/activity", label: "Activity log", shortLabel: "Activity", group: "command", match: "prefix" },
  { href: "/projects", label: "Projects", group: "delivery", match: "prefix" },
  { href: "/approvals", label: "Approvals", group: "insights", match: "prefix" },
  { href: "/community", label: "Community", group: "app", match: "prefix" },
  { href: "/settings/account", label: "Settings", group: "app", match: "prefix" }
];

const GROUP_LABELS: Record<NavGroup, string> = {
  command: "Command",
  delivery: "Delivery",
  insights: "Insights",
  app: "App"
};

const GROUP_ORDER: NavGroup[] = ["command", "delivery", "insights", "app"];

function isToggleActive(pathname: string, item: PanelToggle): boolean {
  if (item.href === "/reports") {
    return (
      (pathname === "/reports" || pathname.startsWith("/reports/")) && !pathname.startsWith("/reports/ai")
    );
  }
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isCrmPath(pathname: string): boolean {
  if (pathname.startsWith("/director/crm")) return true;
  return DIRECTOR_CRM_TOGGLES.some((t) => isToggleActive(pathname, t));
}

function isReportsPath(pathname: string): boolean {
  if (pathname.startsWith("/director/reports")) return true;
  return DIRECTOR_REPORTS_TOGGLES.some((t) => isToggleActive(pathname, t));
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.href === "/settings/account") return pathname.startsWith("/settings");
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function PanelActivityList({
  title,
  description,
  toggles,
  pathname,
  onBack,
  onSelect
}: {
  title: string;
  description: string;
  toggles: PanelToggle[];
  pathname: string;
  onBack: () => void;
  onSelect?: () => void;
}) {
  return (
    <nav aria-label={`Director ${title}`} className="flex flex-col gap-3 px-2 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#005CAB] transition-colors hover:bg-[#F5F5F5]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="px-1">
        <p className={directorNeu.eyebrow}>{title}</p>
        <p className={`mt-0.5 ${directorNeu.sectionTitle}`}>Choose an activity</p>
        <p className={`mt-1 text-[12px] font-medium text-[#8A8886]`}>{description}</p>
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        {toggles.map((item) => {
          const active = isToggleActive(pathname, item);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect?.()}
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

function DirectorNavLinks({
  vertical = false,
  onNavigate
}: {
  vertical?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = GROUP_ORDER.map((group) => ({
    key: group,
    title: GROUP_LABELS[group],
    items: DIRECTOR_NAV.filter((item) => item.group === group)
  }));

  const [panel, setPanel] = useState<PanelMode>("main");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);
      if (stored === "crm" || stored === "reports") setPanel(stored);
      else setPanel("main");
    } catch {
      setPanel("main");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PANEL_STORAGE_KEY, panel);
    } catch {
      // ignore
    }
  }, [panel, hydrated]);

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation lg:min-h-0"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
      active ? directorNeu.navActive : directorNeu.navIdle
    ].join(" ");

  const hubButtonClass = (active: boolean) =>
    [
      "min-h-[40px] w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all touch-manipulation lg:min-h-0",
      active ? directorNeu.navActive : directorNeu.navIdle
    ].join(" ");

  if (vertical && panel === "crm") {
    return (
      <PanelActivityList
        title="CRM"
        description="Mails, invoices, leads, contacts, and tasks — same map as Sales."
        toggles={DIRECTOR_CRM_TOGGLES}
        pathname={pathname}
        onBack={() => setPanel("main")}
        onSelect={() => {
          onNavigate?.();
          setPanel("main");
        }}
      />
    );
  }

  if (vertical && panel === "reports") {
    return (
      <PanelActivityList
        title="Reports"
        description="Toggle Sales, Developer, or AI summaries."
        toggles={DIRECTOR_REPORTS_TOGGLES}
        pathname={pathname}
        onBack={() => setPanel("main")}
        onSelect={() => {
          onNavigate?.();
          setPanel("main");
        }}
      />
    );
  }

  if (vertical) {
    return (
      <nav aria-label="Director workspace" className="flex flex-col gap-4 px-2 py-3">
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
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active)}
                    onClick={() => onNavigate?.()}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {group.key === "command" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel("crm")}
                    aria-pressed={isCrmPath(pathname)}
                    className={hubButtonClass(isCrmPath(pathname))}
                  >
                    CRM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel("reports")}
                    aria-pressed={isReportsPath(pathname)}
                    className={hubButtonClass(isReportsPath(pathname))}
                  >
                    Reports
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  // Horizontal strip — hubs + core links
  const horizontal: { key: string; href: string; label: string; active: boolean }[] = [
    { key: "home", href: "/dashboard", label: "Home", active: pathname === "/dashboard" },
    {
      key: "crm",
      href: "/director/crm",
      label: "CRM",
      active: isCrmPath(pathname) || pathname.startsWith("/director/crm")
    },
    {
      key: "reports",
      href: "/director/reports",
      label: "Reports",
      active: isReportsPath(pathname) || pathname.startsWith("/director/reports")
    },
    { key: "projects", href: "/projects", label: "Projects", active: pathname.startsWith("/projects") },
    { key: "approvals", href: "/approvals", label: "Approvals", active: pathname.startsWith("/approvals") },
    { key: "analytics", href: "/analytics", label: "Analytics", active: pathname.startsWith("/analytics") },
    { key: "community", href: "/community", label: "Community", active: pathname.startsWith("/community") }
  ];

  return (
    <nav
      aria-label="Director workspace"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {horizontal.map((item) => (
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

export function DirectorNav() {
  return <DirectorNavLinks />;
}

export function DirectorSideNav({ onNavigate }: { onNavigate?: () => void }) {
  return <DirectorNavLinks vertical onNavigate={onNavigate} />;
}
