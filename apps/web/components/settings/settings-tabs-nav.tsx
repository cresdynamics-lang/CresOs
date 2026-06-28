"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsTheme } from "./settings-primitives";

export const SETTINGS_TABS = [
  { href: "/settings/account", label: "Account", short: "Account" },
  { href: "/settings/preferences", label: "Preferences", short: "Prefs" },
  { href: "/settings/notifications", label: "Notifications", short: "Alerts" },
  { href: "/settings/security", label: "Security", short: "Security" },
  { href: "/settings/profile", label: "Contact", short: "Contact" }
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontal settings section nav — lives in the main content column. */
export function SettingsTabsNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const theme = useSettingsTheme();

  return (
    <nav
      aria-label="Settings sections"
      className={
        compact
          ? "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-wrap gap-2"
      }
    >
      {SETTINGS_TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              compact
                ? "min-h-[40px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation"
                : "rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all",
              active ? theme.navActive : theme.navIdle
            ].join(" ")}
          >
            {compact ? tab.short : tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
