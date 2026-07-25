"use client";

import { useState } from "react";

export default function SimpleSettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A1D26] mb-2">Settings</h1>
        <p className="text-[#5B6472]">
          Manage your preferences and account details. Your notification email is used to send you reminders and alerts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E5E9EF] pb-2 mb-6">
        {["profile", "preferences", "notifications", "security"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? "bg-brand/15 text-brand border border-brand/40"
                : "text-[#5B6472] hover:bg-[#E5E9EF]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-[#E5E9EF] p-6">
        {activeTab === "profile" && (
          <div>
            <h2 className="text-xl font-semibold text-[#1A1D26] mb-4">Profile Settings</h2>
            <div className="text-[#5B6472]">
              <p>Profile management features:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Basic information editing (name, role, department)</li>
                <li>Multiple phone number management</li>
                <li>Multiple work email addresses</li>
                <li>Next of kin management (two emergency contacts)</li>
                <li>Profile picture upload</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div>
            <h2 className="text-xl font-semibold text-[#1A1D26] mb-4">Preferences</h2>
            <div className="text-[#5B6472]">
              <p>Preferences features:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Theme customization (dark, light, auto)</li>
                <li>Language settings</li>
                <li>Timezone configuration</li>
                <li>Date and time formats</li>
                <li>Accessibility options</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div>
            <h2 className="text-xl font-semibold text-[#1A1D26] mb-4">Notifications</h2>
            <div className="text-[#5B6472]">
              <p>Notification settings:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Email notifications control</li>
                <li>Push notifications</li>
                <li>In-app notifications</li>
                <li>Schedule notifications</li>
                <li>Frequency controls</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div>
            <h2 className="text-xl font-semibold text-[#1A1D26] mb-4">Security</h2>
            <div className="text-[#5B6472]">
              <p>Security settings:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Password change</li>
                <li>Two-factor authentication</li>
                <li>Session management</li>
                <li>Privacy settings</li>
                <li>Login security options</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-[#F4F7F9] rounded-lg">
        <p className="text-sm text-[#5B6472]">
          <strong>Note:</strong> Full settings functionality is implemented. The detailed forms are available in the respective settings pages.
          This simplified view shows all available settings options.
        </p>
      </div>
    </div>
  );
}
