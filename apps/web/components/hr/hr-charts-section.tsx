"use client";

import Link from "next/link";
import {
  AreaTrendChart,
  DualBarChart,
  HorizontalBarChart,
  MiniLineTrend,
  PieChart,
  RadialProgress,
  VerticalBarChart
} from "../analytics/chart-widgets";
import { DashboardSectionLabel } from "../dashboard-welcome-banner";
import type { ScheduleKpiStats } from "../schedule-kpi-strip";
import { hrNeu } from "./hr-theme";
import { HrChartZone, HrKpiBand, HrKpiCell } from "./hr-shell";
import {
  buildHrAnalyticsSummary,
  computeEmploymentTypeMix,
  computeHeadcountTrend,
  computeHiringByMonth,
  computePayrollAmountTrend,
  computePayrollByRole,
  computePayrollStatusMix,
  computeTeamByDepartment,
  computeTeamByRole,
  computeTeamSpanByManager,
  dualPayrollMovement,
  hrChartColor,
  type HrEmployeeAnalytics,
  type HrSalaryExpense
} from "../../lib/hr-analytics";

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

type HrChartsSectionProps = {
  employees: HrEmployeeAnalytics[];
  salaryExpenses: HrSalaryExpense[];
  scheduleKpis: ScheduleKpiStats | null;
  loading: boolean;
  roleKeys: string[];
  variant?: "full" | "compact" | "payroll" | "finance";
  showHeader?: boolean;
  showSummaryStats?: boolean;
  accent?: "hr" | "finance";
};

