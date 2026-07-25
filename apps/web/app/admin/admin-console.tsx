"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { EmailAutomationConsole } from "./email-automation/email-automation-console";
import { adminNeu } from "../../components/admin/admin-theme";
import { AdminPageHeader, AdminPanel } from "../../components/admin/admin-ui";
import {
  CreateEmployeeAccountModal,
  type CreateEmployeeAccountPayload
} from "../../components/workspace/create-employee-account-modal";

type TabKey = "users" | "departments" | "roles" | "email-automation";

const TAB_META: Record<TabKey, { title: string; description: string }> = {
  users: {
    title: "Users & access",
    description: "Create accounts, assign roles, reporting lines, and capability flags."
  },
  departments: {
    title: "Departments",
    description: "Organisational units and the roles assigned to each department."
  },
  roles: {
    title: "Roles & permissions",
    description: "Role keys, department mapping, and access templates."
  },
  "email-automation": {
    title: "Email automation",
    description: "Emil-AI inbox, drafts, and outbound review queue."
  }
};

function initialsFrom(name: string | null, email: string): string {
  const src = (name && name.trim()) || email.trim();
  if (!src) return "U";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase();
}

function UserAvatar({ name, email }: { name: string | null; email: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F0F0] font-label text-xs font-bold text-[#2D5A5A]">
      {initialsFrom(name, email)}
    </span>
  );
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return adminNeu.badgeSuccess;
  if (s === "invited" || s === "pending") return adminNeu.badgeWarning;
  return adminNeu.badge;
}

function tabFromPathname(path: string | null): TabKey {
  if (!path) return "users";
  if (path.startsWith("/admin/org")) return "departments";
  if (path.startsWith("/admin/roles")) return "roles";
  if (path.startsWith("/admin/email-automation")) return "email-automation";
  return "users";
}

type CapabilityFlags = {
  canSeeFinance?: boolean;
  canSubmitReports?: boolean;
  canReviewTeamReports?: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  profileCompletedAt: string | null;
  status: string;
  reportsToDirectorId?: string | null;
  reportsToDirector?: { id: string; name: string | null; email: string } | null;
  capabilityFlags?: CapabilityFlags | null;
};

