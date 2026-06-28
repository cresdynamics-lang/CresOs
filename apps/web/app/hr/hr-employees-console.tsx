"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { hrNeu } from "../../components/hr/hr-theme";
import {
  HrAvatar,
  HrBadge,
  HrFieldLabel,
  HrInput,
  HrSelect
} from "../../components/hr/hr-ui";
import { canAccessHrWorkspace } from "../../lib/is-hr-only";
import { HrChartsSection } from "../../components/hr/hr-charts-section";
import {
  CreateEmployeeAccountModal,
  type CreateEmployeeAccountPayload
} from "../../components/workspace/create-employee-account-modal";
import {
  HrBanner,
  HrDataBlock,
  HrFullscreenPage,
  HrKpiBand,
  HrKpiCell,
  HrPageHero
} from "../../components/hr/hr-shell";
import type { HrEmployeeAnalytics, HrSalaryExpense } from "../../lib/hr-analytics";

type RoleMeta = {
  id: string;
  name: string;
  key: string;
  department?: { id: string; name: string } | null;
};

type Leader = { id: string; name: string | null; email: string };

type Employee = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notificationEmail: string | null;
  status: string;
  jobTitle: string | null;
  employmentType: string | null;
  hireDate: string | null;
  monthlySalary: number | null;
  reportsToDirectorId: string | null;
  reportsToDirector: Leader | null;
  roles: RoleMeta[];
  departments: Array<{ id: string; name: string }>;
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" }
];

function formatKes(amount: number | null): string {
  if (amount == null) return "—";
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
}

