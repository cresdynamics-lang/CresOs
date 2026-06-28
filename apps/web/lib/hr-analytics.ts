export type ChartSlice = { label: string; value: number };

export type HrEmployeeAnalytics = {
  id: string;
  name: string | null;
  email: string;
  jobTitle: string | null;
  employmentType: string | null;
  hireDate: string | null;
  monthlySalary: number | null;
  profileCompletedAt?: string | null;
  reportsToDirector: { id?: string; name: string | null; email: string } | null;
  roles: Array<{ id: string; name: string; key: string }>;
  departments: Array<{ id: string; name: string }>;
};

export type HrSalaryExpense = {
  amount: number;
  status: string;
  spentAt: string;
};

export type HrOrgReadiness = {
  overall: number;
  managerAssigned: number;
  salarySet: number;
  jobTitleSet: number;
  profileComplete: number;
};

const HR_CHART_COLORS = [
  "bg-rose-500",
  "bg-pink-500",
  "bg-fuchsia-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-slate-500"
];

export function hrChartColor(index: number): string {
  return HR_CHART_COLORS[index % HR_CHART_COLORS.length];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-KE", { month: "short" });
}

/** Last N calendar months including current (oldest → newest). */
export function lastMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export function computeTeamByRole(employees: HrEmployeeAnalytics[]): ChartSlice[] {
  const counts: Record<string, number> = {};
  for (const e of employees) {
    if (e.roles.length === 0) {
      counts.Unassigned = (counts.Unassigned ?? 0) + 1;
      continue;
    }
    for (const r of e.roles) {
      counts[r.name] = (counts[r.name] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeTeamByDepartment(employees: HrEmployeeAnalytics[]): ChartSlice[] {
  const counts: Record<string, number> = {};
  for (const e of employees) {
    if (e.departments.length === 0) {
      counts.General = (counts.General ?? 0) + 1;
      continue;
    }
    for (const d of e.departments) {
      counts[d.name] = (counts[d.name] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeEmploymentTypeMix(employees: HrEmployeeAnalytics[]): ChartSlice[] {
  const counts: Record<string, number> = {};
  for (const e of employees) {
    const key = (e.employmentType ?? "full_time").replace(/_/g, " ");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

export function computePayrollByRole(employees: HrEmployeeAnalytics[]): ChartSlice[] {
  const sums: Record<string, number> = {};
  for (const e of employees) {
    const salary = e.monthlySalary ?? 0;
    if (salary <= 0) continue;
    const roleName = e.roles[0]?.name ?? "Unassigned";
    sums[roleName] = (sums[roleName] ?? 0) + salary;
  }
  return Object.entries(sums)
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export function computeHiringByMonth(employees: HrEmployeeAnalytics[], months = 6): ChartSlice[] {
  const keys = lastMonthKeys(months);
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const e of employees) {
    if (!e.hireDate) continue;
    const k = monthKey(new Date(e.hireDate));
    if (k in counts) counts[k]++;
  }
  return keys.map((k) => ({ label: monthLabel(k), value: counts[k] }));
}

export function computePayrollStatusMix(expenses: HrSalaryExpense[]): ChartSlice[] {
  const counts: Record<string, number> = {};
  for (const x of expenses) {
    const status = x.status || "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

export function computePayrollPaidByMonth(
  expenses: HrSalaryExpense[],
  months = 6
): ChartSlice[] {
  const keys = lastMonthKeys(months);
  const sums = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const x of expenses) {
    const k = monthKey(new Date(x.spentAt));
    if (!(k in sums)) continue;
    if (x.status === "approved" || x.status === "paid") {
      sums[k] += x.amount;
    }
  }
  return keys.map((k) => ({
    label: monthLabel(k),
    value: Math.round(sums[k] / 1000)
  }));
}

export function computePayrollPendingByMonth(
  expenses: HrSalaryExpense[],
  months = 6
): ChartSlice[] {
  const keys = lastMonthKeys(months);
  const sums = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const x of expenses) {
    const k = monthKey(new Date(x.spentAt));
    if (!(k in sums)) continue;
    if (x.status === "pending") sums[k] += x.amount;
  }
  return keys.map((k) => ({
    label: monthLabel(k),
    value: Math.round(sums[k] / 1000)
  }));
}

export function computeHeadcountTrend(employees: HrEmployeeAnalytics[], months = 6): number[] {
  const keys = lastMonthKeys(months);
  const now = new Date();
  return keys.map((k) => {
    const [y, m] = k.split("-").map(Number);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59);
    const cutoff = endOfMonth > now ? now : endOfMonth;
    return employees.filter((e) => {
      if (!e.hireDate) return false;
      return new Date(e.hireDate) <= cutoff;
    }).length;
  });
}

export function computeTeamSpanByManager(employees: HrEmployeeAnalytics[]): ChartSlice[] {
  const counts: Record<string, number> = {};
  for (const e of employees) {
    const mgr = e.reportsToDirector?.name ?? e.reportsToDirector?.email ?? "Unassigned";
    counts[mgr] = (counts[mgr] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function computeOrgReadiness(employees: HrEmployeeAnalytics[]): HrOrgReadiness {
  if (employees.length === 0) {
    return { overall: 0, managerAssigned: 0, salarySet: 0, jobTitleSet: 0, profileComplete: 0 };
  }
  const n = employees.length;
  const managerAssigned = employees.filter((e) => e.reportsToDirector).length;
  const salarySet = employees.filter((e) => e.monthlySalary != null && e.monthlySalary > 0).length;
  const jobTitleSet = employees.filter((e) => e.jobTitle?.trim()).length;
  const profileComplete = employees.filter((e) => e.profileCompletedAt).length;
  const managerPct = Math.round((managerAssigned / n) * 100);
  const salaryPct = Math.round((salarySet / n) * 100);
  const jobTitlePct = Math.round((jobTitleSet / n) * 100);
  const profilePct = Math.round((profileComplete / n) * 100);
  const overall = Math.round((managerPct + salaryPct + jobTitlePct + profilePct) / 4);
  return {
    overall,
    managerAssigned: managerPct,
    salarySet: salaryPct,
    jobTitleSet: jobTitlePct,
    profileComplete: profilePct
  };
}

export function dualPayrollMovement(
  expenses: HrSalaryExpense[],
  months = 6
): { label: string; a: number; b: number }[] {
  const keys = lastMonthKeys(months);
  const paid = Object.fromEntries(keys.map((k) => [k, 0]));
  const pending = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const x of expenses) {
    const k = monthKey(new Date(x.spentAt));
    if (!(k in paid)) continue;
    const amt = Math.round(x.amount / 1000);
    if (x.status === "pending") pending[k] += amt;
    else paid[k] += amt;
  }
  return keys.map((k) => ({
    label: k,
    a: paid[k],
    b: pending[k]
  }));
}

/** Total salary expense amount per month (KES thousands). */
export function computePayrollAmountTrend(expenses: HrSalaryExpense[], months = 6): ChartSlice[] {
  const keys = lastMonthKeys(months);
  const sums = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const x of expenses) {
    const k = monthKey(new Date(x.spentAt));
    if (!(k in sums)) continue;
    sums[k] += x.amount;
  }
  return keys.map((k) => ({
    label: monthLabel(k),
    value: Math.round(sums[k] / 1000)
  }));
}

export type HrAnalyticsSummary = {
  headcount: number;
  monthlyPayroll: number;
  pendingPayroll: number;
  teams: number;
  readiness: HrOrgReadiness;
};

export function buildHrAnalyticsSummary(
  employees: HrEmployeeAnalytics[],
  salaryExpenses: HrSalaryExpense[]
): HrAnalyticsSummary {
  const byRole = new Set<string>();
  for (const e of employees) {
    for (const r of e.roles) byRole.add(r.key);
  }
  return {
    headcount: employees.length,
    monthlyPayroll: employees.reduce((s, e) => s + (e.monthlySalary ?? 0), 0),
    pendingPayroll: salaryExpenses.filter((x) => x.status === "pending").length,
    teams: byRole.size,
    readiness: computeOrgReadiness(employees)
  };
}
