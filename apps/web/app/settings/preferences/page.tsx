"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

export default function PreferencesPage() {
  const { auth, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    theme: "dark",
    language: "en",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    notifications: {
      email: true,
      push: true,
      sms: false,
      desktop: true
    },
    privacy: {
      showOnlineStatus: true,
      showLastSeen: false,
      allowDirectMessages: true,
      profileVisibility: "all"
    },
    accessibility: {
      fontSize: "medium",
      highContrast: false,
      reduceMotion: false,
      screenReader: false
    }
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiFetch("/user/preferences");
      if (response.ok) {
        const data = await response.json();
        setPreferences({ ...preferences, ...data.data });
      }
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        alert("Preferences updated successfully!");
      }
    } catch (error) {
      console.error("Failed to update preferences:", error);
      alert("Failed to update preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Preferences</h1>
        <p className="text-slate-400">Customize your experience and interface settings.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Appearance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Theme
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Language
              </label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Timezone
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value="UTC">UTC</option>
                <option value="EST">Eastern Time</option>
                <option value="PST">Pacific Time</option>
                <option value="GMT">GMT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date Format
              </label>
              <select
                value={preferences.dateFormat}
                onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Email Notifications</div>
                <div className="text-sm text-slate-400">Receive notifications via email</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, email: !preferences.notifications.email }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.notifications.email ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.notifications.email ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Push Notifications</div>
                <div className="text-sm text-slate-400">Receive push notifications</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, push: !preferences.notifications.push }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.notifications.push ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.notifications.push ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">SMS Notifications</div>
                <div className="text-sm text-slate-400">Receive SMS notifications</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, sms: !preferences.notifications.sms }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.notifications.sms ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.notifications.sms ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Desktop Notifications</div>
                <div className="text-sm text-slate-400">Receive desktop notifications</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, desktop: !preferences.notifications.desktop }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.notifications.desktop ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.notifications.desktop ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Privacy</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Show Online Status</div>
                <div className="text-sm text-slate-400">Let others see when you're online</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  privacy: { ...preferences.privacy, showOnlineStatus: !preferences.privacy.showOnlineStatus }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.privacy.showOnlineStatus ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.privacy.showOnlineStatus ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Show Last Seen</div>
                <div className="text-sm text-slate-400">Let others see when you were last active</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  privacy: { ...preferences.privacy, showLastSeen: !preferences.privacy.showLastSeen }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.privacy.showLastSeen ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.privacy.showLastSeen ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Allow Direct Messages</div>
                <div className="text-sm text-slate-400">Let others send you direct messages</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  privacy: { ...preferences.privacy, allowDirectMessages: !preferences.privacy.allowDirectMessages }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.privacy.allowDirectMessages ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.privacy.allowDirectMessages ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Profile Visibility
              </label>
              <select
                value={preferences.privacy.profileVisibility}
                onChange={(e) => setPreferences({
                  ...preferences,
                  privacy: { ...preferences.privacy, profileVisibility: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value="all">Everyone</option>
                <option value="team">Team Members</option>
                <option value="none">Private</option>
              </select>
            </div>
          </div>
        </div>

        {/* Accessibility */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Accessibility</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Font Size
              </label>
              <select
                value={preferences.accessibility.fontSize}
                onChange={(e) => setPreferences({
                  ...preferences,
                  accessibility: { ...preferences.accessibility, fontSize: e.target.value }
                })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="extra-large">Extra Large</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">High Contrast</div>
                <div className="text-sm text-slate-400">Increase contrast for better visibility</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  accessibility: { ...preferences.accessibility, highContrast: !preferences.accessibility.highContrast }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.accessibility.highContrast ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.accessibility.highContrast ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Reduce Motion</div>
                <div className="text-sm text-slate-400">Reduce animations and transitions</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  accessibility: { ...preferences.accessibility, reduceMotion: !preferences.accessibility.reduceMotion }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.accessibility.reduceMotion ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.accessibility.reduceMotion ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Screen Reader Support</div>
                <div className="text-sm text-slate-400">Optimize for screen readers</div>
              </div>
              <button
                onClick={() => setPreferences({
                  ...preferences,
                  accessibility: { ...preferences.accessibility, screenReader: !preferences.accessibility.screenReader }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  preferences.accessibility.screenReader ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.accessibility.screenReader ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={updatePreferences}
            disabled={saving}
            className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
