"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import {
  SettingsField,
  SettingsFormGrid,
  SettingsMessage,
  SettingsPage,
  SettingsPanel,
  SettingsSaveBar,
  SettingsSection,
  useSettingsTheme
} from "../../../components/settings/settings-primitives";

type NextOfKin = { name: string; phone: string; relationship: string };

type ContactProfile = {
  name: string;
  email: string;
  phoneNumbers: string[];
  workEmails: string[];
  nextOfKin: NextOfKin[];
  role: string;
  department: string;
};

const EMPTY_KIN: NextOfKin = { name: "", phone: "", relationship: "" };

function normalizeContact(data: Partial<ContactProfile> & { data?: Partial<ContactProfile> }): ContactProfile {
  const d = (data.data ?? data) as Partial<ContactProfile>;
  return {
    name: d.name ?? "",
    email: d.email ?? "",
    phoneNumbers: d.phoneNumbers?.length ? [...d.phoneNumbers] : [""],
    workEmails: d.workEmails?.length ? [...d.workEmails] : [""],
    nextOfKin:
      d.nextOfKin?.length && d.nextOfKin.length >= 2
        ? d.nextOfKin.map((k) => ({ ...EMPTY_KIN, ...k }))
        : [
            { ...EMPTY_KIN, ...(d.nextOfKin?.[0] ?? {}) },
            { ...EMPTY_KIN, ...(d.nextOfKin?.[1] ?? {}) }
          ],
    role: d.role ?? "",
    department: d.department ?? ""
  };
}

function payloadFrom(profile: ContactProfile) {
  return {
    name: profile.name.trim() || undefined,
    phoneNumbers: profile.phoneNumbers.map((p) => p.trim()).filter(Boolean),
    workEmails: profile.workEmails.map((e) => e.trim()).filter(Boolean),
    nextOfKin: profile.nextOfKin.filter((k) => k.name.trim() && k.phone.trim())
  };
}

function snapshot(profile: ContactProfile) {
  return JSON.stringify(payloadFrom(profile));
}

export default function ProfileSettingsPage() {
  const { apiFetch } = useAuth();
  const theme = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [savedSnap, setSavedSnap] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/user/profile");
      if (res.ok) {
        const data = await res.json();
        const next = normalizeContact(data);
        setProfile(next);
        setSavedSnap(snapshot(next));
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(
    () => (profile ? snapshot(profile) !== savedSnap : false),
    [profile, savedSnap]
  );

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFrom(profile))
      });
      if (res.ok) {
        setSavedSnap(snapshot(profile));
        setMessage({ type: "ok", text: "Contact details saved." });
      } else {
        setMessage({ type: "error", text: "Failed to save contact details." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  const updateList = (
    key: "phoneNumbers" | "workEmails",
    index: number,
    value: string
  ) => {
    if (!profile) return;
    const list = [...profile[key]];
    list[index] = value;
    setMessage(null);
    setProfile({ ...profile, [key]: list });
  };

  const addListItem = (key: "phoneNumbers" | "workEmails") => {
    if (!profile) return;
    setProfile({ ...profile, [key]: [...profile[key], ""] });
  };

  const removeListItem = (key: "phoneNumbers" | "workEmails", index: number) => {
    if (!profile || profile[key].length <= 1) return;
    setProfile({ ...profile, [key]: profile[key].filter((_, i) => i !== index) });
  };

  const updateKin = (index: number, field: keyof NextOfKin, value: string) => {
    if (!profile) return;
    const next = [...profile.nextOfKin];
    next[index] = { ...next[index], [field]: value };
    setMessage(null);
    setProfile({ ...profile, nextOfKin: next });
  };

  if (loading || !profile) {
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading contact details…</p>
      </div>
    );
  }

  return (
    <SettingsPage>
      <SettingsPanel className="!py-5">
        <p className="text-sm text-slate-400">
          <Link href="/settings/account" className={`${theme.accentText} hover:underline`}>
            ← Account
          </Link>
          {" · "}
          Name and notification email are managed on the Account tab.
        </p>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection
          label="Contact"
          title="Phone numbers"
          description="Additional numbers beyond your primary account phone."
        >
          <div className="max-w-2xl space-y-2">
            {profile.phoneNumbers.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => updateList("phoneNumbers", index, e.target.value)}
                  className={theme.input}
                  placeholder="+254 7XX XXX XXX"
                />
                {profile.phoneNumbers.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeListItem("phoneNumbers", index)}
                    className={`shrink-0 ${theme.btnGhost}`}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={() => addListItem("phoneNumbers")} className={theme.btnGhost}>
              + Add phone
            </button>
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection label="Contact" title="Work emails" description="Alternate work addresses for outreach.">
          <div className="max-w-2xl space-y-2">
            {profile.workEmails.map((email, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => updateList("workEmails", index, e.target.value)}
                  className={theme.input}
                  placeholder="work@company.com"
                />
                {profile.workEmails.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeListItem("workEmails", index)}
                    className={`shrink-0 ${theme.btnGhost}`}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={() => addListItem("workEmails")} className={theme.btnGhost}>
              + Add email
            </button>
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection
          label="Emergency"
          title="Next of kin"
          description="Emergency contacts kept on file for your organization."
        >
          <div className="max-w-4xl space-y-4">
            {profile.nextOfKin.map((kin, index) => (
              <div key={index} className="grid gap-3 border-b border-white/[0.06] pb-5 last:border-b-0 last:pb-0 sm:grid-cols-3">
                <SettingsField label={`Contact ${index + 1} — name`}>
                  <input
                    type="text"
                    value={kin.name}
                    onChange={(e) => updateKin(index, "name", e.target.value)}
                    className={theme.input}
                    placeholder="Full name"
                  />
                </SettingsField>
                <SettingsField label="Phone">
                  <input
                    type="tel"
                    value={kin.phone}
                    onChange={(e) => updateKin(index, "phone", e.target.value)}
                    className={theme.input}
                    placeholder="Phone number"
                  />
                </SettingsField>
                <SettingsField label="Relationship">
                  <input
                    type="text"
                    value={kin.relationship}
                    onChange={(e) => updateKin(index, "relationship", e.target.value)}
                    className={theme.input}
                    placeholder="Spouse, parent, sibling…"
                  />
                </SettingsField>
              </div>
            ))}
          </div>
        </SettingsSection>
      </SettingsPanel>

      {(profile.role || profile.department) && (
        <SettingsPanel>
          <SettingsSection label="Organization" title="Your role" description="Assigned by your administrator.">
            <SettingsFormGrid>
              {profile.role ? (
                <SettingsField label="Role (read-only)">
                  <input type="text" value={profile.role} readOnly className={theme.inputReadonly} />
                </SettingsField>
              ) : null}
              {profile.department ? (
                <SettingsField label="Department (read-only)">
                  <input type="text" value={profile.department} readOnly className={theme.inputReadonly} />
                </SettingsField>
              ) : null}
            </SettingsFormGrid>
          </SettingsSection>
        </SettingsPanel>
      )}

      {message?.type === "error" ? (
        <div className="px-4 sm:px-6 lg:px-8">
          <SettingsMessage type="error">{message.text}</SettingsMessage>
        </div>
      ) : null}

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void save()}
        successMessage={message?.type === "ok" && !isDirty ? message.text : null}
      />
    </SettingsPage>
  );
}
