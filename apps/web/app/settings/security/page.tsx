"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

export default function SecurityPage() {
  const { auth, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [security, setSecurity] = useState({
    password: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    },
    twoFactor: {
      enabled: false,
      method: "sms", // sms, email, app
      phoneNumber: "",
      backupCodes: []
    },
    sessions: {
      autoLogout: 30, // minutes
      requireReauth: false,
      activeSessions: []
    },
    privacy: {
      dataSharing: false,
      analytics: true,
      marketing: false,
      cookies: true
    },
    login: {
      requireTwoFactor: false,
      allowedIPs: [],
      loginNotifications: true
    }
  });

  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  const fetchSecuritySettings = async () => {
    try {
      const response = await apiFetch("/user/security");
      if (response.ok) {
        const data = await response.json();
        setSecurity({ ...security, ...data.data });
      }
    } catch (error) {
      console.error("Failed to fetch security settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSecuritySettings = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/user/security", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(security)
      });

      if (response.ok) {
        alert("Security settings updated successfully!");
      }
    } catch (error) {
      console.error("Failed to update security settings:", error);
      alert("Failed to update security settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = security.password;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New password and confirmation do not match");
      return;
    }

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long");
      return;
    }

    try {
      const response = await apiFetch("/account/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (response.ok) {
        alert("Password changed successfully!");
        setSecurity({
          ...security,
          password: { currentPassword: "", newPassword: "", confirmPassword: "" }
        });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to change password");
      }
    } catch (error) {
      console.error("Failed to change password:", error);
      alert("Failed to change password. Please try again.");
    }
  };

  const toggleTwoFactor = async () => {
    if (!security.twoFactor.enabled) {
      // Enable 2FA
      alert("Two-factor authentication setup will be implemented soon");
    } else {
      // Disable 2FA
      try {
        const response = await apiFetch("/user/disable-2fa", {
          method: "POST"
        });

        if (response.ok) {
          setSecurity({
            ...security,
            twoFactor: { ...security.twoFactor, enabled: false }
          });
          alert("Two-factor authentication disabled");
        }
      } catch (error) {
        console.error("Failed to disable 2FA:", error);
        alert("Failed to disable two-factor authentication");
      }
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      const response = await apiFetch(`/user/sessions/${sessionId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setSecurity({
          ...security,
          sessions: {
            ...security.sessions,
            activeSessions: security.sessions.activeSessions.filter((s: any) => s.id !== sessionId)
          }
        });
        alert("Session revoked successfully");
      }
    } catch (error) {
      console.error("Failed to revoke session:", error);
      alert("Failed to revoke session");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading security settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Security</h1>
        <p className="text-slate-400">Manage your account security and privacy settings.</p>
      </div>

      <div className="space-y-6">
        {/* Password Change */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Change Password</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={security.password.currentPassword}
                onChange={(e) => setSecurity({
                  ...security,
                  password: { ...security.password, currentPassword: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={security.password.newPassword}
                onChange={(e) => setSecurity({
                  ...security,
                  password: { ...security.password, newPassword: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={security.password.confirmPassword}
                onChange={(e) => setSecurity({
                  ...security,
                  password: { ...security.password, confirmPassword: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={changePassword}
                className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 transition-colors"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Two-Factor Authentication</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Enable 2FA</div>
                <div className="text-sm text-slate-400">
                  Add an extra layer of security to your account
                </div>
              </div>
              <button
                onClick={toggleTwoFactor}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.twoFactor.enabled ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.twoFactor.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {security.twoFactor.enabled && (
              <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                <div className="text-green-400">
                  <div className="font-medium mb-2">2FA is enabled</div>
                  <div className="text-sm">
                    Method: {security.twoFactor.method === "sms" ? "SMS" : 
                           security.twoFactor.method === "email" ? "Email" : "Authenticator App"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Active Sessions</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Auto-logout</div>
                <div className="text-sm text-slate-400">Automatically log out after inactivity</div>
              </div>
              <select
                value={security.sessions.autoLogout}
                onChange={(e) => setSecurity({
                  ...security,
                  sessions: { ...security.sessions, autoLogout: parseInt(e.target.value) }
                })}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Require Re-authentication</div>
                <div className="text-sm text-slate-400">Require password for sensitive actions</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  sessions: { ...security.sessions, requireReauth: !security.sessions.requireReauth }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.sessions.requireReauth ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.sessions.requireReauth ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium text-slate-200 mb-4">Current Session</h3>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">Current Device</div>
                    <div className="text-sm text-slate-400">
                      {window.navigator.userAgent.split(' ')[0]} • {window.location.hostname}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Active now • This session
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-900/20 text-green-400 rounded text-sm">
                    Current
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Privacy Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Data Sharing</div>
                <div className="text-sm text-slate-400">Share anonymous usage data to improve the service</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  privacy: { ...security.privacy, dataSharing: !security.privacy.dataSharing }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.privacy.dataSharing ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.privacy.dataSharing ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Analytics</div>
                <div className="text-sm text-slate-400">Allow analytics tracking</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  privacy: { ...security.privacy, analytics: !security.privacy.analytics }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.privacy.analytics ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.privacy.analytics ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Marketing Communications</div>
                <div className="text-sm text-slate-400">Receive marketing emails and notifications</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  privacy: { ...security.privacy, marketing: !security.privacy.marketing }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.privacy.marketing ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.privacy.marketing ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Cookies</div>
                <div className="text-sm text-slate-400">Allow cookies for better experience</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  privacy: { ...security.privacy, cookies: !security.privacy.cookies }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.privacy.cookies ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.privacy.cookies ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Login Security */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Login Security</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Require Two-Factor for Login</div>
                <div className="text-sm text-slate-400">Force 2FA for all login attempts</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  login: { ...security.login, requireTwoFactor: !security.login.requireTwoFactor }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.login.requireTwoFactor ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.login.requireTwoFactor ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Login Notifications</div>
                <div className="text-sm text-slate-400">Get notified of new login attempts</div>
              </div>
              <button
                onClick={() => setSecurity({
                  ...security,
                  login: { ...security.login, loginNotifications: !security.login.loginNotifications }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  security.login.loginNotifications ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  security.login.loginNotifications ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={updateSecuritySettings}
            disabled={saving}
            className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Security Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
