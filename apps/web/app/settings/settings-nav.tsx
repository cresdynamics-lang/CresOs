"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsTheme } from "../../components/settings/settings-primitives";
import { SETTINGS_TABS } from "../../components/settings/settings-tabs-nav";
import { settingsBackLink } from "../../lib/resolve-settings-workspace";
import type { SettingsWorkspaceKey } from "../../lib/resolve-settings-workspace";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Settings-only sidebar for users without a dedicated workspace (global chrome). */
export function SettingsSideNav({ workspaceKey = "global" }: { workspaceKey?: SettingsWorkspaceKey }) {
  const pathname = usePathname();
  const theme = useSettingsTheme();
  const back = settingsBackLink(workspaceKey);

  return (
    <nav aria-label="Settings" className="flex flex-col gap-4 px-2 py-3">
      <div>
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Your account
        </p>
        <div className="flex flex-col gap-0.5">
          {SETTINGS_TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`block min-h-[44px] rounded-lg px-3 py-2.5 touch-manipulation transition-all lg:min-h-0 ${
                  active ? theme.navActive : theme.navIdle
                }`}
              >
                <span className="block text-[13px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="border-t border-white/[0.06] pt-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </p>
        <Link href={back.href} className={`block rounded-lg px-3 py-2 text-[13px] font-medium ${theme.navIdle}`}>
          {back.label}
        </Link>
      </div>
    </nav>
  );
}

export const SETTINGS_TAB_COPY: Record<string, { title: string; description: string }> = {
  "/settings/account": {
    title: "Account",
    description: "Profile photo, name, phone, and where we send reminders and alerts."
  },
  "/settings/preferences": {
    title: "Preferences",
    description: "Theme, language, timezone, and how the app looks and behaves."
  },
  "/settings/notifications": {
    title: "Notifications",
    description: "Control in-app alerts, sounds, and email notification channels."
  },
  "/settings/security": {
    title: "Security",
    description: "Change your password and manage sign-in preferences."
  },
  "/settings/profile": {
    title: "Contact details",
    description: "Extra phones, work emails, and next of kin for emergencies."
  }
};
