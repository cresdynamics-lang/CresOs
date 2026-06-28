"use client";

import { useAuth } from "../../app/auth-context";
import { HrChartsSection } from "../hr/hr-charts-section";
import { DashboardSectionLabel } from "../dashboard-welcome-banner";
import { useWorkforceAnalytics } from "../../lib/use-workforce-analytics";

type WorkforceAnalyticsPanelProps = {
  variant?: "full" | "compact" | "payroll" | "finance";
  showHeader?: boolean;
  showSummaryStats?: boolean;
  includeSchedule?: boolean;
  className?: string;
  accent?: "hr" | "finance";
};

export function WorkforceAnalyticsPanel({
  variant = "full",
  showHeader = true,
  showSummaryStats = false,
  includeSchedule = false,
  className = "",
  accent = "hr"
}: WorkforceAnalyticsPanelProps) {
  const { apiFetch, auth } = useAuth();
  const { data, loading, error, reload } = useWorkforceAnalytics(apiFetch, true, { includeSchedule });

  return (
    <section className={`w-full ${className}`.trim()} aria-label="Workforce analytics">
      {showHeader ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 px-5 lg:px-8">
          <DashboardSectionLabel roleKeys={auth.roleKeys} tone="dashboard">
            {accent === "finance" ? "Workforce & payroll" : "Data analytics"}
          </DashboardSectionLabel>
          <div className="flex items-center gap-3">
            {data?.generatedAt ? (
              <p className="text-[10px] text-slate-600">
                Live · {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-y border-rose-500/30 bg-rose-950/25 px-5 py-3 text-sm text-rose-200 lg:px-8">
          {error}
        </p>
      ) : null}

      <HrChartsSection
        employees={data?.employees ?? []}
        salaryExpenses={data?.salaryExpenses ?? []}
        scheduleKpis={data?.scheduleKpis ?? null}
        loading={loading}
        roleKeys={auth.roleKeys}
        variant={variant === "finance" ? "finance" : variant}
        showHeader={false}
        showSummaryStats={showSummaryStats}
        accent={accent}
      />
    </section>
  );
}
