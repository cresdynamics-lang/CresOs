"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import {
  SalesOverviewDashboard,
  type SalesChartSlice,
  type SalesOverviewKpis
} from "./sales-overview-dashboard";

type DealRow = { stage?: string | null };
type ProjectRow = { status?: string | null };
type LeadRow = { createdAt?: string };
type InvoiceRow = { status?: string | null };

type SalesDashData = {
  stats?: { outstanding?: number; paid?: number; overdue?: number };
  charts?: {
    invoicesByStatus?: SalesChartSlice[];
    dealsByStage?: SalesChartSlice[];
    projectsByStatus?: SalesChartSlice[];
  };
  alerts?: {
    outstandingInvoices?: number;
    overdueInvoices?: number;
    leadsPendingApproval?: number;
    dealsInProspect?: number;
  };
  kpis?: {
    leadsThisWeek?: number;
    activeDeals?: number;
    wonDeals?: number;
    activeProjects?: number;
  };
};

function countByKey(items: { label: string; value: number }[], label: string): number {
  return items.find((i) => i.label === label)?.value ?? 0;
}

function groupCount<T>(items: T[], keyFn: (item: T) => string): SalesChartSlice[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item).trim() || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default function SalesHubPage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const keys = auth.roleKeys;
  const canSeeHub = keys.some((r) => ["admin", "sales", "director_admin", "finance"].includes(r));
  const canLoadInvoices = keys.some((r) => ["admin", "sales"].includes(r));

  const [kpis, setKpis] = useState<SalesOverviewKpis | null>(null);
  const [charts, setCharts] = useState<{
    invoices: SalesChartSlice[];
    deals: SalesChartSlice[];
    projects: SalesChartSlice[];
    tasks: SalesChartSlice[];
  }>({ invoices: [], deals: [], projects: [], tasks: [] });
  const [alerts, setAlerts] = useState({
    outstandingInvoices: 0,
    overdueInvoices: 0,
    leadsPendingApproval: 0,
    dealsInProspect: 0
  });
  const [loading, setLoading] = useState(true);
  const [scheduleKpis, setScheduleKpis] = useState<ScheduleKpiStats | null>(null);
  const [overdueReportQuestions, setOverdueReportQuestions] = useState(0);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canSeeHub) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canSeeHub, router]);

  const load = useCallback(async () => {
    if (!auth.accessToken || !canSeeHub) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const weekStart = startOfWeek();
      const [dealsRes, projectsRes, leadsRes, schedRes, dashRes, invoicesRes, alarmRes] =
        await Promise.all([
          apiFetch("/crm/deals"),
          apiFetch("/projects"),
          apiFetch("/crm/leads"),
          apiFetch("/schedule?period=week&completed=all"),
          apiFetch("/sales/dashboard"),
          canLoadInvoices ? apiFetch("/sales/invoices?limit=100") : Promise.resolve(null),
          keys.includes("sales") ? apiFetch("/reports/alarms/overdue") : Promise.resolve(null)
        ]);

      let deals: DealRow[] = [];
      if (dealsRes.ok) {
        const raw = await dealsRes.json();
        deals = Array.isArray(raw) ? raw : [];
      }

      let projects: ProjectRow[] = [];
      if (projectsRes.ok) {
        const raw = await projectsRes.json();
        projects = Array.isArray(raw) ? raw : [];
      }

      let leads: LeadRow[] = [];
      if (leadsRes.ok) {
        const raw = await leadsRes.json();
        leads = Array.isArray(raw) ? raw : [];
      }

      let invoices: InvoiceRow[] = [];
      if (invoicesRes?.ok) {
        const raw = (await invoicesRes.json()) as { data?: InvoiceRow[] } | InvoiceRow[];
        invoices = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      }

      let sched: ScheduleKpiStats | null = null;
      if (schedRes.ok) {
        const body = (await schedRes.json()) as { stats?: ScheduleKpiStats };
        sched = body.stats ?? null;
        setScheduleKpis(sched);
      }

      if (alarmRes?.ok) {
        const data = (await alarmRes.json()) as { overdue?: unknown[] };
        setOverdueReportQuestions(data.overdue?.length ?? 0);
      }

      let dashStats: SalesDashData | null = null;

      if (dashRes.ok) {
        const body = (await dashRes.json()) as { data?: SalesDashData };
        dashStats = body.data ?? null;
      }

      const dealsChart = groupCount(deals, (d) => d.stage ?? "prospect");
      const projectsChart = groupCount(projects, (p) => p.status ?? "planned");
      const invoicesChart =
        invoices.length > 0
          ? groupCount(invoices, (i) => i.status ?? "draft")
          : (dashStats?.charts?.invoicesByStatus ?? []).filter((s) => s.value > 0);

      const leadsThisWeek = leads.filter((l) => l.createdAt && new Date(l.createdAt) >= weekStart).length;
      const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage ?? "")).length;
      const wonDeals = deals.filter((d) => d.stage === "won").length;
      const activeProjects = projects.filter((p) => ["planned", "active"].includes(p.status ?? "")).length;

      const outstanding =
        dashStats?.stats?.outstanding ??
        invoices.filter((i) => ["draft", "sent", "partial", "overdue"].includes(i.status ?? "")).length;
      const paid = dashStats?.stats?.paid ?? invoices.filter((i) => i.status === "paid").length;
      const overdue =
        dashStats?.stats?.overdue ?? invoices.filter((i) => i.status === "overdue").length;

      setKpis({
        leadsThisWeek: dashStats?.kpis?.leadsThisWeek ?? leadsThisWeek,
        activeDeals: dashStats?.kpis?.activeDeals ?? activeDeals,
        wonDeals: dashStats?.kpis?.wonDeals ?? wonDeals,
        activeProjects: dashStats?.kpis?.activeProjects ?? activeProjects,
        openInvoices: outstanding,
        paidInvoices: paid,
        overdueInvoices: overdue
      });

      setCharts({
        invoices: invoicesChart.length ? invoicesChart : (dashStats?.charts?.invoicesByStatus ?? []).filter((s) => s.value > 0),
        deals: dealsChart.length ? dealsChart : (dashStats?.charts?.dealsByStage ?? []).filter((s) => s.value > 0),
        projects:
          projectsChart.length ? projectsChart : (dashStats?.charts?.projectsByStatus ?? []).filter((s) => s.value > 0),
        tasks: sched
          ? [
              { label: "done", value: sched.completed },
              { label: "pending", value: sched.pending }
            ].filter((t) => t.value > 0)
          : []
      });

      setAlerts({
        outstandingInvoices: dashStats?.alerts?.outstandingInvoices ?? outstanding,
        overdueInvoices: dashStats?.alerts?.overdueInvoices ?? overdue,
        leadsPendingApproval:
          dashStats?.alerts?.leadsPendingApproval ??
          leads.filter((l) => (l as { approvalStatus?: string }).approvalStatus === "pending_approval").length,
        dealsInProspect: dashStats?.alerts?.dealsInProspect ?? countByKey(dealsChart, "prospect")
      });
    } catch {
      /* keep partial state */
    } finally {
      setLoading(false);
    }
  }, [apiFetch, auth.accessToken, canSeeHub, canLoadInvoices, keys]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hydrated || !canSeeHub) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <SalesOverviewDashboard
      kpis={kpis}
      charts={charts}
      alerts={alerts}
      loading={loading}
      scheduleKpis={scheduleKpis}
      overdueReportQuestions={overdueReportQuestions}
      onRefresh={() => void load()}
    />
  );
}
