"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";

type TabKey = "users" | "departments" | "roles";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profileCompletedAt: string | null;
  status: string;
};

type DepartmentRow = { id: string; name: string; description: string | null; _count?: { roles: number } };
type RoleRow = {
  id: string;
  name: string;
  key: string;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
};

type UserWithRoles = UserRow & {
  roles?: { roleId: string; role: { id: string; name: string; key: string } }[];
};

export function AdminConsole({ initialTab }: { initialTab: TabKey }) {
  const { auth, apiFetch } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRoles[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);

  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  const [roleName, setRoleName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [roleDeptId, setRoleDeptId] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState("");

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotificationEmail, setEditNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/departments");
      if (res.ok) setDepartments((await res.json()) as DepartmentRow[]);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  const loadRoles = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/roles");
      if (res.ok) setRoles((await res.json()) as RoleRow[]);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  const loadUsersWithRoles = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([apiFetch("/admin/users"), apiFetch("/admin/roles")]);
      if (!uRes.ok) {
        setLoadError(`Failed to load users (${uRes.status})`);
        return;
      }

      const userList = (await uRes.json()) as UserRow[];
      if (!rRes.ok) {
        setUsersWithRoles(userList.map((u) => ({ ...u, roles: [] })));
        setLoadError(`Loaded users but roles failed (${rRes.status})`);
        return;
      }
      const roleList = (await rRes.json()) as RoleRow[];

      const assignments = await Promise.all(
        roleList.map((role) =>
          apiFetch(`/admin/roles/${role.id}/users`).then((res) => (res.ok ? res.json() : []))
        )
      );

      const byUser = new Map<string, { roleId: string; role: { id: string; name: string; key: string } }[]>();
      roleList.forEach((role, i) => {
        const list =
          (assignments[i] as { user: { id: string }; role: { id: string; name: string; key: string } }[]) || [];
        list.forEach((a: { user: { id: string }; role: { id: string; name: string; key: string } }) => {
          const arr = byUser.get(a.user.id) ?? [];
          arr.push({ roleId: a.role.id, role: a.role });
          byUser.set(a.user.id, arr);
        });
      });

      setUsersWithRoles(userList.map((u) => ({ ...u, roles: byUser.get(u.id) ?? [] })));
      setLoadError(null);
    } catch {
      setLoadError("Network error while loading users");
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadRoles();
    void loadDepartments();
  }, [isAdmin, loadRoles, loadDepartments]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "users") void loadUsersWithRoles();
    if (tab === "departments") void loadDepartments();
    if (tab === "roles") {
      void loadRoles();
      void loadDepartments();
    }
  }, [isAdmin, tab, loadUsersWithRoles, loadDepartments, loadRoles]);

  const rolesForSelect = useMemo(() => roles.slice().sort((a, b) => a.name.localeCompare(b.name)), [roles]);

  function openEdit(u: UserRow) {
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
        await loadUsersWithRoles();
      }
    } finally {
      setSaving(false);
    }
  }

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
          <p className="text-sm text-slate-300">Users, departments, and roles for your organisation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "users" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setTab("departments")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "departments" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            Departments
          </button>
          <button
            type="button"
            onClick={() => setTab("roles")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "roles" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            Roles
          </button>
        </div>
      </div>

      {tab === "users" && (
        <>
          <div className="shell">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Create user</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newUserEmail.trim() || !newUserPassword) return;
                try {
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
                    await loadUsersWithRoles();
                  }
                } catch {
                  // ignore
                }
              }}
              className="mb-4 flex flex-wrap gap-2"
            >
              <input
                type="email"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                required
              />
              <input
                type="text"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              />
              <input
                type="password"
                placeholder="Password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                required
              />
              <select
                value={newUserRoleId}
                onChange={(e) => setNewUserRoleId(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="">No role</option>
                {rolesForSelect.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">
                Create user
              </button>
            </form>
          </div>

          <div className="shell overflow-x-auto">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Users & roles</h3>
            {loadError && <p className="mb-2 text-xs text-amber-300">{loadError}</p>}
            {usersWithRoles.length === 0 ? (
              <p className="text-slate-400">No users in this organisation.</p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Roles</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithRoles.map((u) => (
                    <tr key={u.id} className="border-b border-slate-800">
                      <td className="py-2 pr-4 text-slate-200">{u.name ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-300">{u.email}</td>
                      <td className="py-2 pr-4 text-slate-300">{u.status}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? []).map((ur) => (
                            <span
                              key={ur.roleId}
                              className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200"
                            >
                              {ur.role.name}
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await apiFetch("/admin/role-assignments", {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ userId: u.id, roleId: ur.roleId })
                                    });
                                    if (res.ok) await loadUsersWithRoles();
                                  } catch {
                                    // ignore
                                  }
                                }}
                                className="text-rose-400 hover:underline"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            onChange={async (e) => {
                              const roleId = e.target.value;
                              if (!roleId) return;
                              e.target.value = "";
                              try {
                                const res = await apiFetch("/admin/role-assignments", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: u.id, roleId })
                                });
                                if (res.ok) await loadUsersWithRoles();
                              } catch {
                                // ignore
                              }
                            }}
                            className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
                          >
                            <option value="">+ Add role</option>
                            {rolesForSelect
                              .filter((r) => !(u.roles ?? []).some((ur) => ur.roleId === r.id))
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </div>
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
                    onClick={() => void saveEdit()}
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

      {tab === "departments" && (
        <div className="shell">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Departments</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!deptName.trim()) return;
              try {
                const res = await apiFetch("/admin/departments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: deptName.trim(), description: deptDesc.trim() || undefined })
                });
                if (res.ok) {
                  setDeptName("");
                  setDeptDesc("");
                  await loadDepartments();
                }
              } catch {
                // ignore
              }
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input
              type="text"
              placeholder="Department name"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              placeholder="Description"
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
            <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">
              Create department
            </button>
          </form>
          <ul className="space-y-2">
            {departments.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/50 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-slate-200">{d.name}</span>
                  {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                  {d._count != null && <p className="text-xs text-slate-500">{d._count.roles} role(s)</p>}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Delete this department? Roles must be moved first.")) {
                      const res = await apiFetch(`/admin/departments/${d.id}`, { method: "DELETE" });
                      if (res.ok) await loadDepartments();
                    }
                  }}
                  className="rounded border border-rose-600/50 px-2 py-1 text-xs text-rose-400 hover:bg-rose-900/30"
                >
                  Delete
                </button>
              </li>
            ))}
            {departments.length === 0 && <li className="text-sm text-slate-400">No departments. Create one above.</li>}
          </ul>
        </div>
      )}

      {tab === "roles" && (
        <div className="shell">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Roles</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!roleName.trim() || !roleKey.trim()) return;
              try {
                const res = await apiFetch("/admin/roles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: roleName.trim(), key: roleKey.trim(), departmentId: roleDeptId || null })
                });
                if (res.ok) {
                  setRoleName("");
                  setRoleKey("");
                  setRoleDeptId("");
                  await loadRoles();
                }
              } catch {
                // ignore
              }
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input
              type="text"
              placeholder="Role name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
            <input
              type="text"
              placeholder="Key (e.g. analyst)"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
            <select
              value={roleDeptId}
              onChange={(e) => setRoleDeptId(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="">No department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">
              Create role
            </button>
          </form>
          <ul className="space-y-2">
            {rolesForSelect.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/50 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-slate-200">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{r.key}</span>
                  {r.department && <p className="text-xs text-sky-400">Dept: {r.department.name}</p>}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Delete this role? Remove user assignments first.")) {
                      const res = await apiFetch(`/admin/roles/${r.id}`, { method: "DELETE" });
                      if (res.ok) await loadRoles();
                      else {
                        const d = await res.json().catch(() => ({}));
                        alert((d as { error?: string }).error ?? "Failed");
                      }
                    }
                  }}
                  className="rounded border border-rose-600/50 px-2 py-1 text-xs text-rose-400 hover:bg-rose-900/30"
                >
                  Delete
                </button>
              </li>
            ))}
            {roles.length === 0 && <li className="text-sm text-slate-400">No roles beyond defaults. Create one above.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

