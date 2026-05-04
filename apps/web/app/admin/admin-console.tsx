"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";

type TabKey = "users" | "departments" | "roles";

function tabFromPathname(path: string | null): TabKey {
  if (!path) return "users";
  if (path.startsWith("/admin/org")) return "departments";
  if (path.startsWith("/admin/roles")) return "roles";
  return "users";
}

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

export function AdminConsole() {
  const { auth, apiFetch } = useAuth();
  const pathname = usePathname();
  const tab = tabFromPathname(pathname);
  const isAdmin = auth.roleKeys.includes("admin");
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
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserBusy, setCreateUserBusy] = useState(false);

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
    setEditError(null);
    setEditName(u.name ?? "");
    setEditPhone(u.phone ?? "");
    setEditNotificationEmail(u.notificationEmail ?? u.email ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
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
      } else {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setEditError(errBody.error ?? `Save failed (${res.status}).`);
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`Remove ${u.email} from this organisation? They will lose access.`)) return;
    setDeletingId(u.id);
    try {
      const res = await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? `Delete failed (${res.status})`);
        return;
      }
      if (editing?.id === u.id) setEditing(null);
      await loadUsersWithRoles();
    } finally {
      setDeletingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <section className="shell">
        <p className="text-slate-400">You don’t have access to administration.</p>
      </section>
    );
  }

  const subNavLink = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={`shrink-0 rounded px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-sm ${
          active ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden text-xs leading-snug text-slate-300 max-sm:gap-2.5 sm:gap-4 sm:text-sm sm:leading-normal">
      <nav
        className="flex w-full min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2"
        aria-label="Administration"
      >
        {subNavLink("/admin/users", "Users")}
        {subNavLink("/admin/org", "Departments")}
        {subNavLink("/admin/roles", "Roles")}
      </nav>

      {tab === "users" && (
        <>
          <div className="shell min-w-0 w-full max-w-full overflow-x-hidden">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCreateUserError(null);
                if (!newUserEmail.trim() || !newUserPassword) {
                  setCreateUserError("Enter email and password.");
                  return;
                }
                if (newUserPassword.length < 8) {
                  setCreateUserError("Password must be at least 8 characters.");
                  return;
                }
                setCreateUserBusy(true);
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
                  const data = (await res.json().catch(() => ({}))) as { error?: string };
                  if (!res.ok) {
                    setCreateUserError(data.error ?? `Create failed (${res.status})`);
                    return;
                  }
                  setNewUserEmail("");
                  setNewUserName("");
                  setNewUserPassword("");
                  setNewUserRoleId("");
                  await loadUsersWithRoles();
                } catch (err) {
                  setCreateUserError(err instanceof Error ? err.message : "Network error");
                } finally {
                  setCreateUserBusy(false);
                }
              }}
              className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
            >
              {createUserError && (
                <p className="w-full basis-full text-[11px] text-rose-300 sm:text-xs" role="alert">
                  {createUserError}
                </p>
              )}
              <input
                type="email"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:min-w-[12rem] sm:text-sm"
                required
              />
              <input
                type="text"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:min-w-[8rem] sm:text-sm"
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:min-w-[8rem] sm:text-sm"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <select
                value={newUserRoleId}
                onChange={(e) => setNewUserRoleId(e.target.value)}
                className="w-full min-w-0 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:w-auto sm:text-sm"
              >
                <option value="">No role</option>
                {rolesForSelect.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={createUserBusy}
                className="w-full shrink-0 rounded bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-sm"
              >
                {createUserBusy ? "Creating…" : "Create user"}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-700/80 pt-4">
            {loadError && <p className="mb-2 text-[11px] text-amber-300 sm:text-xs">{loadError}</p>}
            {usersWithRoles.length === 0 ? (
              <p className="text-slate-400">No users in this organisation.</p>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {usersWithRoles.map((u) => (
                    <div
                      key={`m-${u.id}`}
                      className="rounded-lg border border-slate-700 bg-slate-800/40 p-2.5 text-[11px] text-slate-300 sm:text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-100">{u.name ?? "—"}</p>
                          <p className="mt-0.5 break-all text-slate-400">{u.email}</p>
                          <p className="mt-1 text-slate-500">Status: {u.status}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={auth.userId === u.id || deletingId === u.id}
                            title={auth.userId === u.id ? "You cannot remove your own account" : undefined}
                            onClick={() => void deleteUser(u)}
                            className="rounded border border-rose-600/50 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deletingId === u.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {(u.roles ?? []).map((ur) => (
                          <span
                            key={ur.roleId}
                            className="inline-flex max-w-full items-center gap-1 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200"
                          >
                            <span className="truncate">{ur.role.name}</span>
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
                              className="shrink-0 text-rose-400 hover:underline"
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
                          className="max-w-full rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-200"
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
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[560px] text-left text-xs lg:min-w-0 lg:text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Email</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3">Roles</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersWithRoles.map((u) => (
                        <tr key={u.id} className="border-b border-slate-800">
                          <td className="py-2 pr-3 text-slate-200">{u.name ?? "—"}</td>
                          <td className="max-w-[12rem] truncate py-2 pr-3 text-slate-300" title={u.email}>
                            {u.email}
                          </td>
                          <td className="py-2 pr-3 text-slate-300">{u.status}</td>
                          <td className="py-2 pr-3">
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
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(u)}
                                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={auth.userId === u.id || deletingId === u.id}
                                title={auth.userId === u.id ? "You cannot remove your own account" : undefined}
                                onClick={() => void deleteUser(u)}
                                className="rounded border border-rose-600/50 px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {deletingId === u.id ? "…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            </div>
          </div>

          {editing && (
            <div className="shell mx-auto w-full max-w-full border-brand/30 sm:max-w-md">
              <h3 className="mb-2 text-xs font-semibold text-slate-200 sm:mb-3 sm:text-sm">Edit user</h3>
              <p className="mb-2 break-all text-[11px] text-slate-400 sm:mb-3 sm:text-xs">{editing.email}</p>
              {editError && (
                <p className="mb-2 rounded border border-rose-600/40 bg-rose-950/40 px-2 py-1.5 text-[11px] text-rose-200 sm:text-xs" role="alert">
                  {editError}
                </p>
              )}
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-400 sm:text-xs">Name</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 sm:px-3 sm:py-2 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-400 sm:text-xs">Phone</span>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 sm:px-3 sm:py-2 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-400 sm:text-xs">Notification email</span>
                  <input
                    type="email"
                    value={editNotificationEmail}
                    onChange={(e) => setEditNotificationEmail(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 sm:px-3 sm:py-2 sm:text-sm"
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveEdit()}
                    className="w-full rounded bg-brand px-3 py-1.5 text-xs text-white hover:bg-brand-dark disabled:opacity-60 sm:w-auto sm:text-sm"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="w-full rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 sm:w-auto sm:text-sm"
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
        <div className="shell min-w-0 w-full max-w-full overflow-x-hidden">
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
            className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:flex-wrap"
          >
            <input
              type="text"
              placeholder="Department name"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:text-sm"
            />
            <input
              type="text"
              placeholder="Description"
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:text-sm"
            />
            <button
              type="submit"
              className="w-full shrink-0 rounded bg-sky-600 px-3 py-1.5 text-xs text-white sm:w-auto sm:text-sm"
            >
              Create department
            </button>
          </form>
          <ul className="space-y-2">
            {departments.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded border border-slate-700 bg-slate-800/50 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-200 sm:text-base">{d.name}</span>
                  {d.description && <p className="text-[11px] text-slate-400 sm:text-xs">{d.description}</p>}
                  {d._count != null && (
                    <p className="text-[11px] text-slate-500 sm:text-xs">{d._count.roles} role(s)</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Delete this department? Roles must be moved first.")) {
                      const res = await apiFetch(`/admin/departments/${d.id}`, { method: "DELETE" });
                      if (res.ok) await loadDepartments();
                    }
                  }}
                  className="w-full shrink-0 rounded border border-rose-600/50 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-900/30 sm:w-auto sm:text-xs"
                >
                  Delete
                </button>
              </li>
            ))}
            {departments.length === 0 && (
              <li className="text-xs text-slate-400 sm:text-sm">No departments. Create one above.</li>
            )}
          </ul>
        </div>
      )}

      {tab === "roles" && (
        <div className="shell min-w-0 w-full max-w-full overflow-x-hidden">
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
            className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:flex-wrap"
          >
            <input
              type="text"
              placeholder="Role name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:text-sm"
            />
            <input
              type="text"
              placeholder="Key (e.g. analyst)"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:text-sm"
            />
            <select
              value={roleDeptId}
              onChange={(e) => setRoleDeptId(e.target.value)}
              className="w-full min-w-0 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 sm:w-auto sm:text-sm"
            >
              <option value="">No department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full shrink-0 rounded bg-sky-600 px-3 py-1.5 text-xs text-white sm:w-auto sm:text-sm"
            >
              Create role
            </button>
          </form>
          <ul className="space-y-2">
            {rolesForSelect.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded border border-slate-700 bg-slate-800/50 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-200 sm:text-base">{r.name}</span>
                  <span className="ml-2 text-[11px] text-slate-500 sm:text-xs">{r.key}</span>
                  {r.department && (
                    <p className="text-[11px] text-sky-400 sm:text-xs">Dept: {r.department.name}</p>
                  )}
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
                  className="w-full shrink-0 rounded border border-rose-600/50 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-900/30 sm:w-auto sm:text-xs"
                >
                  Delete
                </button>
              </li>
            ))}
            {roles.length === 0 && (
              <li className="text-xs text-slate-400 sm:text-sm">No roles beyond defaults. Create one above.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