export function HrChartsSection({
  employees,
  salaryExpenses,
  scheduleKpis,
  loading,
  roleKeys,
  variant = "full",
  showHeader = true,
  showSummaryStats = true,
  accent = "hr"
}: HrChartsSectionProps) {
  const linkClass =
    accent === "finance"
      ? "text-xs font-semibold text-emerald-300 hover:text-emerald-200"
      : "text-xs font-semibold text-rose-300 hover:text-rose-200";
  const summary = buildHrAnalyticsSummary(employees, salaryExpenses);
  const teamByRole = computeTeamByRole(employees);
  const teamByDept = computeTeamByDepartment(employees);
  const employmentMix = computeEmploymentTypeMix(employees);
  const payrollByRole = computePayrollByRole(employees);
  const hiringTrend = computeHiringByMonth(employees);
  const payrollStatus = computePayrollStatusMix(salaryExpenses);
  const managerSpan = computeTeamSpanByManager(employees);
  const headcountLine = computeHeadcountTrend(employees);
  const payrollMovement = dualPayrollMovement(salaryExpenses);
  const payrollAmountTrend = computePayrollAmountTrend(salaryExpenses);

  const taskBars =
    scheduleKpis != null
      ? [
          { label: "done", value: scheduleKpis.completed, color: "bg-emerald-500" },
          { label: "open", value: scheduleKpis.pending, color: "bg-rose-500" }
        ]
      : [];

  const readinessRow = (
    <div className={`grid gap-0 sm:grid-cols-2 xl:grid-cols-4 ${hrNeu.kpiBand}`}>
      <RadialProgress
        value={summary.readiness.overall}
        label="Org readiness"
        sublabel="Managers · salary · titles · profiles"
        color="#fb7185"
      />
      <RadialProgress
        value={summary.readiness.managerAssigned}
        label="Reporting lines"
        sublabel="Employees with a manager"
        color="#38bdf8"
      />
      <RadialProgress
        value={summary.readiness.salarySet}
        label="Payroll coverage"
        sublabel="Salaries on file"
        color="#34d399"
      />
      <RadialProgress
        value={summary.readiness.profileComplete}
        label="Profile completion"
        sublabel="Onboarding progress"
        color="#a78bfa"
      />
    </div>
  );

  if (variant === "compact") {
    return (
      <section aria-label="HR analytics preview" className="w-full">
        {showHeader ? (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <DashboardSectionLabel roleKeys={roleKeys} tone="dashboard">
              Workforce analytics
            </DashboardSectionLabel>
            <Link href="/hr/analytics" className={linkClass}>
              Full analytics →
            </Link>
          </div>
        ) : null}
        <div className="grid w-full gap-0 lg:grid-cols-2">
          <HrChartZone title="Team mix" subtitle="By role">
            <PieChart
              items={teamByRole}
              size={200}
              variant="donut"
              centerLabel={String(summary.headcount)}
              emptyLabel={loading ? "Loading…" : "No team data"}
            />
          </HrChartZone>
          <HrChartZone title="Hiring velocity" subtitle="Last 6 months">
            {hiringTrend.some((h) => h.value > 0) ? (
              <VerticalBarChart
                items={hiringTrend.map((h, idx) => ({
                  label: h.label,
                  value: h.value,
                  color: hrChartColor(idx)
                }))}
              />
            ) : (
              <p className="text-sm text-slate-500">{loading ? "Loading…" : "Set hire dates to see trend"}</p>
            )}
          </HrChartZone>
        </div>
      </section>
    );
  }

  if (variant === "finance") {
    return (
      <section aria-label="Workforce analytics" className="w-full">
        <HrKpiBand>
          <HrKpiCell label="Headcount" value={loading ? "…" : summary.headcount} hint="Internal staff" tone="rose" />
          <HrKpiCell
            label="Monthly payroll"
            value={loading ? "…" : formatKes(summary.monthlyPayroll)}
            hint="Scheduled salaries"
            tone="emerald"
          />
          <HrKpiCell
            label="Pending payroll"
            value={loading ? "…" : summary.pendingPayroll}
            hint="Awaiting finance"
            tone={summary.pendingPayroll > 0 ? "amber" : "sky"}
          />
          <HrKpiCell label="Teams" value={loading ? "…" : summary.teams} hint="Role groups" tone="violet" />
        </HrKpiBand>

        {readinessRow}

        <div className="grid w-full gap-0 xl:grid-cols-2">
          <HrChartZone title="Team composition" subtitle="Headcount by role — donut view">
            <PieChart
              items={teamByRole}
              size={220}
              variant="donut"
              centerLabel={String(summary.headcount)}
              emptyLabel={loading ? "Loading team data…" : "No employees with roles"}
            />
          </HrChartZone>
          <HrChartZone title="Department distribution" subtitle="How teams are spread">
            <PieChart
              items={teamByDept}
              size={220}
              variant="donut"
              emptyLabel={loading ? "Loading…" : "Assign department roles"}
            />
          </HrChartZone>
        </div>
      </section>
    );
  }

  if (variant === "payroll") {
    return (
      <section aria-label="Payroll analytics" className="w-full">
        {showHeader ? (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <DashboardSectionLabel roleKeys={roleKeys} tone="dashboard">
              Payroll analytics
            </DashboardSectionLabel>
            <Link href="/hr/analytics" className={linkClass}>
              Full analytics →
            </Link>
          </div>
        ) : null}
        <HrKpiBand cols={3}>
          <HrKpiCell label="Monthly payroll" value={loading ? "…" : formatKes(summary.monthlyPayroll)} tone="emerald" />
          <HrKpiCell label="Pending runs" value={loading ? "…" : summary.pendingPayroll} tone="amber" />
          <HrKpiCell
            label="Paid / approved"
            value={
              loading ? "…" : payrollStatus.filter((s) => s.label !== "pending").reduce((a, b) => a + b.value, 0)
            }
            tone="rose"
          />
        </HrKpiBand>
        <div className="grid w-full gap-0 xl:grid-cols-2">
          <HrChartZone title="Payroll pipeline" subtitle="Expense status">
            <PieChart
              items={payrollStatus}
              size={220}
              variant="donut"
              centerLabel={String(salaryExpenses.length)}
              emptyLabel={loading ? "Loading…" : "No payroll runs yet"}
            />
          </HrChartZone>
          <HrChartZone title="Payroll outflow" subtitle="KES thousands / month">
            <AreaTrendChart
              items={payrollAmountTrend}
              stroke="#34d399"
              valueSuffix="K"
              emptyLabel={loading ? "Loading…" : "Record salaries to see outflow trend"}
            />
          </HrChartZone>
          <div className="lg:col-span-2">
            <HrChartZone title="Payroll by team" subtitle="Monthly salary per role">
              <HorizontalBarChart
              items={payrollByRole.map((p, idx) => ({
                label: p.label,
                value: p.value,
                color: hrChartColor(idx)
              }))}
              valueSuffix=" KES"
              emptyLabel={loading ? "Loading…" : "Set salaries on employees"}
            />
          </HrChartZone>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="HR analytics" className="w-full">
      {showHeader ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={roleKeys} tone="dashboard">
            Data analytics
          </DashboardSectionLabel>
          <div className="flex flex-wrap items-center gap-3">
            {scheduleKpis ? (
              <p className="text-xs text-slate-500">
                Tasks: {scheduleKpis.completed} done · {scheduleKpis.pending} open
              </p>
            ) : null}
            <Link href="/hr/analytics" className={linkClass}>
              Expand analytics →
            </Link>
          </div>
        </div>
      ) : null}

      {showSummaryStats ? (
        <HrKpiBand>
          <HrKpiCell label="Headcount" value={loading ? "…" : summary.headcount} hint="Active staff" tone="rose" />
          <HrKpiCell
            label="Payroll"
            value={loading ? "…" : formatKes(summary.monthlyPayroll)}
            hint="Monthly scheduled"
            tone="emerald"
          />
          <HrKpiCell label="Teams" value={loading ? "…" : summary.teams} hint="Role groups" tone="violet" />
          <HrKpiCell
            label="Pending payroll"
            value={loading ? "…" : summary.pendingPayroll}
            hint="Awaiting finance"
            tone={summary.pendingPayroll > 0 ? "amber" : "sky"}
          />
        </HrKpiBand>
      ) : null}

      {readinessRow}

      <div className="grid w-full gap-0 xl:grid-cols-2">
        <HrChartZone title="Team composition" subtitle="Headcount by role — donut view">
          <PieChart
            items={teamByRole}
            size={240}
            variant="donut"
            centerLabel={String(summary.headcount)}
            emptyLabel={loading ? "Loading team data…" : "Add employees with roles"}
          />
        </HrChartZone>

        <HrChartZone title="Department distribution" subtitle="How teams are spread">
          <PieChart
            items={teamByDept}
            size={240}
            variant="donut"
            emptyLabel={loading ? "Loading…" : "Assign department roles"}
          />
        </HrChartZone>

        <HrChartZone title="Headcount growth" subtitle="6-month cumulative trend">
          {headcountLine.some((v) => v > 0) ? (
            <AreaTrendChart
              items={hiringTrend.map((h, i) => ({ label: h.label, value: headcountLine[i] ?? 0 }))}
              stroke="#fb7185"
              emptyLabel="No growth data"
            />
          ) : (
            <p className="text-sm text-slate-500">{loading ? "Loading…" : "Add hire dates for growth analytics"}</p>
          )}
        </HrChartZone>

        <HrChartZone title="Payroll outflow" subtitle="Salary expenses — KES thousands / month">
          <AreaTrendChart
            items={payrollAmountTrend}
            stroke="#34d399"
            valueSuffix="K"
            emptyLabel={loading ? "Loading…" : "Record payroll to see outflow"}
          />
        </HrChartZone>

        <HrChartZone title="Employment types" subtitle="Full-time · part-time · contract">
          <PieChart items={employmentMix} size={220} emptyLabel={loading ? "Loading…" : "No types recorded"} />
        </HrChartZone>

        <HrChartZone title="Payroll pipeline" subtitle="Finance approval status">
          <PieChart
            items={payrollStatus}
            size={220}
            variant="donut"
            centerLabel={String(salaryExpenses.length)}
            emptyLabel={loading ? "Loading…" : "No salary runs yet"}
          />
        </HrChartZone>

        <HrChartZone title="Payroll by team" subtitle="Monthly KES per role">
          <HorizontalBarChart
            items={payrollByRole.map((p, idx) => ({
              label: p.label,
              value: p.value,
              color: hrChartColor(idx)
            }))}
            valueSuffix=" KES"
            emptyLabel={loading ? "Loading…" : "Set monthly salaries"}
          />
        </HrChartZone>

        <HrChartZone title="Manager span" subtitle="Reports per leader">
          <HorizontalBarChart
            items={managerSpan.map((m, idx) => ({
              label: m.label,
              value: m.value,
              color: hrChartColor(idx + 2)
            }))}
            emptyLabel={loading ? "Loading…" : "Assign reporting managers"}
          />
        </HrChartZone>

        <HrChartZone title="Hiring velocity" subtitle="New hires per month">
          {hiringTrend.some((h) => h.value > 0) ? (
            <VerticalBarChart
              items={hiringTrend.map((h, idx) => ({
                label: h.label,
                value: h.value,
                color: hrChartColor(idx)
              }))}
            />
          ) : (
            <p className="text-sm text-slate-500">{loading ? "Loading…" : "No hires in last 6 months"}</p>
          )}
        </HrChartZone>

        <HrChartZone title="Payroll movement" subtitle="Paid vs pending (KES K / month)">
          {payrollMovement.some((m) => m.a > 0 || m.b > 0) ? (
            <DualBarChart items={payrollMovement} labelA="Paid / approved" labelB="Pending" />
          ) : (
            <p className="text-sm text-slate-500">{loading ? "Loading…" : "Record salary payments"}</p>
          )}
        </HrChartZone>

        <HrChartZone title="Weekly delivery" subtitle="Org task momentum">
          {taskBars.length > 0 && scheduleKpis!.total > 0 ? (
            <VerticalBarChart items={taskBars} />
          ) : (
            <p className="text-sm text-slate-500">{loading ? "Loading…" : "No tasks scheduled this week"}</p>
          )}
        </HrChartZone>

        <HrChartZone title="Headcount sparkline" subtitle="Quick 6-month view">
          {headcountLine.some((v) => v > 0) ? (
            <div className="w-full">
              <MiniLineTrend points={headcountLine} stroke="#fb7185" />
              <p className="mt-2 text-center text-xs text-slate-400">
                Now: <span className="font-semibold text-rose-300">{headcountLine[headcountLine.length - 1]}</span> people
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Hire dates needed</p>
          )}
        </HrChartZone>
      </div>
    </section>
  );
}
