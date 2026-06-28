"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../app/auth-context";
import { SettingsProfilePhoto } from "./settings-profile-photo";
import {
  SettingsField,
  SettingsFormGrid,
  SettingsFormGridFull,
  SettingsHero,
  SettingsMessage,
  SettingsPage,
  SettingsPanel,
  SettingsSaveBar,
  SettingsSection,
  useSettingsTheme
} from "./settings/settings-primitives";

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
  const theme = useSettingsTheme();
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
  }, [apiFetch, patchAuth]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading account…</p>
      </div>
    );
  }

  const displayName = name.trim() || profile.name || profile.email;

  if (variant === "panel") {
    return (
      <div className="space-y-4">
        {showPhoto ? (
          <SettingsProfilePhoto
            picturePath={profile.profilePicture}
            displayName={displayName}
            compact
            onPictureChange={(path) => setProfile((p) => (p ? { ...p, profilePicture: path } : p))}
          />
        ) : null}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <SettingsField label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                clearOkOnEdit();
                setName(e.target.value);
              }}
              className={theme.input}
              placeholder="Your name"
            />
          </SettingsField>
          <SettingsField label="Login email (read-only)">
            <input type="email" value={profile.email} readOnly className={theme.inputReadonly} />
          </SettingsField>
          {message?.type === "error" ? <SettingsMessage type="error">{message.text}</SettingsMessage> : null}
          <SettingsSaveBar
            dirty={isDirty}
            saving={saving}
            onSave={() => void handleSubmit()}
            successMessage={message?.type === "ok" && !isDirty ? message.text : null}
          />
        </form>
      </div>
    );
  }

  return (
    <SettingsPage>
      {showPhoto ? (
        <SettingsHero>
          <SettingsProfilePhoto
            picturePath={profile.profilePicture}
            displayName={displayName}
            hero
            onPictureChange={(path) => setProfile((p) => (p ? { ...p, profilePicture: path } : p))}
          />
        </SettingsHero>
      ) : null}

      <SettingsPanel>
        <SettingsSection
          label="Profile"
          title="Account details"
          description="Your notification email is used for reminders, meetings, and alerts."
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
            <SettingsFormGrid>
              <SettingsField label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    clearOkOnEdit();
                    setName(e.target.value);
                  }}
                  className={theme.input}
                  placeholder="Your name"
                />
              </SettingsField>
              <SettingsField label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    clearOkOnEdit();
                    setPhone(e.target.value);
                  }}
                  className={theme.input}
                  placeholder="Your phone number"
                />
              </SettingsField>
              <SettingsField label="Login email (read-only)">
                <input type="email" value={profile.email} readOnly className={theme.inputReadonly} />
              </SettingsField>
              <SettingsField label="Notification email" hint="Leave empty to use your login email.">
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => {
                    clearOkOnEdit();
                    setNotificationEmail(e.target.value);
                  }}
                  className={theme.input}
                  placeholder="Email for reminders and alerts"
                />
              </SettingsField>
            </SettingsFormGrid>

            {message?.type === "error" ? <SettingsMessage type="error">{message.text}</SettingsMessage> : null}

            <SettingsFormGridFull className="flex flex-wrap items-center gap-4">
              {showExtendedLink ? (
                <Link href="/settings/profile" className={`text-sm ${theme.accentText} hover:underline`}>
                  Contact details & next of kin →
                </Link>
              ) : null}
            </SettingsFormGridFull>

            <SettingsSaveBar
              dirty={isDirty}
              saving={saving}
              onSave={() => void handleSubmit()}
              successMessage={message?.type === "ok" && !isDirty ? message.text : null}
            />
          </form>
        </SettingsSection>
      </SettingsPanel>
    </SettingsPage>
  );
}
