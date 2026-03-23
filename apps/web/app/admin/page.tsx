"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { formatMoney } from "../format-money";

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
type RoleRow = { id: string; name: string; key: string; departmentId: string | null; department?: { id: string; name: string } | null };
type PermissionRow = { id: string; key: string; description: string };
type RolePermission = { roleId: string; permissionId: string };
type UserWithRoles = UserRow & { roles?: { roleId: string; role: { id: string; name: string; key: string } }[] };

type PerformanceData = {
  rolePerformance: { roleKey: string; roleName: string; userCount: number }[];
  recentActivity: { id: string; type: string; entityType: string; entityId: string; actorId: string | null; createdAt: string }[];
  finance: { revenue: number; expenditure: number };
  projectCountByStatus: Record<string, number>;
  responsibilities: { roleKey: string; roleName: string; description: string }[];
};

type AdminMessage = {
  id: string;
  type: string;
  summary: string;
  body: string | null;
  actorId: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};

type OversightData = {
  financePendingCount: number;
  financeOver24h: {
    id: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    reason: string | null;
    hoursPending: number;
    requester: { id: string; name: string | null; email: string } | null;
  }[];
  delayedProjects: {
    id: string;
    name: string;
    status: string;
    endDate: string | null;
    approvalStatus: string;
    assignedDeveloperId: string | null;
    updatedAt: string;
  }[];
  pendingHandoffs: number;
  tasksOverdueCount: number;
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
  const [tab, setTab] = useState<
    "users" | "departments" | "roles" | "capabilities" | "performance" | "messages" | "oversight"
  >("users");
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [oversight, setOversight] = useState<OversightData | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<{
    roles: RoleRow[];
    permissions: PermissionRow[];
    rolePermissions: RolePermission[];
  } | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [roleDeptId, setRoleDeptId] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState("");
  const [assignRoleUserId, setAssignRoleUserId] = useState("");
  const [assignRoleRoleId, setAssignRoleRoleId] = useState("");
  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRoles[]>([]);
  const isAdmin = auth.roleKeys.includes("admin");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/users");
      if (res.ok) setUsers((await res.json()) as UserRow[]);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  const loadUsersWithRoles = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        apiFetch("/admin/users"),
        apiFetch("/admin/roles")
      ]);
      if (!uRes.ok || !rRes.ok) return;
      const userList = (await uRes.json()) as UserRow[];
      const roleList = (await rRes.json()) as RoleRow[];
      const assignments = await Promise.all(
        roleList.map((role) =>
          apiFetch(`/admin/roles/${role.id}/users`).then((res) =>
            res.ok ? res.json() : []
          )
        )
      );
      const byUser = new Map<string, { roleId: string; role: { id: string; name: string; key: string } }[]>();
      roleList.forEach((role, i) => {
        const list = (assignments[i] as { user: { id: string }; role: { id: string; name: string; key: string } }[]) || [];
        list.forEach((a: { user: { id: string }; role: { id: string; name: string; key: string } }) => {
          const arr = byUser.get(a.user.id) ?? [];
          arr.push({ roleId: a.role.id, role: a.role });
          byUser.set(a.user.id, arr);
        });
      });
      setUsersWithRoles(
        userList.map((u) => ({ ...u, roles: byUser.get(u.id) ?? [] }))
      );
    } catch {
      // ignore
    }
  }, [apiFetch]);

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

  const loadPermissionsMatrix = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/permissions/matrix");
      if (res.ok) setPermissionsMatrix((await res.json()) as typeof permissionsMatrix);
    } catch {
      // ignore
    }
  }, [apiFetch]);

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
  }, [isAdmin, load]);

  useEffect(() => {
    if (isAdmin && tab === "users") loadUsersWithRoles();
  }, [isAdmin, tab, loadUsersWithRoles]);

  useEffect(() => {
    if (isAdmin && tab === "departments") loadDepartments();
  }, [isAdmin, tab, loadDepartments]);

  useEffect(() => {
    if (isAdmin && (tab === "roles" || tab === "users")) {
      loadRoles();
      if (tab === "roles") loadDepartments();
    }
  }, [isAdmin, tab, loadRoles, loadDepartments]);

  useEffect(() => {
    if (isAdmin && tab === "capabilities") loadPermissionsMatrix();
  }, [isAdmin, tab, loadPermissionsMatrix]);

  useEffect(() => {
    if (isAdmin && tab === "performance") loadPerformance();
  }, [isAdmin, tab, apiFetch]);

  const loadMessages = async () => {
    try {
      const res = await apiFetch("/admin/messages");
      if (res.ok) setMessages((await res.json()) as AdminMessage[]);
    } catch {
      setMessages([]);
    }
  };

  const loadOversight = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/oversight");
      if (res.ok) setOversight((await res.json()) as OversightData);
    } catch {
      setOversight(null);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isAdmin && tab === "messages") loadMessages();
  }, [isAdmin, tab, apiFetch]);

  useEffect(() => {
    if (isAdmin && tab === "oversight") loadOversight();
  }, [isAdmin, tab, loadOversight]);

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
        body: JSON.stringify({
          name: editName.trim() || null,
          phone: editPhone.trim() || null,
          notificationEmail: editNotificationEmail.trim() || null
        })
      });
      if (res.ok) {
        setEditing(null);
        // Refresh both flat users list and users-with-roles table
        await Promise.all([load(), loadUsersWithRoles()]);
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab("users")} className={`rounded px-3 py-1.5 text-sm ${tab === "users" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Users</button>
          <button type="button" onClick={() => setTab("departments")} className={`rounded px-3 py-1.5 text-sm ${tab === "departments" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Departments</button>
          <button type="button" onClick={() => setTab("roles")} className={`rounded px-3 py-1.5 text-sm ${tab === "roles" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Roles</button>
          <button type="button" onClick={() => setTab("capabilities")} className={`rounded px-3 py-1.5 text-sm ${tab === "capabilities" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Capabilities & access</button>
          <button type="button" onClick={() => setTab("performance")} className={`rounded px-3 py-1.5 text-sm ${tab === "performance" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Performance</button>
          <button type="button" onClick={() => setTab("messages")} className={`rounded px-3 py-1.5 text-sm ${tab === "messages" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Messages</button>
          <button type="button" onClick={() => setTab("oversight")} className={`rounded px-3 py-1.5 text-sm ${tab === "oversight" ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Oversight</button>
        </div>
      </div>

      {tab === "departments" && (
        <div className="shell">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Departments</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!deptName.trim()) return;
              try {
                const res = await apiFetch("/admin/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: deptName.trim(), description: deptDesc.trim() || undefined }) });
                if (res.ok) { setDeptName(""); setDeptDesc(""); loadDepartments(); }
              } catch { /* ignore */ }
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input type="text" placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" />
            <input type="text" placeholder="Description" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" />
            <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">Create department</button>
          </form>
          <ul className="space-y-2">
            {departments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
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
                      if (res.ok) loadDepartments();
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
                const res = await apiFetch("/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: roleName.trim(), key: roleKey.trim(), departmentId: roleDeptId || null }) });
                if (res.ok) { setRoleName(""); setRoleKey(""); setRoleDeptId(""); loadRoles(); }
              } catch { /* ignore */ }
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input type="text" placeholder="Role name" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" />
            <input type="text" placeholder="Key (e.g. analyst)" value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" />
            <select value={roleDeptId} onChange={(e) => setRoleDeptId(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200">
              <option value="">No department</option>
              {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
            <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">Create role</button>
          </form>
          <ul className="space-y-2">
            {roles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
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
                      if (res.ok) loadRoles(); else { const d = await res.json(); alert((d as { error?: string }).error ?? "Failed"); }
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

      {tab === "capabilities" && permissionsMatrix && (
        <div className="shell overflow-x-auto">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Capabilities & access (permissions per role)</h3>
          <p className="mb-4 text-xs text-slate-400">Set which permissions each role has. Save updates the selected role.</p>
          <div className="space-y-4">
            {permissionsMatrix.roles.map((role) => {
              const rpSet = new Set(permissionsMatrix.rolePermissions.filter((rp) => rp.roleId === role.id).map((rp) => rp.permissionId));
              const currentKeys = permissionsMatrix.permissions.filter((p) => rpSet.has(p.id)).map((p) => p.key);
              return (
                <div key={role.id} className="rounded border border-slate-700 bg-slate-800/50 p-3">
                  <p className="mb-2 font-medium text-slate-200">{role.name} ({role.key})</p>
                  <div className="flex flex-wrap gap-3">
                    {permissionsMatrix.permissions.map((perm) => {
                      const checked = rpSet.has(perm.id);
                      return (
                        <label key={perm.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={async (e) => {
                              const next = e.target.checked;
                              const newKeys = next ? [...currentKeys, perm.key] : currentKeys.filter((k) => k !== perm.key);
                              try {
                                const res = await apiFetch(`/admin/roles/${role.id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionKeys: newKeys }) });
                                if (res.ok) loadPermissionsMatrix();
                              } catch { /* ignore */ }
                            }}
                            className="rounded border-slate-600"
                          />
                          <span className="text-slate-300">{perm.key}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "messages" && (
        <div className="shell">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Activity & messages</h3>
          <p className="mb-4 text-xs text-slate-400">
            Things happening in the system: meeting requests, emails sent, and other activity. Keeps you on track.
          </p>
          {messages.length === 0 ? (
            <p className="text-slate-400">No activity messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-slate-500">{m.type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-200">{m.summary}</p>
                  {m.body && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{m.body}</p>}
                  {m.actor && (
                    <p className="mt-1 text-xs text-slate-500">
                      By {m.actor.name ?? m.actor.email}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "oversight" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Operational oversight</h3>
              <p className="mt-1 text-xs text-slate-400">
                Finance queue health, stalled approvals (&gt;24h), delayed or paused projects, handoffs, and overdue tasks. Opening this tab refreshes data and may trigger 24h finance escalation notices for admins.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadOversight()}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {!oversight ? (
            <p className="text-slate-400">Loading…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="shell">
                  <p className="text-xs uppercase text-slate-500">Pending finance approvals</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-100">{oversight.financePendingCount}</p>
                  <a href="/approvals" className="mt-2 inline-block text-xs text-sky-400 hover:underline">
                    Open approvals →
                  </a>
                </div>
                <div className="shell">
                  <p className="text-xs uppercase text-slate-500">Stalled (&gt;24h)</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-400">{oversight.financeOver24h.length}</p>
                  <p className="mt-1 text-xs text-slate-500">Expense / payout requests awaiting decision</p>
                </div>
                <div className="shell">
                  <p className="text-xs uppercase text-slate-500">Pending handoffs</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-100">{oversight.pendingHandoffs}</p>
                </div>
                <div className="shell">
                  <p className="text-xs uppercase text-slate-500">Overdue tasks</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-400">{oversight.tasksOverdueCount}</p>
                </div>
              </div>

              <div className="shell">
                <h4 className="mb-2 text-sm font-semibold text-slate-200">Finance approvals over 24 hours</h4>
                {oversight.financeOver24h.length === 0 ? (
                  <p className="text-sm text-slate-500">None — queue is within SLA.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                    {oversight.financeOver24h.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-slate-700 bg-slate-800/40 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium text-slate-200">
                            {row.entityType} · {row.entityId.slice(0, 8)}…
                          </span>
                          {row.requester && (
                            <span className="ml-2 text-xs text-slate-500">
                              Requested by {row.requester.name ?? row.requester.email}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-amber-300">{row.hoursPending}h pending</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="shell">
                <h4 className="mb-2 text-sm font-semibold text-slate-200">Projects needing attention</h4>
                <p className="mb-3 text-xs text-slate-500">
                  Past end date (still planned/active) or paused.
                </p>
                {oversight.delayedProjects.length === 0 ? (
                  <p className="text-sm text-slate-500">None listed.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                    {oversight.delayedProjects.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-slate-700 bg-slate-800/40 px-3 py-2"
                      >
                        <a href={`/projects/${p.id}`} className="font-medium text-sky-400 hover:underline">
                          {p.name}
                        </a>
                        <span className="text-xs text-slate-400">
                          {p.status}
                          {p.endDate ? ` · end ${new Date(p.endDate).toLocaleDateString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

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
              Revenue (confirmed payments): <span className="text-emerald-400">{formatMoney(performance.finance.revenue)}</span>
            </p>
            <p className="text-sm text-slate-300">
              Expenditure (expenses): <span className="text-amber-400">{formatMoney(performance.finance.expenditure)}</span>
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
      <div className="shell">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Create user</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newUserEmail.trim() || !newUserPassword) return;
            try {
              const res = await apiFetch("/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newUserEmail.trim(), name: newUserName.trim() || undefined, password: newUserPassword, roleId: newUserRoleId || undefined }) });
              if (res.ok) { setNewUserEmail(""); setNewUserName(""); setNewUserPassword(""); setNewUserRoleId(""); load(); loadUsersWithRoles(); }
            } catch { /* ignore */ }
          }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <input type="email" placeholder="Email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" required />
          <input type="text" placeholder="Name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" />
          <input type="password" placeholder="Password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200" required />
          <select value={newUserRoleId} onChange={(e) => setNewUserRoleId(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200">
            <option value="">No role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">Create user</button>
        </form>
      </div>
      <div className="shell overflow-x-auto">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Users & roles</h3>
        {usersWithRoles.length === 0 ? (
          <p className="text-slate-400">No users in this organisation.</p>
        ) : (
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Roles</th>
                <th className="pb-2 pr-4">Profile</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {usersWithRoles.map((u) => (
                <tr key={u.id} className="border-b border-slate-800">
                  <td className="py-2 pr-4 text-slate-200">{u.name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-300">{u.email}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map((ur) => (
                        <span key={ur.roleId} className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                          {ur.role.name}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await apiFetch("/admin/role-assignments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: u.id, roleId: ur.roleId }) });
                                if (res.ok) loadUsersWithRoles();
                              } catch { /* ignore */ }
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
                            const res = await apiFetch("/admin/role-assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: u.id, roleId }) });
                            if (res.ok) loadUsersWithRoles();
                          } catch { /* ignore */ }
                        }}
                        className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
                      >
                        <option value="">+ Add role</option>
                        {roles.filter((r) => !(u.roles ?? []).some((ur) => ur.roleId === r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    {u.profileCompletedAt ? <span className="text-emerald-400">Complete</span> : <span className="text-amber-400">Incomplete</span>}
                  </td>
                  <td className="py-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const tmp = window.prompt("Enter a temporary password for this user (min 8 characters):");
                        if (!tmp || tmp.length < 8) return;
                        try {
                          const res = await apiFetch(`/admin/users/${u.id}/reset-password`, {
                            method: "POST",
                            body: JSON.stringify({ temporaryPassword: tmp })
                          });
                          if (!res.ok) {
                            // eslint-disable-next-line no-alert
                            alert("Failed to reset password.");
                          } else {
                            // eslint-disable-next-line no-alert
                            alert("Password reset. Share the temporary password with the user.");
                          }
                        } catch {
                          // eslint-disable-next-line no-alert
                          alert("Network error while resetting password.");
                        }
                      }}
                      className="rounded border border-amber-600 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30"
                    >
                      Reset password
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
