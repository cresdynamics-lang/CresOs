"use client";

import { Suspense, lazy, useCallback, useMemo, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminNeu } from "../../../components/admin/admin-theme";
import {
  ManagementDevelopersOverviewPanel,
  ManagementHrOverviewPanel,
  ManagementPmOverviewPanel,
  ManagementSalesOverviewPanel
} from "./admin-management-overviews";

export type AdminManagementTabId =
  | "sales"
  | "developers"
  | "hr"
  | "progress"
  | "approvals"
  | "sales-workspace"
  | "projects"
  | "managed"
  | "leads"
  | "crm"
  | "finance";

const TABS: { id: AdminManagementTabId; label: string; hint: string }[] = [
  { id: "sales", label: "Sales overview", hint: "Pipeline, win rate, leads, and sales report cadence" },
  { id: "developers", label: "Developers", hint: "Team velocity, load, blockers, and report activity" },
  { id: "hr", label: "HR · salaries", hint: "Headcount, monthly payroll, and salary coverage" },
  { id: "progress", label: "PM · progress", hint: "Delivery progress, portfolio health, and at-risk work" },
  { id: "approvals", label: "Approvals", hint: "Finance, project, and operational approval queues" },
  { id: "sales-workspace", label: "Sales workspace", hint: "Full sales pipeline workspace" },
  { id: "projects", label: "Projects", hint: "Delivery portfolio, status, and assignments" },
  { id: "managed", label: "Managed", hint: "Projects on management / monthly retainers" },
  { id: "leads", label: "Leads", hint: "Inbound leads and approval pipeline" },
  { id: "crm", label: "Clients & CRM", hint: "Clients, deals, and relationship records" },
  { id: "finance", label: "Finance", hint: "Invoices, payments, expenses, and ledger" }
];

const ApprovalsPanel = lazy(() => import("../../approvals/page"));
const SalesWorkspacePanel = lazy(() => import("../../sales/page"));
const ProjectsPanel = lazy(() => import("../../projects/page"));
const ManagedPanel = lazy(() => import("../../projects/management/page"));
const LeadsPanel = lazy(() => import("../../leads/page"));
const CrmPanel = lazy(() => import("../../crm/page"));
const FinancePanel = lazy(() => import("../../finance/page"));

const PANEL_BY_TAB: Record<AdminManagementTabId, ComponentType> = {
  sales: ManagementSalesOverviewPanel,
  developers: ManagementDevelopersOverviewPanel,
  hr: ManagementHrOverviewPanel,
  progress: ManagementPmOverviewPanel,
  approvals: ApprovalsPanel,
  "sales-workspace": SalesWorkspacePanel,
  projects: ProjectsPanel,
  managed: ManagedPanel,
  leads: LeadsPanel,
  crm: CrmPanel,
  finance: FinancePanel
};

function parseTab(raw: string | null): AdminManagementTabId {
  if (raw === "developers" || raw === "developer" || raw === "dev" || raw === "devs") return "developers";
  if (raw === "hr" || raw === "salaries" || raw === "payroll" || raw === "people") return "hr";
  if (raw === "progress" || raw === "pm" || raw === "delivery" || raw === "project-mgmt") return "progress";
  if (raw === "approvals" || raw === "approval") return "approvals";
  if (raw === "sales-workspace" || raw === "sales-ws" || raw === "pipeline") return "sales-workspace";
  if (raw === "projects" || raw === "project") return "projects";
  if (raw === "managed" || raw === "management") return "managed";
  if (raw === "leads" || raw === "lead") return "leads";
  if (raw === "crm" || raw === "clients" || raw === "client") return "crm";
  if (raw === "finance" || raw === "money") return "finance";
  if (raw === "sales" || raw === "sales-overview") return "sales";
  return "sales";
}

function PanelFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center px-4 py-10">
      <p className="font-body text-sm text-[#8B93A1]">Loading management…</p>
    </div>
  );
}

function AdminManagementHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const Panel = PANEL_BY_TAB[activeTab];
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const setTab = useCallback(
    (id: AdminManagementTabId) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === "sales") next.delete("tab");
      else next.set("tab", id);
      const qs = next.toString();
      router.replace(qs ? `/admin/management?${qs}` : "/admin/management", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[#E5E9EF] bg-white px-3 py-3 sm:px-5 sm:py-4">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B93A1]">
          Operations
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight text-[#1A1D26] sm:text-2xl">
              Management
            </h1>
            <p className="mt-0.5 max-w-2xl font-body text-sm text-[#5B6472]">
              {activeMeta.hint}. Sales, developers, HR salaries, and project progress first — then ops workspaces.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Management section"
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
                  "shrink-0 rounded-lg px-3 py-2 font-body text-[13px] font-semibold transition-colors",
                  selected
                    ? "bg-[#1A1D26] text-white"
                    : "border border-[#E8ECF1] bg-white text-[#5B6472] hover:border-[#CBD5E1] hover:text-[#1A1D26]"
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white"
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

export function AdminManagementHub() {
  return (
    <Suspense
      fallback={
        <div className={`flex min-h-[40vh] items-center justify-center ${adminNeu.canvas}`}>
          <p className="font-body text-sm text-[#8B93A1]">Loading management…</p>
        </div>
      }
    >
      <AdminManagementHubInner />
    </Suspense>
  );
}
