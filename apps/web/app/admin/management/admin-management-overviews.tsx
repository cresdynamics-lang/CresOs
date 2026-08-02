"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { formatMoney } from "../../format-money";
import type { ProjectHealthBarItem } from "../../../components/analytics/chart-widgets";

/** Clean management overview palette — white cards, clear bar colors. */
const C = {
  ink: "#1A1D26",
  secondary: "#5B6472",
  muted: "#8B93A1",
  line: "#E8ECF1",
  track: "#EEF1F5",
  blue: "#2563EB",
  teal: "#0D9488",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  slate: "#475569"
} as const;

type BarItem = { label: string; value: number; color?: string };

function PanelShell({
  title,
  description,
  loading,
  error,
  onRefresh,
  reportsHref,
  reportsLabel = "Open reports",
  children
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Deep link into Admin → Reports for this domain */
  reportsHref?: string;
  reportsLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full w-full min-w-0 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-5 lg:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E1DFDD] pb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-[#8A8886]">Management</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#242424] sm:text-xl">{title}</h2>
            <p className="mt-1 max-w-xl text-[13px] font-medium leading-relaxed text-[#605E5C]">{description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {reportsHref ? (
              <Link
                href={reportsHref}
                className="rounded-md bg-[#005CAB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#004A8C]"
              >
                {reportsLabel}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="rounded-md border border-[#E1DFDD] bg-white px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#F5F5F5] disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>
        {error ? (
          <div className="rounded-lg border border-[#E8A0A6] bg-white px-3 py-2.5 text-sm text-[#C50F1F]">
            {error}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  className = ""
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex min-h-0 flex-col rounded-xl border border-[#E8ECF1] bg-white p-3.5 sm:p-4 ${className}`}
    >
      <h3 className="shrink-0 font-label text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B93A1]">
        {title}
      </h3>
      <div className="mt-3 min-h-0 flex-1">{children}</div>
    </article>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">{children}</div>;
}

function MetricCard({
  label,
  value,
  hint,
  accent = C.blue
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E8ECF1] bg-white px-3.5 py-3">
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.1em] text-[#8B93A1]">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums tracking-tight text-[#1A1D26] sm:text-2xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 font-body text-[11px] font-medium text-[#8B93A1]">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: accent }} />
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-[7rem] items-center justify-center text-center font-body text-xs font-medium text-[#8B93A1]">
      {children}
    </p>
  );
}

/** Compact clear vertical bars — white canvas, solid fill, short height. */
function ClearVBars({
  items,
  color = C.blue,
  empty = "No data yet"
}: {
  items: BarItem[];
  color?: string;
  empty?: string;
}) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex h-36 items-end gap-1.5 border-b border-[#E8ECF1] pb-0 pt-1 sm:h-40 sm:gap-2">
      {items.map((item) => {
        const pct = Math.max(6, Math.round((item.value / max) * 100));
        const barColor = item.color ?? color;
        return (
          <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-1 font-label text-[10px] font-bold tabular-nums text-[#1A1D26]">
              {item.value}
            </span>
            <div
              className="w-full max-w-[1.75rem] rounded-t-[3px] sm:max-w-[2rem]"
              style={{ height: `${pct}%`, backgroundColor: barColor }}
              title={`${item.label}: ${item.value}`}
            />
            <span
              className="mt-1.5 max-w-full truncate text-center font-label text-[9px] font-semibold text-[#8B93A1]"
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact clear horizontal bars. */
function ClearHBars({
  items,
  color = C.teal,
  empty = "No data yet",
  valueFormat
}: {
  items: BarItem[];
  color?: string;
  empty?: string;
  valueFormat?: (n: number) => string;
}) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        const barColor = item.color ?? color;
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate font-body text-xs font-semibold text-[#1A1D26]">{item.label}</span>
              <span className="shrink-0 font-label text-[11px] font-bold tabular-nums text-[#1A1D26]">
                {valueFormat ? valueFormat(item.value) : item.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EEF1F5]">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Two-series compare as clear side-by-side bars (won vs lost etc). */
function ClearCompareBars({
  items,
  empty = "No data yet"
}: {
  items: BarItem[];
  empty?: string;
}) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const palette = [C.green, C.red, C.blue, C.amber];
  return (
    <div className="flex h-36 items-end justify-around gap-4 border-b border-[#E8ECF1] px-2 pb-0 pt-1 sm:h-40">
      {items.map((item, i) => {
        const pct = Math.max(8, Math.round((item.value / max) * 100));
        const barColor = item.color ?? palette[i % palette.length];
        return (
          <div key={item.label} className="flex h-full w-full max-w-[4.5rem] flex-col items-center justify-end">
            <span className="mb-1 font-label text-sm font-bold tabular-nums text-[#1A1D26]">{item.value}</span>
            <div
              className="w-full max-w-[2.5rem] rounded-t-[4px]"
              style={{ height: `${pct}%`, backgroundColor: barColor }}
            />
            <span className="mt-2 text-center font-label text-[10px] font-semibold text-[#5B6472]">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Simple project progress strip — clear delivery bars only. */
function ProjectProgressBars({
  items,
  empty = "No projects yet"
}: {
  items: ProjectHealthBarItem[];
  empty?: string;
}) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="max-h-[16rem] space-y-2.5 overflow-y-auto pr-0.5">
      {items.slice(0, 8).map((p) => (
        <li key={p.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate font-body text-xs font-semibold text-[#1A1D26]" title={p.name}>
              {p.shortName || p.name}
            </span>
            <span className="shrink-0 font-label text-[11px] font-bold tabular-nums text-[#2563EB]">
              {p.deliveryPercent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#EEF1F5]">
            <div
              className="h-full rounded-full bg-[#2563EB]"
              style={{ width: `${Math.max(3, Math.min(100, p.deliveryPercent))}%` }}
            />
          </div>
          <div className="mt-1 flex gap-3 font-label text-[9px] font-medium text-[#8B93A1]">
            <span>Pay {p.paymentPercent}%</span>
            <span className={p.overduePercent > 0 ? "text-[#DC2626]" : undefined}>
              Late {p.overduePercent}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FooterLinks({ links }: { links: { href: string; label: string; primary?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[#E1DFDD] pt-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            l.primary
              ? "rounded-md bg-[#005CAB] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#004A8C]"
              : "rounded-md border border-[#E1DFDD] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#605E5C] hover:border-[#005CAB]/40 hover:text-[#005CAB]"
          }
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/* ─── Sales overview ─────────────────────────────────────────────── */

export function ManagementSalesOverviewPanel() {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<{
    totalPipelineValue: number;
    winRate: number;
    stalledDealsCount: number;
  } | null>(null);
  const [kpis, setKpis] = useState<{
    leadsThisMonth: number;
    dealsWon: number;
    dealsLost: number;
  } | null>(null);
  const [money, setMoney] = useState<{ totalOutstanding: number; overdueDebt: number } | null>(null);
  const [reportWeeks, setReportWeeks] = useState<{ week: string; sales: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, kRes, liveRes] = await Promise.all([
        apiFetch("/director/dashboard"),
        apiFetch("/dashboard/kpis"),
        apiFetch("/analytics/live-insights")
      ]);
      if (dRes.ok) {
        const d = (await dRes.json()) as {
          salesHealth?: {
            totalPipelineValue: number;
            winRate: number;
            stalledDealsCount: number;
          };
        };
        setSales(d.salesHealth ?? null);
      } else setSales(null);
      if (kRes.ok) {
        const k = (await kRes.json()) as {
          leadConversion?: { leadsThisMonth: number; dealsWon: number; dealsLost: number };
        };
        setKpis(k.leadConversion ?? null);
      } else setKpis(null);
      if (liveRes.ok) {
        const live = (await liveRes.json()) as {
          money?: { totalOutstanding?: number; overdueDebt?: number };
          team?: { reportActivity?: { week: string; sales: number; developer: number }[] };
        };
        setMoney({
          totalOutstanding: live.money?.totalOutstanding ?? 0,
          overdueDebt: live.money?.overdueDebt ?? 0
        });
        setReportWeeks(
          Array.isArray(live.team?.reportActivity)
            ? live.team!.reportActivity!.map((w) => ({ week: w.week, sales: w.sales }))
            : []
        );
      } else {
        setMoney(null);
        setReportWeeks([]);
      }
      if (!dRes.ok && !kRes.ok) setError("Could not load sales overview.");
    } catch {
      setError("Could not load sales overview.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const dealBars = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Won", value: kpis.dealsWon, color: C.green },
      { label: "Lost", value: kpis.dealsLost, color: C.red }
    ].filter((x) => x.value > 0);
  }, [kpis]);

  const reportBars = useMemo(
    () =>
      reportWeeks.slice(-8).map((w) => ({
        label: w.week.slice(5) || w.week,
        value: w.sales
      })),
    [reportWeeks]
  );

  return (
    <PanelShell
      title="Sales overview"
      description="Pipeline, win rate, and reporting — clean live snapshot."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      reportsHref="/admin/reports?tab=sales"
      reportsLabel="Sales reports →"
    >
      <MetricGrid>
        <MetricCard
          label="Pipeline"
          value={loading ? "…" : formatMoney(sales?.totalPipelineValue ?? 0)}
          hint="Open deal value"
          accent={C.blue}
        />
        <MetricCard
          label="Win rate"
          value={loading ? "…" : `${Math.round(sales?.winRate ?? 0)}%`}
          hint={`${sales?.stalledDealsCount ?? 0} stalled`}
          accent={C.teal}
        />
        <MetricCard
          label="Leads"
          value={loading ? "…" : kpis?.leadsThisMonth ?? 0}
          hint="This month"
          accent={C.amber}
        />
        <MetricCard
          label="Outstanding"
          value={loading ? "…" : formatMoney(money?.totalOutstanding ?? 0)}
          hint={money ? `${formatMoney(money.overdueDebt)} overdue` : "Invoices"}
          accent={C.red}
        />
      </MetricGrid>

      <CardGrid>
        <Card title="Deal outcomes">
          {loading ? <EmptyNote>Loading…</EmptyNote> : <ClearCompareBars items={dealBars} empty="No won/lost deals yet." />}
        </Card>
        <Card title="Sales reports (weekly)">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearVBars items={reportBars} color={C.blue} empty="No sales reports yet." />
          )}
        </Card>
      </CardGrid>

      <FooterLinks
        links={[
          { href: "/admin/reports?tab=sales", label: "Sales reports", primary: true },
          { href: "/admin/management?tab=leads", label: "Leads" },
          { href: "/admin/management?tab=crm", label: "CRM" },
          { href: "/admin/management?tab=sales-workspace", label: "Sales workspace" }
        ]}
      />
    </PanelShell>
  );
}

/* ─── Developers overview ────────────────────────────────────────── */

export function ManagementDevelopersOverviewPanel() {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [velocity, setVelocity] = useState<{ name: string; tasks14d: number; activeTasks: number }[]>([]);
  const [reportWeeks, setReportWeeks] = useState<{ week: string; developer: number }[]>([]);
  const [engagement, setEngagement] = useState<{ label: string; value: number }[]>([]);
  const [ops, setOps] = useState<{
    activeProjects: number;
    projectsAtRisk: number;
    blockedTasksAboveThreshold: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [liveRes, dRes] = await Promise.all([
        apiFetch("/analytics/live-insights"),
        apiFetch("/director/dashboard")
      ]);
      if (liveRes.ok) {
        const live = (await liveRes.json()) as {
          team?: {
            velocity?: { name: string; tasks14d: number; activeTasks: number }[];
            engagement?: { label: string; value: number }[];
            reportActivity?: { week: string; sales: number; developer: number }[];
          };
        };
        setVelocity(Array.isArray(live.team?.velocity) ? live.team!.velocity! : []);
        setEngagement(Array.isArray(live.team?.engagement) ? live.team!.engagement! : []);
        setReportWeeks(
          Array.isArray(live.team?.reportActivity)
            ? live.team!.reportActivity!.map((w) => ({ week: w.week, developer: w.developer }))
            : []
        );
      } else {
        setVelocity([]);
        setEngagement([]);
        setReportWeeks([]);
      }
      if (dRes.ok) {
        const d = (await dRes.json()) as {
          operationalHealth?: {
            activeProjects: number;
            projectsAtRisk: number;
            blockedTasksAboveThreshold: number;
          };
        };
        setOps(d.operationalHealth ?? null);
      } else setOps(null);
      if (!liveRes.ok && !dRes.ok) setError("Could not load developer overview.");
    } catch {
      setError("Could not load developer overview.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalTasks14d = useMemo(() => velocity.reduce((s, v) => s + v.tasks14d, 0), [velocity]);
  const totalActive = useMemo(() => velocity.reduce((s, v) => s + v.activeTasks, 0), [velocity]);
  const devReports = engagement.find((e) => e.label.toLowerCase().includes("dev"))?.value ?? 0;

  const velocityBars = useMemo(
    () =>
      velocity.slice(0, 6).map((v) => ({
        label: v.name.split(/\s+/)[0] || v.name,
        value: v.tasks14d
      })),
    [velocity]
  );

  const loadBars = useMemo(
    () =>
      velocity.slice(0, 6).map((v) => ({
        label: v.name.split(/\s+/)[0] || v.name,
        value: v.activeTasks
      })),
    [velocity]
  );

  const reportBars = useMemo(
    () =>
      reportWeeks.slice(-8).map((w) => ({
        label: w.week.slice(5) || w.week,
        value: w.developer
      })),
    [reportWeeks]
  );

  return (
    <PanelShell
      title="Developers overview"
      description="Throughput, load, and reporting — live team pulse."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      reportsHref="/admin/reports?tab=developers"
      reportsLabel="Dev reports →"
    >
      <MetricGrid>
        <MetricCard
          label="Done (14d)"
          value={loading ? "…" : totalTasks14d}
          hint="Tasks completed"
          accent={C.green}
        />
        <MetricCard
          label="Open tasks"
          value={loading ? "…" : totalActive}
          hint="Currently assigned"
          accent={C.blue}
        />
        <MetricCard
          label="At risk"
          value={loading ? "…" : ops?.projectsAtRisk ?? 0}
          hint={`${ops?.activeProjects ?? 0} active projects`}
          accent={C.amber}
        />
        <MetricCard
          label="Dev reports"
          value={loading ? "…" : devReports}
          hint="Last 8 weeks"
          accent={C.teal}
        />
      </MetricGrid>

      <CardGrid>
        <Card title="Velocity (tasks done)">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearHBars items={velocityBars} color={C.teal} empty="No completions yet." />
          )}
        </Card>
        <Card title="Active load">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearHBars items={loadBars} color={C.blue} empty="No open tasks." />
          )}
        </Card>
        <Card title="Reports (weekly)">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearVBars items={reportBars} color={C.teal} empty="No developer reports yet." />
          )}
        </Card>
        <Card title="Blocked / risk">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearCompareBars
              items={[
                {
                  label: "Blocked",
                  value: ops?.blockedTasksAboveThreshold ?? 0,
                  color: C.red
                },
                {
                  label: "At risk",
                  value: ops?.projectsAtRisk ?? 0,
                  color: C.amber
                }
              ]}
            />
          )}
        </Card>
      </CardGrid>

      <FooterLinks
        links={[
          { href: "/admin/reports?tab=developers", label: "Developer reports", primary: true },
          { href: "/admin/management?tab=progress", label: "PM progress" },
          { href: "/admin/management?tab=projects", label: "Projects" }
        ]}
      />
    </PanelShell>
  );
}

/* ─── HR / salaries overview ─────────────────────────────────────── */

type WorkforceEmployee = {
  id: string;
  name: string | null;
  email: string;
  jobTitle?: string | null;
  monthlySalary?: number | null;
  roles?: { key: string; name: string }[];
  hireDate?: string | null;
};

export function ManagementHrOverviewPanel() {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<WorkforceEmployee[]>([]);
  const [monthlyPayroll, setMonthlyPayroll] = useState(0);
  const [salaryExpenses, setSalaryExpenses] = useState<
    { amount: number; status: string; spentAt: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/analytics/workforce");
      if (!res.ok) {
        setError("Could not load workforce & salaries.");
        setEmployees([]);
        setMonthlyPayroll(0);
        setSalaryExpenses([]);
        return;
      }
      const data = (await res.json()) as {
        employees?: WorkforceEmployee[];
        monthlyPayrollTotal?: number;
        salaryExpenses?: { amount: number; status: string; spentAt: string }[];
      };
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
      setMonthlyPayroll(data.monthlyPayrollTotal ?? 0);
      setSalaryExpenses(Array.isArray(data.salaryExpenses) ? data.salaryExpenses : []);
    } catch {
      setError("Could not load workforce & salaries.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let noSalary = 0;
    const byRole: Record<string, number> = {};
    for (const e of employees) {
      if (e.monthlySalary == null) noSalary += 1;
      for (const r of e.roles ?? []) {
        byRole[r.name || r.key] = (byRole[r.name || r.key] ?? 0) + 1;
      }
    }
    const pending = salaryExpenses.filter((x) => x.status === "pending").length;
    const paidSum = salaryExpenses
      .filter((x) => x.status === "approved" || x.status === "paid")
      .reduce((s, x) => s + x.amount, 0);
    return {
      headcount: employees.length,
      noSalary,
      pending,
      paidSum,
      roleBars: Object.entries(byRole)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    };
  }, [employees, salaryExpenses]);

  const salaryBars = useMemo(
    () =>
      [...employees]
        .filter((e) => e.monthlySalary != null && e.monthlySalary > 0)
        .sort((a, b) => (b.monthlySalary ?? 0) - (a.monthlySalary ?? 0))
        .slice(0, 6)
        .map((e) => ({
          label: (e.name?.trim() || e.email).split(/\s+/)[0],
          value: e.monthlySalary ?? 0
        })),
    [employees]
  );

  return (
    <PanelShell
      title="HR · salaries"
      description="Headcount and payroll — clear salary snapshot."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      reportsHref="/admin/reports?tab=finance"
      reportsLabel="Finance reports →"
    >
      <MetricGrid>
        <MetricCard
          label="Headcount"
          value={loading ? "…" : stats.headcount}
          hint="On roster"
          accent={C.blue}
        />
        <MetricCard
          label="Monthly payroll"
          value={loading ? "…" : formatMoney(monthlyPayroll)}
          hint="Committed salaries"
          accent={C.green}
        />
        <MetricCard
          label="Missing salary"
          value={loading ? "…" : stats.noSalary}
          hint="Needs figure set"
          accent={C.amber}
        />
        <MetricCard
          label="Pending pay"
          value={loading ? "…" : stats.pending}
          hint="Awaiting approval"
          accent={C.red}
        />
      </MetricGrid>

      <CardGrid>
        <Card title="Team by role">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearHBars items={stats.roleBars} color={C.slate} empty="No role data yet." />
          )}
        </Card>
        <Card title="Highest salaries">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearHBars
              items={salaryBars}
              color={C.green}
              empty="No salaries set yet."
              valueFormat={(n) => formatMoney(n)}
            />
          )}
        </Card>
      </CardGrid>

      <FooterLinks
        links={[
          { href: "/admin/reports?tab=finance", label: "Finance reports", primary: true },
          { href: "/hr", label: "HR workspace" },
          { href: "/hr/payroll", label: "Payroll" }
        ]}
      />
    </PanelShell>
  );
}

/* ─── Project management · progress ──────────────────────────────── */

export function ManagementPmOverviewPanel() {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successRate, setSuccessRate] = useState(0);
  const [completionPie, setCompletionPie] = useState<{ label: string; value: number }[]>([]);
  const [healthSeries, setHealthSeries] = useState<ProjectHealthBarItem[]>([]);
  const [slowProjects, setSlowProjects] = useState<
    {
      id: string;
      name: string;
      status: string;
      daysActive: number;
      completionRate: number;
      overdueTasks: number;
    }[]
  >([]);
  const [kpis, setKpis] = useState<{
    activeProjects: number;
    overdueTasks: number;
    blockedTasks: number;
    milestonesDone: number;
    milestonesPending: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [liveRes, kRes] = await Promise.all([
        apiFetch("/analytics/live-insights"),
        apiFetch("/dashboard/kpis")
      ]);
      if (liveRes.ok) {
        const live = (await liveRes.json()) as {
          projects?: {
            successRate?: number;
            completionPie?: { label: string; value: number }[];
            healthSeries?: ProjectHealthBarItem[];
            slowProjects?: {
              id: string;
              name: string;
              status: string;
              daysActive: number;
              completionRate: number;
              overdueTasks: number;
            }[];
          };
        };
        setSuccessRate(live.projects?.successRate ?? 0);
        setCompletionPie(Array.isArray(live.projects?.completionPie) ? live.projects!.completionPie! : []);
        setHealthSeries(Array.isArray(live.projects?.healthSeries) ? live.projects!.healthSeries! : []);
        setSlowProjects(Array.isArray(live.projects?.slowProjects) ? live.projects!.slowProjects! : []);
      } else {
        setSuccessRate(0);
        setCompletionPie([]);
        setHealthSeries([]);
        setSlowProjects([]);
      }
      if (kRes.ok) {
        const k = (await kRes.json()) as {
          projectHealth?: {
            activeProjects: number;
            overdueTasks: number;
            blockedTasks: number;
            milestonesDone: number;
            milestonesPending: number;
          };
        };
        setKpis(k.projectHealth ?? null);
      } else setKpis(null);
      if (!liveRes.ok && !kRes.ok) setError("Could not load project progress overview.");
    } catch {
      setError("Could not load project progress overview.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const avgDelivery = useMemo(() => {
    if (healthSeries.length === 0) return 0;
    return Math.round(
      healthSeries.reduce((s, p) => s + (p.deliveryPercent ?? 0), 0) / healthSeries.length
    );
  }, [healthSeries]);

  const healthBars = useMemo(
    () =>
      completionPie.map((x) => ({
        label: x.label,
        value: x.value,
        color:
          x.label.toLowerCase().includes("track") || x.label.toLowerCase().includes("on")
            ? C.green
            : x.label.toLowerCase().includes("risk")
              ? C.amber
              : C.red
      })),
    [completionPie]
  );

  const slowBars = useMemo(
    () =>
      slowProjects.slice(0, 6).map((p) => ({
        label: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name,
        value: p.completionRate
      })),
    [slowProjects]
  );

  return (
    <PanelShell
      title="Project management · progress"
      description="Delivery and risk — progress bars you can scan quickly."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      reportsHref="/admin/reports?tab=developers"
      reportsLabel="Dev reports →"
    >
      <MetricGrid>
        <MetricCard
          label="Active"
          value={loading ? "…" : kpis?.activeProjects ?? healthSeries.length}
          hint="Projects"
          accent={C.blue}
        />
        <MetricCard
          label="Avg progress"
          value={loading ? "…" : `${avgDelivery}%`}
          hint="Delivery mean"
          accent={C.teal}
        />
        <MetricCard
          label="Success rate"
          value={loading ? "…" : `${successRate}%`}
          hint="≥80% complete"
          accent={C.green}
        />
        <MetricCard
          label="Overdue"
          value={loading ? "…" : kpis?.overdueTasks ?? 0}
          hint={`${kpis?.blockedTasks ?? 0} blocked`}
          accent={C.red}
        />
      </MetricGrid>

      <CardGrid>
        <Card title="Progress by project">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ProjectProgressBars items={healthSeries} empty="No project progress yet." />
          )}
        </Card>
        <Card title="Portfolio health">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearCompareBars items={healthBars} empty="No health mix yet." />
          )}
        </Card>
        <Card title="Payment collection">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearHBars
              items={healthSeries.slice(0, 6).map((p) => ({
                label: p.shortName || p.name,
                value: p.paymentPercent
              }))}
              color={C.green}
              empty="No payment data."
              valueFormat={(n) => `${n}%`}
            />
          )}
        </Card>
        <Card title="Slow / at-risk">
          {loading ? (
            <EmptyNote>Loading…</EmptyNote>
          ) : (
            <ClearHBars
              items={slowBars}
              color={C.amber}
              empty="No slow projects flagged."
              valueFormat={(n) => `${n}%`}
            />
          )}
        </Card>
      </CardGrid>

      <FooterLinks
        links={[
          { href: "/admin/reports?tab=developers", label: "Developer reports", primary: true },
          { href: "/admin/reports?tab=ai", label: "AI briefings" },
          { href: "/admin/management?tab=projects", label: "All projects" },
          { href: "/admin/management?tab=managed", label: "Managed" },
          { href: "/pm", label: "PM workspace" }
        ]}
      />
    </PanelShell>
  );
}
