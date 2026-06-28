"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { hrNeu } from "../../components/hr/hr-theme";
import { HrAvatar, HrBadge } from "../../components/hr/hr-ui";
import { WorkforceAnalyticsPanel } from "../../components/analytics/workforce-analytics-panel";
import {
  HrBanner,
  HrDataBlock,
  HrFullscreenPage,
  HrKpiBand,
  HrKpiCell,
  HrPageHero,
  HrQuickNav,
  HrSection
} from "../../components/hr/hr-shell";
import { WorkspacePriorityGrid, type WorkspacePriorityItem } from "../../components/workspace/workspace-dashboard-primitives";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";
import { canAccessHrWorkspace } from "../../lib/is-hr-only";
import type { HrEmployeeAnalytics, HrSalaryExpense } from "../../lib/hr-analytics";

type PayrollSnapshot = {
  monthlyPayrollTotal: number;
  salaryExpenses: HrSalaryExpense[];
};

const QUICK_LINKS = [
  { href: "/hr/analytics", label: "Analytics" },
  { href: "/hr/employees", label: "Employees" },
  { href: "/hr/payroll", label: "Payroll" },
  { href: "/schedule", label: "Tasks" },
  { href: "/community", label: "Community" },
  { href: "/settings/account", label: "Settings" }
] as const;

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

