"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profileCompletedAt: string | null;
};

export default function AccountPage() {
  const { apiFetch } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/account/me")
      .then((res) => res.ok ? res.json() : null)
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
  }, [apiFetch]);

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

  if (!profile) {
    return (
      <div className="shell">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="shell max-w-xl">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Personal information</h3>
      <p className="mb-4 text-xs text-slate-400">
        Add your details so you can receive notifications. The notification email is used for reminders, meetings, and alerts.
      </p>
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
    </div>
  );
}
