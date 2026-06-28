"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import { SalesOverviewDashboard, type SalesDashboardData } from "./sales-overview-dashboard";

export default function SalesHubPage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const keys = auth.roleKeys;
  const canSeeHub = keys.some((r) => ["admin", "sales", "director_admin", "finance"].includes(r));
  const canLoadSalesDashboard = keys.some((r) => ["admin", "sales"].includes(r));

  const [dashboard, setDashboard] = useState<SalesDashboardData | null>(null);
  const [loading, setLoading] = useState(canLoadSalesDashboard);
  const [scheduleKpis, setScheduleKpis] = useState<ScheduleKpiStats | null>(null);
  const [overdueReportQuestions, setOverdueReportQuestions] = useState(0);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canSeeHub) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canSeeHub, router]);

  useEffect(() => {
    if (!auth.accessToken || !canLoadSalesDashboard) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/sales/dashboard");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { data?: SalesDashboardData };
        if (body?.data && !cancelled) setDashboard(body.data);
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, apiFetch, canLoadSalesDashboard]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [schedRes, alarmRes] = await Promise.all([
          apiFetch("/schedule?period=week&completed=all"),
          keys.includes("sales") ? apiFetch("/reports/alarms/overdue") : Promise.resolve(null)
        ]);
        if (schedRes.ok && !cancelled) {
          const body = (await schedRes.json()) as { stats?: ScheduleKpiStats };
          if (body?.stats) setScheduleKpis(body.stats);
        }
        if (alarmRes?.ok && !cancelled) {
          const data = (await alarmRes.json()) as { overdue?: unknown[] };
          setOverdueReportQuestions(data.overdue?.length ?? 0);
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, auth.accessToken, apiFetch, keys]);

  if (!hydrated || !canSeeHub) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <SalesOverviewDashboard
      dashboard={dashboard}
      loading={loading}
      scheduleKpis={scheduleKpis}
      overdueReportQuestions={overdueReportQuestions}
    />
  );
}
