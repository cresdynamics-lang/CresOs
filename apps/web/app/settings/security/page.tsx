"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth-context";
import {
  SettingsField,
  SettingsFormGrid,
  SettingsMessage,
  SettingsPage,
  SettingsPanel,
  SettingsSaveBar,
  SettingsSection,
  SettingsToggle,
  useSettingsTheme
} from "../../../components/settings/settings-primitives";

type PasswordFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type SecurityPrefs = {
  login: { loginNotifications: boolean };
  [key: string]: unknown;
};

export default function SecurityPage() {
  const { apiFetch } = useAuth();
  const theme = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState<PasswordFields>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [savedPrefs, setSavedPrefs] = useState<SecurityPrefs>({
    login: { loginNotifications: true }
  });
  const [prefs, setPrefs] = useState<SecurityPrefs>({
    login: { loginNotifications: true }
  });
  const [fullSecurity, setFullSecurity] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/user/security");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { data?: Record<string, unknown> };
        const raw = data.data ?? {};
        setFullSecurity(raw);
        const next: SecurityPrefs = {
          ...raw,
          login: {
            loginNotifications:
              (raw.login as { loginNotifications?: boolean } | undefined)?.loginNotifications ?? true
          }
        };
        setPrefs(next);
        setSavedPrefs(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const prefsDirty = useMemo(
    () => prefs.login.loginNotifications !== savedPrefs.login.loginNotifications,
    [prefs, savedPrefs]
  );

  const changePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = password;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    setChangingPassword(true);
    setMessage(null);
    try {
      const res = await apiFetch("/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setMessage({ type: "ok", text: "Password changed successfully." });
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage({ type: "error", text: err.error ?? "Failed to change password." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setChangingPassword(false);
    }
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    setPrefsMessage(null);
    try {
      const res = await apiFetch("/user/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fullSecurity,
          login: prefs.login
        })
      });
      if (res.ok) {
        setSavedPrefs(prefs);
        setPrefsMessage("Sign-in preferences saved.");
      } else {
        setPrefsMessage("Could not save preferences.");
      }
    } catch {
      setPrefsMessage("Network error.");
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading security settings…</p>
      </div>
    );
  }

  return (
    <SettingsPage>
      <SettingsPanel>
        <SettingsSection
          label="Credentials"
          title="Change password"
          description="Use a strong password you do not reuse elsewhere."
        >
          <div className="flex flex-col gap-6">
            <SettingsFormGrid>
              <SettingsField label="Current password">
                <input
                  type="password"
                  value={password.currentPassword}
                  onChange={(e) => {
                    setMessage(null);
                    setPassword((p) => ({ ...p, currentPassword: e.target.value }));
                  }}
                  className={theme.input}
                  autoComplete="current-password"
                />
              </SettingsField>
              <SettingsField label="New password">
                <input
                  type="password"
                  value={password.newPassword}
                  onChange={(e) => {
                    setMessage(null);
                    setPassword((p) => ({ ...p, newPassword: e.target.value }));
                  }}
                  className={theme.input}
                  autoComplete="new-password"
                />
              </SettingsField>
              <div className="sm:col-span-2">
                <SettingsField label="Confirm new password">
                  <input
                    type="password"
                    value={password.confirmPassword}
                    onChange={(e) => {
                      setMessage(null);
                      setPassword((p) => ({ ...p, confirmPassword: e.target.value }));
                    }}
                    className={theme.input}
                    autoComplete="new-password"
                  />
                </SettingsField>
              </div>
            </SettingsFormGrid>
            {message ? <SettingsMessage type={message.type}>{message.text}</SettingsMessage> : null}
            <button
              type="button"
              disabled={changingPassword}
              onClick={() => void changePassword()}
              className={`self-start ${theme.btnPrimary}`}
            >
              {changingPassword ? "Updating…" : "Change password"}
            </button>
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSection
          label="Alerts"
          title="Sign-in alerts"
          description="Get notified when a new device signs in to your account."
        >
          <div className="max-w-2xl">
            <SettingsToggle
              label="Login notifications"
              description="Email alert when your account is accessed from a new session."
              on={prefs.login.loginNotifications}
              onChange={(loginNotifications) => {
                setPrefsMessage(null);
                setPrefs({ login: { loginNotifications } });
              }}
            />
            <SettingsSaveBar
              dirty={prefsDirty}
              saving={savingPrefs}
              onSave={() => void savePrefs()}
              label="Save sign-in preferences"
              successMessage={prefsMessage}
            />
          </div>
        </SettingsSection>
      </SettingsPanel>

      <SettingsPanel className="border-b-0">
        <p className="max-w-3xl text-sm text-slate-500">
          Two-factor authentication and remote session management are planned. Password changes take effect immediately.
        </p>
      </SettingsPanel>
    </SettingsPage>
  );
}