export function HrEmployeesConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessHrWorkspace(auth.roleKeys);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryExpenses, setSalaryExpenses] = useState<HrSalaryExpense[]>([]);
  const [roles, setRoles] = useState<RoleMeta[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [editing, setEditing] = useState<Employee | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [empRes, metaRes, payRes] = await Promise.all([
        apiFetch("/hr/employees"),
        apiFetch("/hr/meta"),
        apiFetch("/hr/payroll")
      ]);
      if (!empRes.ok) {
        const data = (await empRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to load employees (${empRes.status})`);
      }
      if (!metaRes.ok) {
        const data = (await metaRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to load HR metadata (${metaRes.status})`);
      }
      const empData = (await empRes.json()) as Employee[];
      const meta = (await metaRes.json()) as { roles: RoleMeta[]; leaders: Leader[] };
      setEmployees(empData);
      setRoles(meta.roles ?? []);
      setLeaders(meta.leaders ?? []);
      if (payRes.ok) {
        const pay = (await payRes.json()) as { salaryExpenses?: HrSalaryExpense[] };
        setSalaryExpenses(pay.salaryExpenses ?? []);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  const stats = useMemo(() => {
    const payroll = employees.reduce((sum, e) => sum + (e.monthlySalary ?? 0), 0);
    return { total: employees.length, payroll };
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.email.toLowerCase().includes(q) ||
        (e.name?.toLowerCase().includes(q) ?? false) ||
        (e.jobTitle?.toLowerCase().includes(q) ?? false) ||
        e.roles.some((r) => r.name.toLowerCase().includes(q))
    );
  }, [employees, search]);

  async function createEmployee(payload: CreateEmployeeAccountPayload) {
    setCreateError(null);
    if (!payload.email.trim() || !payload.password) {
      setCreateError("Email and password are required.");
      return;
    }
    if (payload.password.length < 8) {
      setCreateError("Password must be at least 8 characters.");
      return;
    }
    setCreateBusy(true);
    try {
      const res = await apiFetch("/hr/users", {
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
        setCreateError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    setEditBusy(true);
    try {
      const res = await apiFetch(`/hr/employees/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          phone: editing.phone,
          notificationEmail: editing.notificationEmail,
          reportsToDirectorId: editing.reportsToDirectorId,
          jobTitle: editing.jobTitle,
          employmentType: editing.employmentType,
          hireDate: editing.hireDate ? editing.hireDate.slice(0, 10) : null,
          monthlySalary: editing.monthlySalary
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEditError(data.error ?? `Update failed (${res.status})`);
        return;
      }
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Network error");
    } finally {
      setEditBusy(false);
    }
  }

  async function assignRole(userId: string, roleId: string) {
    const res = await apiFetch(`/hr/employees/${userId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId })
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Failed to assign role");
      return;
    }
    await load();
  }

  if (!canAccess) {
    return (
      <div className="px-5 py-8 lg:px-8">
        <p className="text-slate-400">You don&apos;t have access to HR.</p>
      </div>
    );
  }

  return (
    <HrFullscreenPage>
      <HrPageHero
        eyebrow="Human Resources"
        title="Employees"
        description="Provision accounts, assign roles and teams, set reporting managers and compensation."
        backHref="/hr"
        actions={
          <button type="button" onClick={() => setShowCreate(true)} className={hrNeu.btnPrimary}>
            + New employee
          </button>
        }
      />

      {loadError ? <HrBanner tone="danger">{loadError}</HrBanner> : null}

      <HrKpiBand>
        <HrKpiCell label="Headcount" value={loading ? "…" : stats.total} hint="Internal staff" tone="rose" />
        <HrKpiCell
          label="Monthly payroll"
          value={loading ? "…" : formatKes(stats.payroll)}
          hint="Sum of salaries"
          tone="emerald"
        />
        <HrKpiCell
          label="Showing"
          value={filtered.length}
          hint={search ? "Filtered results" : "All employees"}
          tone="violet"
        />
        <HrKpiCell label="Roles available" value={roles.length} hint="Teams you can assign" tone="sky" />
      </HrKpiBand>

      <HrChartsSection
        employees={employees as HrEmployeeAnalytics[]}
        salaryExpenses={salaryExpenses}
        scheduleKpis={null}
        loading={loading}
        roleKeys={auth.roleKeys}
        variant="compact"
      />

      <HrDataBlock
        title="People directory"
        description={`${filtered.length} employee${filtered.length === 1 ? "" : "s"}`}
        toolbar={
          <HrInput
            type="search"
            placeholder="Search name, email, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
        }
      >
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading employees…</p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center lg:px-8">
            <p className="text-slate-400">{search ? "No matches." : "No employees yet."}</p>
            {!search && (
              <button type="button" onClick={() => setShowCreate(true)} className={`${hrNeu.btnPrimary} mt-4`}>
                Create first employee
              </button>
            )}
          </div>
        ) : (
          <div className={hrNeu.tableWrap}>
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-semibold lg:px-8">Employee</th>
                  <th className="px-4 py-3 font-semibold">Role / team</th>
                  <th className="px-4 py-3 font-semibold">Compensation</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Reports to</th>
                  <th className="px-4 py-3 font-semibold text-right lg:pr-8">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-3">
                        <HrAvatar name={emp.name} email={emp.email} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">{emp.name ?? "—"}</p>
                          <p className="truncate text-xs text-slate-500">{emp.email}</p>
                          <p className="mt-0.5 text-[10px] text-slate-600">
                            {emp.jobTitle ?? "No title"} · Hired {formatDate(emp.hireDate)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {emp.roles.map((r) => (
                          <HrBadge key={r.id} variant="role">
                            {r.name}
                          </HrBadge>
                        ))}
                        {emp.departments.map((d) => (
                          <HrBadge key={d.id} variant="dept">
                            {d.name}
                          </HrBadge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium tabular-nums text-emerald-300/90">{formatKes(emp.monthlySalary)}</p>
                      <p className="text-[10px] capitalize text-slate-500">
                        {(emp.employmentType ?? "full_time").replace("_", " ")}
                      </p>
                    </td>
                    <td className="hidden px-4 py-4 text-xs text-slate-400 md:table-cell">
                      {emp.reportsToDirector?.name ?? emp.reportsToDirector?.email ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <HrSelect
                          className="!w-auto !min-w-[7rem] !py-1.5 !text-xs"
                          defaultValue=""
                          onChange={(e) => {
                            const roleId = e.target.value;
                            if (!roleId) return;
                            void assignRole(emp.id, roleId);
                            e.target.value = "";
                          }}
                        >
                          <option value="">+ Role</option>
                          {roles
                            .filter((r) => !emp.roles.some((er) => er.id === r.id))
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                        </HrSelect>
                        <button
                          type="button"
                          onClick={() => setEditing({ ...emp })}
                          className={hrNeu.btnGhost}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HrDataBlock>

      <CreateEmployeeAccountModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateError(null);
        }}
        onSubmit={(payload) => void createEmployee(payload)}
        busy={createBusy}
        error={createError}
        roles={roles}
        leaders={leaders}
        theme="hr"
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={(e) => void saveEdit(e)}
            className={`${hrNeu.panel} hr-neu w-full max-w-lg max-h-[92dvh] overflow-y-auto`}
          >
            <h3 className="text-lg font-semibold text-slate-100">Edit {editing.name ?? editing.email}</h3>
            {editError && <p className="mt-2 text-xs text-rose-300">{editError}</p>}
            <div className="mt-4 grid gap-3">
              <div>
                <HrFieldLabel>Name</HrFieldLabel>
                <HrInput
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value || null })}
                />
              </div>
              <div>
                <HrFieldLabel>Phone</HrFieldLabel>
                <HrInput
                  value={editing.phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value || null })}
                />
              </div>
              <div>
                <HrFieldLabel>Job title</HrFieldLabel>
                <HrInput
                  value={editing.jobTitle ?? ""}
                  onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value || null })}
                />
              </div>
              <div>
                <HrFieldLabel>Employment type</HrFieldLabel>
                <HrSelect
                  value={editing.employmentType ?? "full_time"}
                  onChange={(e) => setEditing({ ...editing, employmentType: e.target.value })}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </HrSelect>
              </div>
              <div>
                <HrFieldLabel>Hire date</HrFieldLabel>
                <HrInput
                  type="date"
                  value={editing.hireDate ? editing.hireDate.slice(0, 10) : ""}
                  onChange={(e) => setEditing({ ...editing, hireDate: e.target.value || null })}
                />
              </div>
              <div>
                <HrFieldLabel>Monthly salary (KES)</HrFieldLabel>
                <HrInput
                  type="number"
                  min={0}
                  value={editing.monthlySalary ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      monthlySalary: e.target.value === "" ? null : Number(e.target.value)
                    })
                  }
                />
              </div>
              <div>
                <HrFieldLabel>Reports to</HrFieldLabel>
                <HrSelect
                  value={editing.reportsToDirectorId ?? ""}
                  onChange={(e) => setEditing({ ...editing, reportsToDirectorId: e.target.value || null })}
                >
                  <option value="">No reporting manager</option>
                  {leaders.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name ?? d.email}
                    </option>
                  ))}
                </HrSelect>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={hrNeu.btnGhost}>
                Cancel
              </button>
              <button type="submit" disabled={editBusy} className={hrNeu.btnPrimary}>
                {editBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </HrFullscreenPage>
  );
}
