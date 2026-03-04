"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profileCompletedAt: string | null;
  status: string;
};

type PerformanceData = {
  rolePerformance: { roleKey: string; roleName: string; userCount: number }[];
  recentActivity: { id: string; type: string; entityType: string; entityId: string; actorId: string | null; createdAt: string }[];
  finance: { revenue: number; expenditure: number };
  projectCountByStatus: Record<string, number>;
  responsibilities: { roleKey: string; roleName: string; description: string }[];
};

export default function AdminPage() {
  const { auth, apiFetch } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotificationEmail, setEditNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"users" | "performance">("users");
  const isAdmin = auth.roleKeys.includes("admin");

  const load = async () => {
    try {
      const res = await apiFetch("/admin/users");
      if (res.ok) setUsers((await res.json()) as UserRow[]);
    } catch {
      // ignore
    }
  };

  const loadPerformance = async () => {
    try {
      const res = await apiFetch("/admin/performance");
      if (res.ok) setPerformance((await res.json()) as PerformanceData);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, apiFetch]);

  useEffect(() => {
    if (isAdmin && tab === "performance") loadPerformance();
  }, [isAdmin, tab, apiFetch]);

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditName(u.name ?? "");
    setEditPhone(u.phone ?? "");
    setEditNotificationEmail(u.notificationEmail ?? u.email ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || null,
          phone: editPhone.trim() || null,
          notificationEmail: editNotificationEmail.trim() || null
        })
      });
      if (res.ok) {
        setEditing(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="shell">
        <p className="text-slate-400">You don’t have access to administration.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Administration</h2>
          <p className="text-sm text-slate-300">
            Users & organisation; performance by role, activity, finance, and responsibilities.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "users" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setTab("performance")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "performance" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            Performance & activity
          </button>
        </div>
      </div>

      {tab === "performance" && performance && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="shell">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Performance by role</h3>
            <ul className="space-y-2">
              {performance.rolePerformance.map((r) => (
                <li key={r.roleKey} className="flex justify-between text-sm">
                  <span className="text-slate-300">{r.roleName}</span>
                  <span className="text-slate-100">{r.userCount} user(s)</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="shell">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Finance</h3>
            <p className="text-sm text-slate-300">
              Revenue (confirmed payments): <span className="text-emerald-400">${performance.finance.revenue.toLocaleString()}</span>
            </p>
            <p className="text-sm text-slate-300">
              Expenditure (expenses): <span className="text-amber-400">${performance.finance.expenditure.toLocaleString()}</span>
            </p>
          </div>
          <div className="shell md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Recent activity</h3>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
              {performance.recentActivity.slice(0, 25).map((e) => (
                <li key={e.id}>
                  {e.type} — {e.entityType} {e.entityId?.slice(0, 8)} {e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}
                </li>
              ))}
            </ul>
          </div>
          <div className="shell md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Responsibilities by role</h3>
            <ul className="space-y-2 text-sm">
              {performance.responsibilities.map((r) => (
                <li key={r.roleKey} className="rounded border border-slate-700 bg-slate-800/40 px-3 py-2">
                  <span className="font-medium text-slate-200">{r.roleName}</span>
                  <p className="mt-1 text-slate-400">{r.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "users" && (
        <>
      <div className="shell overflow-x-auto">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Users</h3>
        {users.length === 0 ? (
          <p className="text-slate-400">No users in this organisation.</p>
        ) : (
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Login email</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">Notification email</th>
                <th className="pb-2 pr-4">Profile</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800">
                  <td className="py-2 pr-4 text-slate-200">{u.name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-300">{u.email}</td>
                  <td className="py-2 pr-4 text-slate-300">{u.phone ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-300">{u.notificationEmail ?? u.email ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {u.profileCompletedAt ? (
                      <span className="text-emerald-400">Complete</span>
                    ) : (
                      <span className="text-amber-400">Incomplete</span>
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="shell max-w-md border-brand/30">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Edit user</h3>
          <p className="mb-3 text-xs text-slate-400">{editing.email}</p>
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Name</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Phone</span>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Notification email</span>
              <input
                type="email"
                value={editNotificationEmail}
                onChange={(e) => setEditNotificationEmail(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                className="rounded bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </section>
  );
}
