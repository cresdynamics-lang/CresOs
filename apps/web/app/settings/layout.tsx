"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Settings</h2>
        <p className="text-sm text-slate-300">
          Manage your preferences and account details. Your notification email is used to send you reminders and alerts.
        </p>
      </div>
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <Link
          href="/settings"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === "/settings"
              ? "bg-brand/15 text-brand border border-brand/40"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          Preferences
        </Link>
        <Link
          href="/settings/account"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === "/settings/account"
              ? "bg-brand/15 text-brand border border-brand/40"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          Account
        </Link>
      </div>
      {children}
    </section>
  );
}
