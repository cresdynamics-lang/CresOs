"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import { SettingsAccountForm } from "../components/settings-account-form";
import { useWorkspaceLogout } from "../lib/use-workspace-logout";

type TabId = "account" | "preferences";

type Props = { open: boolean; onClose: () => void; initialTab?: TabId };

const TABS: { id: TabId; label: string; description: string }[] = [
  { id: "account", label: "Account", description: "Profile, name & contact" },
  { id: "preferences", label: "Preferences", description: "Notifications & alerts" }
];

export function SettingsPanel({ open, onClose, initialTab }: Props) {
  const [tab, setTab] = useState<TabId>(initialTab ?? "account");
  const handleLogout = useWorkspaceLogout();

  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0c1018] shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick settings</p>
            <h2 id="settings-panel-title" className="font-display text-lg font-semibold text-slate-50">
              Account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            aria-label="Close settings"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-4 py-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "flex-1 rounded-lg px-3 py-2.5 text-left transition-colors",
                  tab === t.id
                    ? "border border-brand/35 bg-brand/10"
                    : "border border-transparent hover:bg-white/[0.04]"
                ].join(" ")}
              >
                <span className={`block text-sm font-medium ${tab === t.id ? "text-sky-100" : "text-slate-300"}`}>
                  {t.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{t.description}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {tab === "account" && <SettingsAccountForm variant="panel" showExtendedLink={false} />}
            {tab === "preferences" && <NotificationPreferencesForm />}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-white/[0.06] px-5 py-4">
          <Link
            href="/settings/account"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.07]"
          >
            Open full account settings
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              handleLogout();
            }}
            className="flex w-full items-center justify-center rounded-lg border border-rose-500/25 bg-rose-950/25 px-4 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-950/40"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
