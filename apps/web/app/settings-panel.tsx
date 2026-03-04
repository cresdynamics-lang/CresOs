"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profileCompletedAt: string | null;
};

type Props = { open: boolean; onClose: () => void; initialTab?: "preferences" | "account" };

export function SettingsPanel({ open, onClose, initialTab }: Props) {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<"preferences" | "account">(initialTab ?? "account");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch("/account/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setProfile(data as Profile);
          setName(data.name ?? "");
          setPhone(data.phone ?? "");
          setNotificationEmail(data.notificationEmail ?? data.email ?? "");
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, apiFetch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/account/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
          notificationEmail: notificationEmail.trim() || null
        })
      });
      if (res.ok) {
        const data = (await res.json()) as Profile;
        setProfile(data);
        setMessage({ type: "ok", text: "Saved. Notifications will be sent to your notification email." });
      } else {
        setMessage({ type: "error", text: "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-50">Settings</h2>
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
        <div className="flex border-b border-slate-800">
          <button
            type="button"
            onClick={() => setTab("preferences")}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === "preferences"
                ? "border-b-2 border-brand text-brand"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Preferences
          </button>
          <button
            type="button"
            onClick={() => setTab("account")}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === "account"
                ? "border-b-2 border-brand text-brand"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Account
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "preferences" && (
            <div>
              <p className="text-sm text-slate-400">
                Notification preferences, display options, and other settings can be configured here in a future update.
              </p>
            </div>
          )}
          {tab === "account" && (
            <>
              <p className="mb-4 text-xs text-slate-400">
                Your notification email is used for reminders, meetings, and alerts.
              </p>
              {profile ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                      placeholder="Your name"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Login email (read-only)</span>
                    <input
                      type="email"
                      value={profile.email}
                      readOnly
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Notification email</span>
                    <input
                      type="email"
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                      placeholder="Email for reminders and alerts"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">Leave empty to use your login email.</p>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                      placeholder="Your phone number"
                    />
                  </label>
                  {message && (
                    <p className={message.type === "ok" ? "text-sm text-emerald-400" : "text-sm text-rose-400"}>
                      {message.text}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </form>
              ) : (
                <p className="text-slate-400">Loading…</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
