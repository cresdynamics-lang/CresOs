"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleKpiStats } from "../components/schedule-kpi-strip";
import type { HrEmployeeAnalytics, HrSalaryExpense } from "./hr-analytics";

export type WorkforceAnalyticsPayload = {
  generatedAt?: string;
  employees: HrEmployeeAnalytics[];
  salaryExpenses: HrSalaryExpense[];
  monthlyPayrollTotal: number;
  scheduleKpis: ScheduleKpiStats | null;
};

export function useWorkforceAnalytics(
  apiFetch: (path: string) => Promise<Response>,
  enabled = true,
  options?: { includeSchedule?: boolean }
) {
  const [data, setData] = useState<WorkforceAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const requests: Promise<Response>[] = [apiFetch("/analytics/workforce")];
      if (options?.includeSchedule) {
        requests.push(apiFetch("/schedule?period=week&completed=all"));
      }
      const [workforceRes, schedRes] = await Promise.all(requests);
      if (!workforceRes.ok) {
        const body = (await workforceRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load workforce analytics (${workforceRes.status})`);
      }
      const payload = (await workforceRes.json()) as WorkforceAnalyticsPayload;
      if (schedRes?.ok) {
        const schedBody = (await schedRes.json()) as { stats?: ScheduleKpiStats };
        payload.scheduleKpis = schedBody.stats ?? null;
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workforce analytics");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, enabled, options?.includeSchedule]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
