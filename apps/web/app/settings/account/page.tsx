"use client";

import Link from "next/link";
import { SettingsAccountForm } from "../../../components/settings-account-form";

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsAccountForm variant="page" />
      <div className="w-full max-w-3xl border-t border-slate-800/70 pt-8">
        <h3 className="mb-2 font-display text-sm font-semibold text-slate-200">Password</h3>
        <p className="mb-3 text-xs text-slate-400">
          Change your sign-in password on the Security page.
        </p>
        <Link
          href="/settings/security"
          className="inline-flex rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Open Security →
        </Link>
      </div>
    </div>
  );
}
