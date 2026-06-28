"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_TABS = [
  { href: "/settings/account", label: "Account", desc: "Profile & photo" },
  { href: "/settings/preferences", label: "Preferences", desc: "Theme & locale" },
  { href: "/settings/notifications", label: "Notifications", desc: "Alerts & email" },
  { href: "/settings/security", label: "Security", desc: "Password & sessions" },
  { href: "/settings/profile", label: "Contact", desc: "Phones & next of kin" }
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsSideNav() {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    [
      "block min-h-[44px] rounded-lg px-3 py-2.5 touch-manipulation transition-colors lg:min-h-0",
      active
        ? "border border-brand/35 bg-brand/10 text-sky-100"
        : "border border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-200"
    ].join(" ");

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
                className={linkClass(active)}
              >
                <span className="block text-[13px] font-medium">{tab.label}</span>
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{tab.desc}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="border-t border-white/[0.06] pt-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </p>
        <Link
          href="/finance"
          className="block rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
        >
          ← Back to Finance
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
    description: "Choose which alerts you receive by email and in the app."
  },
  "/settings/security": {
    title: "Security",
    description: "Password, sessions, and sign-in safety."
  },
  "/settings/profile": {
    title: "Contact details",
    description: "Extra phones, work emails, and next of kin."
  }
};
