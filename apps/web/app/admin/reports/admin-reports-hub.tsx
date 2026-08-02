"use client";

import { Suspense, lazy, useCallback, useMemo, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type AdminReportTabId = "sales" | "developers" | "ai" | "finance" | "leadership";

const TABS: { id: AdminReportTabId; label: string; hint: string }[] = [
  { id: "sales", label: "Sales", hint: "Pipeline activity submissions" },
  { id: "developers", label: "Developers", hint: "Daily delivery write-ups" },
  { id: "ai", label: "AI", hint: "Leadership end-of-day briefings" },
  { id: "finance", label: "Finance", hint: "Period P&L style downloads" },
  { id: "leadership", label: "Leadership", hint: "Director-to-admin submissions" }
];

const SalesReportsPanel = lazy(() => import("../../reports/page"));
const DeveloperReportsPanel = lazy(() => import("../../developer-reports/page"));
const AiReportsPanel = lazy(() => import("../../reports/ai/page"));
const FinanceReportsPanel = lazy(() => import("../../finance/reports/page"));
const LeadershipReportsPanel = lazy(() => import("../../director-reports/page"));

const PANEL_BY_TAB: Record<AdminReportTabId, ComponentType> = {
  sales: SalesReportsPanel,
  developers: DeveloperReportsPanel,
  ai: AiReportsPanel,
  finance: FinanceReportsPanel,
  leadership: LeadershipReportsPanel
};

function parseTab(raw: string | null): AdminReportTabId {
  if (raw === "developers" || raw === "dev") return "developers";
  if (raw === "ai" || raw === "briefings") return "ai";
  if (raw === "finance") return "finance";
  if (raw === "leadership" || raw === "director") return "leadership";
  return "sales";
}

function PanelFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center px-4 py-10">
      <p className="text-sm text-[#8A8886]">Loading reports…</p>
    </div>
  );
}

function AdminReportsHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const Panel = PANEL_BY_TAB[activeTab];
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const setTab = useCallback(
    (id: AdminReportTabId) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === "sales") next.delete("tab");
      else next.set("tab", id);
      const qs = next.toString();
      router.replace(qs ? `/admin/reports?${qs}` : "/admin/reports", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <section className="admin-reports-neu flex min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-[#E1DFDD] bg-white px-3 py-3 sm:px-5 sm:py-4">
        <p className="text-[11px] font-semibold tracking-wide text-[#005CAB]">Insights</p>
        <div className="mt-0.5 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[#242424] sm:text-2xl">Reports</h1>
            <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-[#605E5C]">
              {activeMeta.hint}. Switch types below — sales, developers, AI, finance, and leadership.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Report type"
          className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(tab.id)}
                className={[
                  "shrink-0 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors",
                  selected
                    ? "bg-[#005CAB] text-white"
                    : "border border-[#E1DFDD] bg-white text-[#242424] hover:bg-[#F5F5F5]"
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="admin-reports-neu min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white"
        role="tabpanel"
        aria-label={activeMeta.label}
      >
        <Suspense fallback={<PanelFallback />}>
          <Panel />
        </Suspense>
      </div>
    </section>
  );
}

export function AdminReportsHub() {
  return (
    <Suspense
      fallback={
        <div className={`admin-reports-neu flex min-h-[40vh] items-center justify-center bg-white`}>
          <p className="text-sm text-[#8A8886]">Loading reports…</p>
        </div>
      }
    >
      <AdminReportsHubInner />
    </Suspense>
  );
}
