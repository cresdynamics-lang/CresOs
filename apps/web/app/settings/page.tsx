"use client";

import { NotificationPreferencesForm } from "../notification-preferences-form";

export default function PreferencesPage() {
  return (
    <div className="shell">
      <h3 className="mb-4 text-sm font-semibold text-slate-200">Notification controls</h3>
      <NotificationPreferencesForm />
    </div>
  );
}
