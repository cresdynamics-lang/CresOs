"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth-context";
import { emitDataRefresh } from "../../data-refresh";
import {
  SettingsPage,
  SettingsPanel,
  SettingsSaveBar,
  SettingsSection,
  SettingsToggle,
  useSettingsTheme
} from "../../../components/settings/settings-primitives";

const VALID_TIER_IDS = new Set(["execution", "financial", "governance", "structural"]);

const TIERS: { id: string; label: string; hint: string }[] = [
  { id: "execution", label: "Execution", hint: "Tasks, reminders, delivery" },
  { id: "financial", label: "Financial", hint: "Invoices, payments, finance alerts" },
  { id: "governance", label: "Governance", hint: "Approvals, compliance, oversight" },
  { id: "structural", label: "Structural", hint: "Org and access changes" }
];

type InAppPrefs = {
  mutedTiers: string[];
  muteAllInApp: boolean;
  playCommunitySound: boolean;
};

type EmailChannelPrefs = {
  projects: boolean;
  tasks: boolean;
  messages: boolean;
  reports: boolean;
};

type FullNotificationPrefs = {
  email: EmailChannelPrefs & Record<string, boolean>;
  push: Record<string, boolean>;
  inApp: Record<string, boolean>;
  schedule: Record<string, boolean>;
  frequency: Record<string, boolean>;
};

function normalizeInApp(raw: unknown): InAppPrefs {
  if (!raw || typeof raw !== "object") {
    return { mutedTiers: [], muteAllInApp: false, playCommunitySound: false };
  }
  const o = raw as Record<string, unknown>;
  const muted = Array.isArray(o.mutedTiers)
    ? o.mutedTiers.filter((t): t is string => typeof t === "string" && VALID_TIER_IDS.has(t))
    : [];
  return {
    mutedTiers: Array.from(new Set(muted)),
    muteAllInApp: Boolean(o.muteAllInApp),
    playCommunitySound: Boolean(o.playCommunitySound)
  };
}

const DEFAULT_EMAIL: EmailChannelPrefs = {
  projects: true,
  tasks: true,
  messages: true,
  reports: false
};

const DEFAULT_NOTIFICATIONS: FullNotificationPrefs = {
  email: { ...DEFAULT_EMAIL, mentions: true, approvals: true, system: true },
  push: {
    projects: true,
    tasks: true,
    messages: true,
    mentions: true,
    approvals: true,
    reports: false,
    system: true
  },
  inApp: {
    projects: true,
    tasks: true,
    messages: true,
    mentions: true,
    approvals: true,
    reports: true,
    system: true
  },
  schedule: { meetingReminders: true, taskDeadlines: true, projectMilestones: true },
  frequency: { immediate: true, hourly: false, daily: false, weekly: false }
};

