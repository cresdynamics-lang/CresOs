"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import { SettingsAccountForm } from "../components/settings-account-form";

type Props = { open: boolean; onClose: () => void; initialTab?: "preferences" | "account" };

export function SettingsPanel({ open, onClose, initialTab }: Props) {
  const [tab, setTab] = useState<"preferences" | "account">(initialTab ?? "account");

  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-slate-50">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close settings"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav className="group/hover-nav flex w-14 shrink-0 flex-col border-r border-slate-800 py-2 transition-[width] hover:w-44">
            {(
              [
                { id: "account" as const, label: "Account", icon: "A" },
                { id: "preferences" as const, label: "Preferences", icon: "P" }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`mx-1 flex items-center rounded-lg px-2 py-2 text-left text-sm ${
                  tab === t.id
                    ? "border border-brand/40 bg-brand/15 text-brand"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-semibold">
                  {t.icon}
                </span>
                <span className="min-w-0 overflow-hidden whitespace-nowrap opacity-0 w-0 transition-all duration-200 group-hover/hover-nav:ml-2 group-hover/hover-nav:w-auto group-hover/hover-nav:opacity-100">
                  {t.label}
                </span>
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "account" && (
            <SettingsAccountForm variant="panel" showExtendedLink={false} />
          )}
          {tab === "preferences" && <NotificationPreferencesForm />}
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-800 px-4 py-3">
          <Link href="/settings/account" onClick={onClose} className="text-sm text-sky-400 hover:underline">
            Open full settings →
          </Link>
        </div>
      </div>
    </>
  );
}
