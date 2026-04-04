"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth-context";

type RoleInfo = {
  id: string;
  name: string;
  key: string;
  department: { id: string; name: string } | null;
};

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profileCompletedAt: string | null;
  status: string;
  createdAt: string;
  roles: RoleInfo[];
  departments: { id: string; name: string }[];
};

export default function AdminUsersPage() {
  const { auth, apiFetch } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; key: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotificationEmail, setEditNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState("");

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const isAdmin = auth.roleKeys.includes("admin");

  const load = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([apiFetch("/admin/users"), apiFetch("/admin/roles")]);
      if (uRes.ok) {
        const data = (await uRes.json()) as AdminUserRow[];
        setUsers(Array.isArray(data) ? data : []);
      }
      if (rRes.ok) {
        const list = (await rRes.json()) as { id: string; name: string; key: string }[];
        setRoles(Array.isArray(list) ? list : []);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin, load]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (user.name?.toLowerCase().includes(q) ?? false) ||
        user.email.toLowerCase().includes(q);
      const matchesRole =
        filterRole === "all" || user.roles.some((r) => r.key === filterRole);
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, filterRole]);

  function openEdit(u: AdminUserRow) {
    setEditing(u);
    setEditName(u.name ?? "");
    setEditPhone(u.phone ?? "");
    setEditNotificationEmail(u.notificationEmail ?? u.email ?? "");
  }

  async function saveEdit() {
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
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function postUserAction(path: string, userId: string) {
    setActionId(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}${path}`, { method: "POST" });
      if (res.ok) await load();
      else {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Action failed");
      }
    } finally {
      setActionId(null);
    }
  }

  async function submitResetPassword() {
    if (!resetUserId || resetPassword.length < 8) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/users/${resetUserId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword: resetPassword })
      });
      if (res.ok) {
        setResetUserId(null);
        setResetPassword("");
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Reset failed");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <section className="shell">
        <p className="text-slate-400">Only administrators can manage users.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading users…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold text-slate-200">User management</h1>
        <p className="text-slate-400">
          Create, update, lock, suspend, reactivate, and reset passwords for users in your organization. All actions are logged to Activity.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Create user</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newUserEmail.trim() || !newUserPassword) return;
            const res = await apiFetch("/admin/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: newUserEmail.trim(),
                name: newUserName.trim() || undefined,
                password: newUserPassword,
                roleId: newUserRoleId || undefined
              })
            });
            if (res.ok) {
              setNewUserEmail("");
              setNewUserName("");
              setNewUserPassword("");
              setNewUserRoleId("");
              await load();
            } else {
              const d = await res.json().catch(() => ({}));
              alert((d as { error?: string }).error ?? "Create failed");
            }
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Email *
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Name
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Password *
            <input
              type="password"
              required
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Role
            <select
              value={newUserRoleId}
              onChange={(e) => setNewUserRoleId(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="">None</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500">
            Create
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Search name or email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 placeholder:text-slate-500"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200"
          >
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <h2 className="mb-3 text-lg font-semibold text-slate-200">
          Users ({filteredUsers.length})
        </h2>

        {filteredUsers.length === 0 ? (
          <p className="text-slate-500">No users match.</p>
        ) : (
          <ul className="space-y-2">
            {filteredUsers.map((user) => {
              const label = user.name?.trim() || user.email;
              const roleLine = user.roles.map((r) => r.name).join(", ") || "No role";
              const isSelf = user.id === auth.userId;
              return (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{label}</p>
                    <p className="text-sm text-slate-400">{user.email}</p>
                    <p className="text-xs text-slate-500">{roleLine}</p>
                    <span
                      className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${
                        user.status === "active"
                          ? "bg-emerald-900/40 text-emerald-300"
                          : user.status === "locked"
                            ? "bg-amber-900/40 text-amber-300"
                            : "bg-rose-900/40 text-rose-300"
                      }`}
                    >
                      {user.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetUserId(user.id);
                        setResetPassword("");
                      }}
                      disabled={isSelf}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                    >
                      Reset password
                    </button>
                    {user.status === "active" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void postUserAction("/lock", user.id)}
                          disabled={isSelf || actionId === user.id}
                          className="rounded border border-amber-700/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-950/40 disabled:opacity-40"
                        >
                          Lock
                        </button>
                        <button
                          type="button"
                          onClick={() => void postUserAction("/suspend", user.id)}
                          disabled={isSelf || actionId === user.id}
                          className="rounded border border-rose-700/50 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      </>
                    )}
                    {(user.status === "locked" || user.status === "suspended") && (
                      <button
                        type="button"
                        onClick={() => void postUserAction("/reactivate", user.id)}
                        disabled={actionId === user.id}
                        className="rounded border border-emerald-700/50 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-40"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Edit user</h3>
            <div className="flex flex-col gap-3">
              <label className="text-xs text-slate-400">
                Name
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-2 text-slate-200"
                />
              </label>
              <label className="text-xs text-slate-400">
                Phone
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-2 text-slate-200"
                />
              </label>
              <label className="text-xs text-slate-400">
                Notification email
                <input
                  value={editNotificationEmail}
                  onChange={(e) => setEditNotificationEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-2 text-slate-200"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-slate-100">Set temporary password</h3>
            <p className="mb-4 text-sm text-slate-400">Minimum 8 characters. User should change it after login.</p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="New password"
              className="mb-4 w-full rounded border border-slate-600 bg-slate-800 px-2 py-2 text-slate-200"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetUserId(null)} className="rounded px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || resetPassword.length < 8}
                onClick={() => void submitResetPassword()}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Reset password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
