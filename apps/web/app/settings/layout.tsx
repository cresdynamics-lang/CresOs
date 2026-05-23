"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CollapsibleHoverSidebar } from "../../components/collapsible-hover-sidebar";
import { resolveRoleTheme } from "../../components/dashboard-welcome-banner";
import { useAuth } from "../auth-context";

const TAB_COPY: Record<string, { title: string; description: string }> = {
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

const SETTINGS_TABS = [
  { href: "/settings/account", label: "Account", icon: "A" },
  { href: "/settings/preferences", label: "Preferences", icon: "P" },
  { href: "/settings/notifications", label: "Notifications", icon: "N" },
  { href: "/settings/security", label: "Security", icon: "S" },
  { href: "/settings/profile", label: "Contact", icon: "C" }
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const theme = resolveRoleTheme(auth.roleKeys);
  const copy = TAB_COPY[pathname] ?? { title: "Settings", description: "Manage your workspace profile and preferences." };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <CollapsibleHoverSidebar
        className="max-lg:hidden"
        header={
          <div className="flex items-center gap-0 px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/20 text-xs font-bold text-brand">
              ⚙
            </span>
            <span className="min-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-slate-200 opacity-0 w-0 transition-all duration-200 group-hover/hover-nav:ml-2 group-hover/hover-nav:w-auto group-hover/hover-nav:opacity-100">
              Settings
            </span>
          </div>
        }
        items={SETTINGS_TABS.map((tab) => ({
          href: tab.href,
          label: tab.label,
          icon: tab.icon,
          active: pathname === tab.href
        }))}
      />

      {/* Mobile: horizontal tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-3 py-2 lg:hidden">
        {SETTINGS_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === tab.href
                ? "bg-brand/15 text-brand"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-slate-800/80 px-4 py-5 sm:px-8 sm:py-6">
          <p className="font-label text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">
            Settings
          </p>
          <h1
            className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r ${theme.nameGradient} bg-clip-text text-transparent`}
          >
            {copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{copy.description}</p>
        </header>
        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