export function HrOverviewDashboard() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessHrWorkspace(auth.roleKeys);

  const [employees, setEmployees] = useState<HrEmployeeAnalytics[]>([]);
  const [payroll, setPayroll] = useState<PayrollSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [empRes, payRes] = await Promise.all([
        apiFetch("/hr/employees"),
        apiFetch("/hr/payroll")
      ]);
      if (!empRes.ok) throw new Error("Failed to load employees");
      if (!payRes.ok) throw new Error("Failed to load payroll");
      setEmployees((await empRes.json()) as HrEmployeeAnalytics[]);
      const payData = (await payRes.json()) as PayrollSnapshot;
      setPayroll(payData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load HR data");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    let noManager = 0;
    let noSalary = 0;
    for (const e of employees) {
      if (!e.reportsToDirector) noManager++;
      if (e.monthlySalary == null) noSalary++;
      for (const r of e.roles) byRole[r.key] = (byRole[r.key] ?? 0) + 1;
    }
    const pendingSalaries = payroll?.salaryExpenses.filter((x) => x.status === "pending").length ?? 0;
    return {
      headcount: employees.length,
      payroll: payroll?.monthlyPayrollTotal ?? 0,
      teams: Object.keys(byRole).length,
      noManager,
      noSalary,
      pendingSalaries
    };
  }, [employees, payroll]);

  const priorities = useMemo((): WorkspacePriorityItem[] => {
    const items: WorkspacePriorityItem[] = [];
    if (stats.pendingSalaries > 0) {
      items.push({
        id: "pending-payroll",
        tone: "warning",
        title: `${stats.pendingSalaries} salary payment${stats.pendingSalaries === 1 ? "" : "s"} awaiting finance approval`,
        detail: "Finance or admin must approve before payroll is marked paid.",
        href: "/hr/payroll",
        action: "View payroll"
      });
    }
    if (stats.noSalary > 0) {
      items.push({
        id: "missing-salary",
        tone: "info",
        title: `${stats.noSalary} employee${stats.noSalary === 1 ? "" : "s"} without monthly salary set`,
        detail: "Add salary figures so payroll totals and finance sync stay accurate.",
        href: "/hr/employees",
        action: "Update roster"
      });
    }
    if (stats.noManager > 0) {
      items.push({
        id: "no-manager",
        tone: "info",
        title: `${stats.noManager} without a reporting manager`,
        detail: "Assign directors or admins as reports-to for clear org structure.",
        href: "/hr/employees",
        action: "Assign managers"
      });
    }
    return items;
  }, [stats]);

  const recentHires = useMemo(
    () =>
      [...employees]
        .filter((e) => e.hireDate)
        .sort((a, b) => new Date(b.hireDate!).getTime() - new Date(a.hireDate!).getTime())
        .slice(0, 5),
    [employees]
  );

  const alertClass = (tone: WorkspacePriorityItem["tone"]) => {
    if (tone === "danger") return hrNeu.alertDanger;
    if (tone === "warning") return hrNeu.alertWarning;
    return hrNeu.alertInfo;
  };

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
        title={welcomeHeadline}
        description="Live workforce analytics — team composition, hiring velocity, payroll movement, and org readiness from your employee and finance data."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={`${hrNeu.btnGhost} touch-manipulation disabled:opacity-50`}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link href="/hr/employees" className={`${hrNeu.btnPrimary} touch-manipulation`}>
              + New employee
            </Link>
          </>
        }
      />

      {loadError ? <HrBanner tone="danger">{loadError}</HrBanner> : null}

      <HrKpiBand>
        <HrKpiCell label="Headcount" value={loading ? "…" : stats.headcount} hint="Active internal staff" tone="rose" />
        <HrKpiCell
          label="Monthly payroll"
          value={loading ? "…" : formatKes(stats.payroll)}
          hint="Sum of employee salaries"
          tone="emerald"
        />
        <HrKpiCell label="Teams" value={loading ? "…" : stats.teams} hint="Distinct role groups" tone="violet" />
        <HrKpiCell
          label="Pending payroll"
          value={loading ? "…" : stats.pendingSalaries}
          hint="Awaiting finance approval"
          tone={stats.pendingSalaries > 0 ? "amber" : "sky"}
        />
      </HrKpiBand>

      <HrQuickNav links={QUICK_LINKS} />

      {priorities.length > 0 ? (
        <HrSection label="Today's priorities">
          <div className="px-5 lg:px-8">
            <WorkspacePriorityGrid items={priorities} panelClass={alertClass} />
          </div>
        </HrSection>
      ) : null}

      <WorkforceAnalyticsPanel
        variant="full"
        showHeader
        includeSchedule
        accent="hr"
        showSummaryStats={false}
      />

      <div className="grid lg:grid-cols-2">
        <HrDataBlock title="Recent hires" description="Latest people added to the org">
          {loading ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading…</p>
          ) : recentHires.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">No hire dates on file yet.</p>
          ) : (
            <ul>
              {recentHires.map((emp) => (
                <li key={emp.id} className={hrNeu.listRow}>
                  <div className="flex items-center gap-3">
                    <HrAvatar name={emp.name} email={emp.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-100">{emp.name ?? emp.email}</p>
                      <p className="truncate text-xs text-slate-500">{emp.jobTitle ?? "No title"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-rose-300/90">{formatDate(emp.hireDate)}</p>
                      <p className="text-[10px] text-slate-500">{formatKes(emp.monthlySalary ?? 0)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HrDataBlock>

        <HrDataBlock
          title="Live roster"
          description="Latest employees on file"
          toolbar={
            <Link href="/hr/employees" className="text-xs font-semibold text-rose-300 hover:text-rose-200">
              View all →
            </Link>
          }
        >
          {loading ? (
            <p className="px-5 py-6 text-sm text-slate-500 lg:px-8">Loading…</p>
          ) : employees.length === 0 ? (
            <div className="px-5 py-10 text-center lg:px-8">
              <p className="text-slate-400">No employees yet.</p>
              <Link href="/hr/employees" className={`${hrNeu.btnPrimary} mt-4 inline-block`}>
                Create first employee
              </Link>
            </div>
          ) : (
            <ul>
              {employees.slice(0, 6).map((emp) => (
                <li key={emp.id} className={hrNeu.listRow}>
                  <div className="flex items-center gap-3">
                    <HrAvatar name={emp.name} email={emp.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{emp.name ?? emp.email}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {emp.roles.slice(0, 2).map((r) => (
                          <HrBadge key={r.id} variant="role">
                            {r.name}
                          </HrBadge>
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-emerald-300/90">
                      {formatKes(emp.monthlySalary ?? 0)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HrDataBlock>
      </div>
    </HrFullscreenPage>
  );
}