type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  _count?: { roles: number };
  roles?: { id: string; name: string; key: string; _count?: { users: number } }[];
};
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

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserBusy, setCreateUserBusy] = useState(false);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotificationEmail, setEditNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [directors, setDirectors] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [editDirectorId, setEditDirectorId] = useState<string>("");
  const [editCanSeeFinance, setEditCanSeeFinance] = useState(false);
  const [editCanSubmitReports, setEditCanSubmitReports] = useState(true);
  const [editCanReviewTeamReports, setEditCanReviewTeamReports] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const loadDirectors = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/directors");
      if (res.ok) setDirectors((await res.json()) as { id: string; name: string | null; email: string }[]);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "users") {
      void loadUsersWithRoles();
      void loadDirectors();
      void loadRoles();
    }
    if (tab === "departments") void loadDepartments();
    if (tab === "roles") {
      void loadRoles();
      void loadDepartments();
    }
  }, [isAdmin, tab, loadUsersWithRoles, loadDepartments, loadRoles, loadDirectors]);

  const rolesForSelect = useMemo(() => roles.slice().sort((a, b) => a.name.localeCompare(b.name)), [roles]);

  function openEdit(u: UserRow) {
    setEditing(u);
    setEditError(null);
    setEditName(u.name ?? "");
    setEditPhone(u.phone ?? "");
    setEditNotificationEmail(u.notificationEmail ?? u.email ?? "");
    setEditDirectorId(u.reportsToDirectorId ?? "");
    const caps = (u.capabilityFlags ?? {}) as CapabilityFlags;
    setEditCanSeeFinance(caps.canSeeFinance === true);
    setEditCanSubmitReports(caps.canSubmitReports !== false);
    setEditCanReviewTeamReports(caps.canReviewTeamReports !== false);
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
          notificationEmail: editNotificationEmail.trim() || null,
          reportsToDirectorId: editDirectorId || null,
          capabilityFlags: {
            canSeeFinance: editCanSeeFinance,
            canSubmitReports: editCanSubmitReports,
            canReviewTeamReports: editCanReviewTeamReports
          }
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
    if (
      !confirm(
        `Permanently delete ${u.email}? Their account and access will be removed entirely. This cannot be undone.`
      )
    ) {
      return;
    }
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

  async function createUser(payload: CreateEmployeeAccountPayload) {
    setCreateUserError(null);
    if (!payload.email.trim() || !payload.password) {
      setCreateUserError("Enter email and password.");
      return;
    }
    if (payload.password.length < 8) {
      setCreateUserError("Password must be at least 8 characters.");
      return;
    }
    setCreateUserBusy(true);
    try {
      const res = await apiFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email.trim(),
          name: payload.name.trim() || undefined,
          password: payload.password,
          roleId: payload.roleId || undefined,
          reportsToDirectorId: payload.reportsToDirectorId || null,
          jobTitle: payload.jobTitle.trim() || null,
          employmentType: payload.employmentType,
          hireDate: payload.hireDate || null,
          monthlySalary: payload.monthlySalary || null
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCreateUserError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      setShowCreateUser(false);
      await loadUsersWithRoles();
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreateUserBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <section className={adminNeu.panel}>
        <p className="text-sm font-medium text-[#1A1D26]">You don’t have access to administration.</p>
      </section>
    );
  }

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden font-body text-sm leading-normal text-[#1A1D26]">
      {tab !== "email-automation" && (
        <AdminPageHeader title={TAB_META[tab].title} description={TAB_META[tab].description} />
      )}

      {loadError && (
        <p className={`${adminNeu.alertDanger} px-3 py-2.5 font-body text-sm font-semibold text-[#C62828]`}>
          {loadError}
        </p>
      )}

      {tab === "users" && (
        <>
          <div className={`${adminNeu.card} min-w-0 w-full max-w-full overflow-hidden`}>
            <div className={adminNeu.commandBar}>
              <p className="font-body text-sm font-semibold text-[#1A1D26]">
                {usersWithRoles.length} user{usersWithRoles.length === 1 ? "" : "s"} in organisation
              </p>
              <button
                type="button"
                onClick={() => {
                  setCreateUserError(null);
                  setShowCreateUser(true);
                }}
                className={adminNeu.btnPrimary}
              >
                + New employee
              </button>
            </div>

            <div className="min-w-0">
            {usersWithRoles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm font-medium text-[#5B6472]">
                No users in this organisation.
              </p>
            ) : (
              <>
                <div className="divide-y divide-[#E5E9EF] md:hidden">
                  {usersWithRoles.map((u) => (
                    <div key={`m-${u.id}`} className="p-3 text-sm text-[#1A1D26]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <UserAvatar name={u.name} email={u.email} />
                          <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#1A1D26]">{u.name ?? "—"}</p>
                          <p className="mt-0.5 break-all text-xs font-medium text-[#5B6472]">{u.email}</p>
                          <div className="mt-1.5">
                            <span className={statusBadgeClass(u.status)}>{u.status}</span>
                          </div>
                          <p className="mt-1.5 text-xs font-medium text-[#5B6472]">
                            <span className="font-semibold text-[#1A1D26]">Reports to: </span>
                            {u.reportsToDirector?.name ?? u.reportsToDirector?.email ?? "—"}
                          </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => openEdit(u)} className={adminNeu.btnGhost}>
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={auth.userId === u.id || deletingId === u.id}
                            title={auth.userId === u.id ? "You cannot remove your own account" : undefined}
                            onClick={() => void deleteUser(u)}
                            className={adminNeu.btnDanger}
                          >
                            {deletingId === u.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {(u.roles ?? []).map((ur) => (
                          <span key={ur.roleId} className={`max-w-full ${adminNeu.badgeAccent}`}>
                            <span className="truncate">{ur.role.name}</span>
                            <button
                              type="button"
                              aria-label={`Remove role ${ur.role.name}`}
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
                              className="shrink-0 font-bold text-[#C62828] hover:underline"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <select
                          value=""
                          aria-label={`Add role to ${u.name ?? u.email}`}
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
                          className="max-w-full rounded border border-[#D0D5DD] bg-white px-1.5 py-1 text-[11px] font-semibold text-[#1A1D26]"
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
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr>
                        <th className={adminNeu.th}>User</th>
                        <th className={adminNeu.th}>Status</th>
                        <th className={adminNeu.th}>Reports to</th>
                        <th className={adminNeu.th}>Roles</th>
                        <th className={`${adminNeu.th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersWithRoles.map((u) => (
                        <tr key={u.id} className={adminNeu.rowHover}>
                          <td className={adminNeu.td}>
                            <div className="flex items-center gap-3">
                              <UserAvatar name={u.name} email={u.email} />
                              <div className="min-w-0">
                                <p className="truncate font-body text-sm font-semibold text-[#1A1D26]">{u.name ?? "—"}</p>
                                <p className="max-w-[14rem] truncate font-body text-xs font-medium text-[#5B6472]" title={u.email}>
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={adminNeu.td}>
                            <span className={statusBadgeClass(u.status)}>{u.status}</span>
                          </td>
                          <td className={`${adminNeu.td} font-medium text-[#5B6472]`}>
                            {u.reportsToDirector?.name ?? u.reportsToDirector?.email ?? "—"}
                          </td>
                          <td className={adminNeu.td}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(u.roles ?? []).map((ur) => (
                                <span key={ur.roleId} className={adminNeu.badgeAccent}>
                                  {ur.role.name}
                                  <button
                                    type="button"
                                    aria-label={`Remove role ${ur.role.name}`}
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
                                    className="font-bold text-[#C62828] hover:underline"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              <select
                                value=""
                                aria-label={`Add role to ${u.name ?? u.email}`}
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
                                className="rounded border border-[#D0D5DD] bg-white px-1.5 py-1 text-xs font-semibold text-[#1A1D26]"
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
                          <td className={adminNeu.td}>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <button type="button" onClick={() => openEdit(u)} className={adminNeu.btnGhost}>
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={auth.userId === u.id || deletingId === u.id}
                                title={auth.userId === u.id ? "You cannot remove your own account" : undefined}
                                onClick={() => void deleteUser(u)}
                                className={adminNeu.btnDanger}
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

          <CreateEmployeeAccountModal
            open={showCreateUser}
            onClose={() => {
              setShowCreateUser(false);
              setCreateUserError(null);
            }}
            onSubmit={(payload) => void createUser(payload)}
            busy={createUserBusy}
            error={createUserError}
            roles={rolesForSelect}
            leaders={directors}
            theme="admin"
            eyebrow="New hire"
            title="Create employee account"
            submitLabel="Create employee"
            rolePlaceholder="Select role"
            leaderPlaceholder="Director or admin (optional)"
          />

          {editing && (
            <div className={`${adminNeu.panel} mx-auto w-full max-w-full sm:max-w-lg`}>
              <h3 className="text-base font-bold text-[#1A1D26]">Edit user</h3>
              <p className="mt-0.5 break-all text-xs font-medium text-[#5B6472]">{editing.email}</p>
              {editError && (
                <p
                  className={`${adminNeu.alertDanger} mt-3 px-3 py-2 text-xs font-semibold text-[#C62828]`}
                  role="alert"
                >
                  {editError}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-3.5">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#1A1D26]">Name</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full ${adminNeu.input}`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#1A1D26]">Phone</span>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className={`w-full ${adminNeu.input}`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#1A1D26]">Notification email</span>
                  <input
                    type="email"
                    value={editNotificationEmail}
                    onChange={(e) => setEditNotificationEmail(e.target.value)}
                    className={`w-full ${adminNeu.input}`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#1A1D26]">Reports to director</span>
                  <select
                    value={editDirectorId}
                    onChange={(e) => setEditDirectorId(e.target.value)}
                    className={`w-full ${adminNeu.input}`}
                  >
                    <option value="">— None —</option>
                    {directors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name ?? d.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={adminNeu.panelInset}>
                  <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5B6472]">Capabilities</p>
                  <label className="flex items-center justify-between gap-2 border-b border-[#E5E9EF] py-2 text-sm font-medium text-[#1A1D26]">
                    <span>Can see finance / cash flow</span>
                    <input
                      type="checkbox"
                      checked={editCanSeeFinance}
                      onChange={(e) => setEditCanSeeFinance(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D0D5DD] accent-brand"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 border-b border-[#E5E9EF] py-2 text-sm font-medium text-[#1A1D26]">
                    <span>Can submit reports</span>
                    <input
                      type="checkbox"
                      checked={editCanSubmitReports}
                      onChange={(e) => setEditCanSubmitReports(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D0D5DD] accent-brand"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 pt-2 text-sm font-medium text-[#1A1D26]">
                    <span>Can review team reports</span>
                    <input
                      type="checkbox"
                      checked={editCanReviewTeamReports}
                      onChange={(e) => setEditCanReviewTeamReports(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D0D5DD] accent-brand"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setEditing(null)} className={adminNeu.btnGhost}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveEdit()}
                    className={adminNeu.btnPrimary}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "departments" && (
        <AdminPanel>
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
            className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <input
              type="text"
              placeholder="Department name"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className={`min-w-0 flex-1 ${adminNeu.input}`}
            />
            <input
              type="text"
              placeholder="Description"
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              className={`min-w-0 flex-1 ${adminNeu.input}`}
            />
            <button type="submit" className={`shrink-0 ${adminNeu.btnPrimary}`}>
              Create department
            </button>
          </form>

          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {departments.map((d) => (
              <li key={d.id} className={`${adminNeu.card} p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[#1A1D26]">{d.name}</h3>
                    {d.description && <p className="mt-1 text-sm font-medium text-[#5B6472]">{d.description}</p>}
                    <p className="mt-2 text-xs font-semibold text-[#5B6472]">
                      {d._count?.roles ?? d.roles?.length ?? 0} role(s)
                    </p>
                    {d.roles && d.roles.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {d.roles.map((role) => (
                          <li
                            key={role.id}
                            className="flex items-center justify-between gap-2 rounded border border-[#E5E9EF] bg-[#F4F7F9] px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-semibold text-[#1A1D26]">
                              {role.name} <span className="font-medium text-[#5B6472]">({role.key})</span>
                            </span>
                            <span className="font-semibold text-[#5B6472]">{role._count?.users ?? 0} users</span>
                          </li>
                        ))}
                      </ul>
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
                    className={`shrink-0 ${adminNeu.btnDanger}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {departments.length === 0 && (
            <p className="text-sm font-medium text-[#5B6472]">
              No departments yet. Create one above or run database seed.
            </p>
          )}
        </AdminPanel>
      )}

      {tab === "roles" && (
        <div className={`${adminNeu.panel} min-w-0 w-full max-w-full overflow-x-hidden`}>
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
              className={`min-w-0 flex-1 ${adminNeu.input}`}
            />
            <input
              type="text"
              placeholder="Key (e.g. analyst)"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className={`min-w-0 flex-1 ${adminNeu.input}`}
            />
            <select
              value={roleDeptId}
              onChange={(e) => setRoleDeptId(e.target.value)}
              className={`w-full min-w-0 sm:w-auto ${adminNeu.input}`}
            >
              <option value="">No department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <button type="submit" className={`w-full shrink-0 sm:w-auto ${adminNeu.btnPrimary}`}>
              Create role
            </button>
          </form>
          <ul className="divide-y divide-[#E5E9EF] rounded-lg border border-[#E5E9EF]">
            {rolesForSelect.map((r) => (
              <li
                key={r.id}
                className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${adminNeu.rowHover}`}
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-[#1A1D26]">{r.name}</span>
                  <span className={`ml-2 align-middle ${adminNeu.badge}`}>{r.key}</span>
                  {r.department && (
                    <p className="mt-0.5 text-xs font-medium text-[#5B6472]">Department: {r.department.name}</p>
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
                  className={`w-full shrink-0 sm:w-auto ${adminNeu.btnDanger}`}
                >
                  Delete
                </button>
              </li>
            ))}
            {roles.length === 0 && (
              <li className="px-3 py-6 text-center text-sm font-medium text-[#5B6472]">
                No roles beyond defaults. Create one above.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "email-automation" && <EmailAutomationConsole />}
    </section>
  );
}