export default function NotificationsPage() {
  const { apiFetch } = useAuth();
  const theme = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [inApp, setInApp] = useState<InAppPrefs>({
    mutedTiers: [],
    muteAllInApp: false,
    playCommunitySound: false
  });
  const [savedInApp, setSavedInApp] = useState<InAppPrefs>(inApp);
  const [email, setEmail] = useState<EmailChannelPrefs>(DEFAULT_EMAIL);
  const [savedEmail, setSavedEmail] = useState<EmailChannelPrefs>(DEFAULT_EMAIL);
  const [fullNotifications, setFullNotifications] = useState<FullNotificationPrefs>(DEFAULT_NOTIFICATIONS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, notifRes] = await Promise.all([
        apiFetch("/account/me"),
        apiFetch("/user/notifications")
      ]);
      if (meRes.ok) {
        const me = (await meRes.json()) as { notificationPreferences?: unknown };
        const normalized = normalizeInApp(me.notificationPreferences);
        setInApp(normalized);
        setSavedInApp(normalized);
      }
      if (notifRes.ok) {
        const data = (await notifRes.json()) as { data?: Partial<FullNotificationPrefs> };
        const full: FullNotificationPrefs = {
          ...DEFAULT_NOTIFICATIONS,
          ...data.data,
          email: { ...DEFAULT_NOTIFICATIONS.email, ...data.data?.email }
        };
        setFullNotifications(full);
        const mergedEmail: EmailChannelPrefs = {
          projects: full.email.projects ?? true,
          tasks: full.email.tasks ?? true,
          messages: full.email.messages ?? true,
          reports: full.email.reports ?? false
        };
        setEmail(mergedEmail);
        setSavedEmail(mergedEmail);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const inAppDirty = useMemo(() => JSON.stringify(inApp) !== JSON.stringify(savedInApp), [inApp, savedInApp]);
  const emailDirty = useMemo(() => JSON.stringify(email) !== JSON.stringify(savedEmail), [email, savedEmail]);
  const dirty = inAppDirty || emailDirty;

  const toggleTier = (id: string) => {
    setSuccess(null);
    setInApp((prev) => {
      const muted = new Set(prev.mutedTiers);
      if (muted.has(id)) muted.delete(id);
      else muted.add(id);
      return { ...prev, mutedTiers: Array.from(muted) };
    });
  };

  const save = async () => {
    setSaving(true);
    setSuccess(null);
    try {
      const tasks: Promise<Response>[] = [];
      if (inAppDirty) {
        tasks.push(
          apiFetch("/account/me", {
            method: "PATCH",
            body: JSON.stringify({
              notificationPreferences: {
                muteAllInApp: inApp.muteAllInApp,
                mutedTiers: inApp.mutedTiers,
                playCommunitySound: inApp.playCommunitySound
              }
            })
          })
        );
      }
      if (emailDirty) {
        tasks.push(
          apiFetch("/user/notifications", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...fullNotifications,
              email: { ...fullNotifications.email, ...email }
            })
          })
        );
      }
      const results = await Promise.all(tasks);
      if (results.every((r) => r.ok)) {
        setSavedInApp(inApp);
        setSavedEmail(email);
        if (emailDirty) {
          setFullNotifications((prev) => ({ ...prev, email: { ...prev.email, ...email } }));
        }
        setSuccess("Notification settings saved.");
        emitDataRefresh();
      } else {
        setSuccess("Some settings could not be saved. Try again.");
      }
    } catch {
      setSuccess("Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading notification settings…</p>
      </div>
    );
  }

  return (
    <SettingsPage>
      <SettingsPanel>
        <SettingsSection
          label="In-app"
          title="In-app bell"
          description="Control what appears in your notification feed and badge count."
        >
          <div className="max-w-3xl space-y-4">
            <SettingsToggle
              label="Play sound for Community messages"
              description="Short sound for incoming community chat (browser may require a click first)."
              on={inApp.playCommunitySound}
              onChange={(playCommunitySound) => {
                setSuccess(null);
                setInApp((p) => ({ ...p, playCommunitySound }));
              }}
            />
            <SettingsToggle
              label="Mute all in-app notifications"
              description="Hides the feed and clears the badge until turned off."
              on={inApp.muteAllInApp}
              onChange={(muteAllInApp) => {
                setSuccess(null);
                setInApp((p) => ({ ...p, muteAllInApp }));
              }}
            />
            <div className={inApp.muteAllInApp ? "pointer-events-none opacity-40" : ""}>
              <p className={`mb-3 ${theme.sectionLabel}`}>Hide by category</p>
              <ul className="space-y-2">
                {TIERS.map((t) => (
                  <li key={t.id} className={theme.listRow}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={inApp.mutedTiers.includes(t.id)}
                        onChange={() => toggleTier(t.id)}
                        className="mt-1 rounded border-slate-600"
                      />
                      <span>
                        <span className="block text-sm text-slate-200">{t.label}</span>
                        <span className="text-xs text-slate-500">{t.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection
          label="Email"
          title="Email channels"
          description="Choose which topics can email your notification address."
        >
          <div className="max-w-3xl space-y-3">
            {(
              [
                ["projects", "Projects", "Assignments and project updates"],
                ["tasks", "Tasks", "Deadlines and schedule reminders"],
                ["messages", "Messages", "Community and direct messages"],
                ["reports", "Reports", "Developer and leadership report digests"]
              ] as const
            ).map(([key, label, hint]) => (
              <SettingsToggle
                key={key}
                label={label}
                description={hint}
                on={email[key]}
                onChange={(next) => {
                  setSuccess(null);
                  setEmail((p) => ({ ...p, [key]: next }));
                }}
              />
            ))}
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsSaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        label="Save notification settings"
        successMessage={success}
      />
    </SettingsPage>
  );
}
