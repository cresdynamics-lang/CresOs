"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { hrNeu } from "../../components/hr/hr-theme";
import { HrAvatar, HrBadge, HrFieldLabel, HrInput, HrSelect } from "../../components/hr/hr-ui";
import { canAccessHrWorkspace } from "../../lib/is-hr-only";
import { HrChartsSection } from "../../components/hr/hr-charts-section";
import {
  HrBanner,
  HrDataBlock,
  HrFullscreenPage,
  HrKpiBand,
  HrKpiCell,
  HrPageHero
} from "../../components/hr/hr-shell";
import type { HrEmployeeAnalytics } from "../../lib/hr-analytics";

type PayrollEmployee = {
  id: string;
  name: string | null;
  email: string;
  monthlySalary: number | null;
  roles: string[];
};

type SalaryExpense = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  spentAt: string;
  description: string | null;
  beneficiary: { id: string; name: string | null; email: string } | null;
};

type PayrollData = {
  monthlyPayrollTotal: number;
  employees: PayrollEmployee[];
  salaryExpenses: SalaryExpense[];
};

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
}

function statusTone(status: string): "status" | "default" | "role" {
  if (status === "approved" || status === "paid") return "status";
  if (status === "pending") return "role";
  return "default";
}

export function HrPayrollConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessHrWorkspace(auth.roleKeys);

  const [data, setData] = useState<PayrollData | null>(null);
  const [rosterEmployees, setRosterEmployees] = useState<HrEmployeeAnalytics[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRecord, setShowRecord] = useState(false);

  const [beneficiaryUserId, setBeneficiaryUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [res, empRes] = await Promise.all([apiFetch("/hr/payroll"), apiFetch("/hr/employees")]);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load payroll (${res.status})`);
      }
      setData((await res.json()) as PayrollData);
      if (empRes.ok) {
        setRosterEmployees((await empRes.json()) as HrEmployeeAnalytics[]);
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

  async function recordPayroll(e: React.FormEvent) {
    e.preventDefault();
    setRecordError(null);
    setRecordSuccess(null);
    if (!beneficiaryUserId || !amount || !spentAt) {
      setRecordError("Employee, amount, and date are required.");
      return;
    }
    setRecordBusy(true);
    try {
      const res = await apiFetch("/hr/payroll/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryUserId,
          amount,
          spentAt,
          description: description.trim() || undefined,
          currency: "KES"
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setRecordError(body.error ?? `Record failed (${res.status})`);
        return;
      }
      setRecordSuccess(body.message ?? "Salary queued for finance approval.");
      setShowRecord(false);
      setAmount("");
      setDescription("");
      setBeneficiaryUserId("");
      await load();
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRecordBusy(false);
    }
  }

  function openRecord(emp?: PayrollEmployee) {
    if (emp) {
      setBeneficiaryUserId(emp.id);
      if (emp.monthlySalary != null) setAmount(String(emp.monthlySalary));
      setDescription(`Salary — ${emp.name ?? emp.email}`);
    }
    setShowRecord(true);
  }

  const pendingCount = data?.salaryExpenses.filter((x) => x.status === "pending").length ?? 0;

  if (!canAccess) {
    return (
      <div className="px-5 py-8 lg:px-8">
        <p className="text-slate-400">You don&apos;t have access to HR payroll.</p>
      </div>
    );
  }

  return (
    <HrFullscreenPage>
      <HrPageHero
        eyebrow="Human Resources"
        title="Payroll"
        description="Record salary payments — they sync to Finance as pending expenses for admin/finance approval."
        backHref="/hr"
        actions={
          <button type="button" onClick={() => openRecord()} className={hrNeu.btnPrimary}>
            Record payment
          </button>
        }
      />

      {loadError ? <HrBanner tone="danger">{loadError}</HrBanner> : null}
      {recordSuccess ? <HrBanner tone="success">{recordSuccess}</HrBanner> : null}

      <HrKpiBand>
        <HrKpiCell
          label="Monthly payroll"
          value={loading ? "…" : formatKes(data?.monthlyPayrollTotal ?? 0)}
          hint="Scheduled salaries"
          tone="emerald"
        />
        <HrKpiCell
          label="On roster"
          value={loading ? "…" : (data?.employees.length ?? 0)}
          hint="Employees with payroll"
          tone="rose"
        />
        <HrKpiCell
          label="Pending approval"
          value={loading ? "…" : pendingCount}
          hint="In finance queue"
          tone={pendingCount > 0 ? "amber" : "sky"}
        />
        <HrKpiCell
          label="Recent runs"
          value={loading ? "…" : (data?.salaryExpenses.length ?? 0)}
          hint="Salary expenses logged"
          tone="violet"
        />
      </HrKpiBand>

      <HrChartsSection
        employees={rosterEmployees}
        salaryExpenses={(data?.salaryExpenses ?? []).map((x) => ({
          amount: x.amount,
          status: x.status,
          spentAt: x.spentAt
        }))}
        scheduleKpis={null}
        loading={loading}
        roleKeys={auth.roleKeys}
        variant="payroll"
      />

      <HrDataBlock title="Payroll roster" description="Tap record to pre-fill a salary payment">
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading…</p>
        ) : !data?.employees.length ? (
          <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">No employees on payroll roster.</p>
        ) : (
          <ul>
            {data.employees.map((emp) => (
              <li key={emp.id} className={hrNeu.listRow}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <HrAvatar name={emp.name} email={emp.email} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{emp.name ?? emp.email}</p>
                      <p className="text-xs text-slate-500">{emp.roles.join(" · ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-emerald-300">
                      {formatKes(emp.monthlySalary ?? 0)}
                    </span>
                    <button type="button" onClick={() => openRecord(emp)} className={hrNeu.btnGhost}>
                      Record
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HrDataBlock>

      <HrDataBlock title="Finance sync" description="Recent payroll entries sent to Finance">
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading…</p>
        ) : !data?.salaryExpenses.length ? (
          <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">No salary expenses recorded yet.</p>
        ) : (
          <ul>
            {data.salaryExpenses.map((x) => (
              <li key={x.id} className={hrNeu.listRow}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">
                      {x.beneficiary?.name ?? x.beneficiary?.email ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">{x.description ?? "Salary"}</p>
                    <p className="mt-1 text-[10px] text-slate-600">{formatDate(x.spentAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <HrBadge variant={statusTone(x.status)}>{x.status}</HrBadge>
                    <span className="text-sm font-semibold tabular-nums text-emerald-300">
                      {x.currency} {x.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HrDataBlock>

      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={(e) => void recordPayroll(e)}
            className={`${hrNeu.panel} hr-neu w-full max-w-lg`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400/80">Payroll</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">Record salary payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecord(false)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {recordError && (
              <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                {recordError}
              </p>
            )}
            <div className="grid gap-3">
              <div>
                <HrFieldLabel>Employee</HrFieldLabel>
                <HrSelect
                  value={beneficiaryUserId}
                  onChange={(e) => setBeneficiaryUserId(e.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {(data?.employees ?? []).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name ?? emp.email}
                      {emp.monthlySalary != null ? ` — ${formatKes(emp.monthlySalary)}` : ""}
                    </option>
                  ))}
                </HrSelect>
              </div>
              <div>
                <HrFieldLabel>Amount (KES)</HrFieldLabel>
                <HrInput
                  type="number"
                  min={0}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <HrFieldLabel>Payment date</HrFieldLabel>
                <HrInput type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} required />
              </div>
              <div>
                <HrFieldLabel>Description</HrFieldLabel>
                <HrInput
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowRecord(false)} className={hrNeu.btnGhost}>
                Cancel
              </button>
              <button type="submit" disabled={recordBusy} className={hrNeu.btnPrimary}>
                {recordBusy ? "Sending…" : "Send to finance"}
              </button>
            </div>
          </form>
        </div>
      )}
    </HrFullscreenPage>
  );
}
