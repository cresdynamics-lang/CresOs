"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../app/auth-context";
import { SettingsProfilePhoto } from "./settings-profile-photo";

type SavedFields = {
  name: string;
  phone: string;
  notificationEmail: string;
};

function snapshotFields(
  name: string,
  phone: string,
  notificationEmail: string,
  loginEmail: string
): SavedFields {
  const notify = notificationEmail.trim();
  return {
    name: name.trim(),
    phone: phone.trim(),
    notificationEmail: notify === "" ? loginEmail : notify
  };
}

export type AccountProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profilePicture?: string | null;
  profileCompletedAt?: string | null;
};

type SettingsAccountFormProps = {
  /** Compact layout for the slide-over settings panel */
  variant?: "page" | "panel";
  showPhoto?: boolean;
  showExtendedLink?: boolean;
};

export function SettingsAccountForm({
  variant = "page",
  showPhoto = true,
  showExtendedLink = true
}: SettingsAccountFormProps) {
  const { apiFetch, patchAuth } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedFields | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const loginEmail = profile?.email ?? "";

  const isDirty = useMemo(() => {
    if (!saved || !profile) return false;
    const current = snapshotFields(name, phone, notificationEmail, loginEmail);
    return (
      current.name !== saved.name ||
      current.phone !== saved.phone ||
      current.notificationEmail !== saved.notificationEmail
    );
  }, [saved, profile, name, phone, notificationEmail, loginEmail]);

  const clearOkOnEdit = () => {
    setMessage((m) => (m?.type === "ok" ? null : m));
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch("/account/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          const p = data as AccountProfile;
          const loadedName = p.name ?? "";
          const loadedPhone = p.phone ?? "";
          const loadedNotify = p.notificationEmail ?? p.email ?? "";
          setProfile(p);
          setName(loadedName);
          setPhone(loadedPhone);
          setNotificationEmail(loadedNotify);
          setSaved(snapshotFields(loadedName, loadedPhone, loadedNotify, p.email));
          if (p.profilePicture) {
            patchAuth({ profilePicture: p.profilePicture, userName: p.name ?? undefined });
          } else if (p.name) {
            patchAuth({ userName: p.name });
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
        const data = (await res.json()) as AccountProfile;
        const nextName = data.name ?? "";
        const nextPhone = data.phone ?? "";
        const nextNotify = data.notificationEmail ?? data.email ?? "";
        setProfile((prev) => ({ ...prev, ...data }));
        setName(nextName);
        setPhone(nextPhone);
        setNotificationEmail(nextNotify);
        setSaved(snapshotFields(nextName, nextPhone, nextNotify, data.email));
        patchAuth({ userName: data.name ?? undefined });
        setMessage({ type: "ok", text: "Saved. Notifications will be sent to your notification email." });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cresos:profileCompleted"));
        }
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
    return <p className="text-slate-400">Loading…</p>;
  }

  const rootClass = variant === "page" ? "flex w-full max-w-3xl flex-col gap-8" : "space-y-4";

  return (
    <div className={rootClass}>
      {showPhoto && (
        <div className={variant === "page" ? "border-b border-slate-800/70 pb-8" : ""}>
          <SettingsProfilePhoto
            picturePath={profile.profilePicture}
            displayName={name.trim() || profile.name || profile.email}
            compact={variant === "panel"}
            onPictureChange={(path) => setProfile((p) => (p ? { ...p, profilePicture: path } : p))}
          />
        </div>
      )}

      <div>
        {variant === "page" && (
          <h3 className="mb-1 font-display text-sm font-semibold text-slate-100 sm:text-base">Account</h3>
        )}
        <p className="mb-4 text-xs text-slate-400 sm:text-sm">
          Your notification email is used for reminders, meetings, and alerts.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                clearOkOnEdit();
                setName(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="Your name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Login email (read-only)</span>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Notification email</span>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => {
                clearOkOnEdit();
                setNotificationEmail(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="Email for reminders and alerts"
            />
            <p className="mt-1 text-[10px] text-slate-500">Leave empty to use your login email.</p>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                clearOkOnEdit();
                setPhone(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="Your phone number"
            />
          </label>
          {message?.type === "ok" && !isDirty && (
            <p className="text-sm text-emerald-400">{message.text}</p>
          )}
          {message?.type === "error" && (
            <p className="text-sm text-rose-400">{message.text}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {(isDirty || saving) && (
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
            {showExtendedLink && variant === "page" && (
              <Link href="/settings/profile" className="text-sm text-sky-400 hover:underline">
                Contact details & next of kin →
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
