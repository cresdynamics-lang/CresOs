"use client";

import { useAuth } from "../auth-context";

export default function AdminPage() {
  const { auth } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");

  if (!isAdmin) {
    return (
      <section className="shell">
        <p className="text-slate-400">You don’t have access to administration.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Users & organisation</h2>
        <p className="text-sm text-slate-300">
          Manage users, roles, and organisation settings. Use the API admin endpoints for user and role management.
        </p>
      </div>
      <div className="shell">
        <p className="text-sm text-slate-400">
          Admin features (user list, invite, role assignment, org settings) can be wired here to the CresOS API admin routes.
        </p>
      </div>
    </section>
  );
}
