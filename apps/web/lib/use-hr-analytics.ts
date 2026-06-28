"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleKpiStats } from "../components/schedule-kpi-strip";
import type { HrEmployeeAnalytics, HrSalaryExpense } from "./hr-analytics";

export type HrAnalyticsPayload = {
  employees: HrEmployeeAnalytics[];
  salaryExpenses: HrSalaryExpense[];
  monthlyPayrollTotal: number;
  scheduleKpis: ScheduleKpiStats | null;
};

export function useHrAnalyticsData(apiFetch: (path: string) => Promise<Response>, enabled = true) {
  const [data, setData] = useState<HrAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const [analyticsRes, schedRes] = await Promise.all([
        apiFetch("/analytics/workforce"),
        apiFetch("/schedule?period=week&completed=all")
      ]);
      if (!analyticsRes.ok) {
        const body = (await analyticsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load HR analytics (${analyticsRes.status})`);
      }
      const payload = (await analyticsRes.json()) as HrAnalyticsPayload;
      if (schedRes.ok) {
        const schedBody = (await schedRes.json()) as { stats?: ScheduleKpiStats };
        payload.scheduleKpis = schedBody.stats ?? null;
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
