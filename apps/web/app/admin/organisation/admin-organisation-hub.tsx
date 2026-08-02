"use client";

import { Suspense, lazy, useCallback, useMemo, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminNeu } from "../../../components/admin/admin-theme";

export type AdminOrgTabId = "users" | "departments" | "roles" | "clients";

const TABS: { id: AdminOrgTabId; label: string; hint: string }[] = [
  { id: "users", label: "Users", hint: "Accounts, roles, approvals, and reporting lines" },
  { id: "departments", label: "Departments", hint: "Org units and the roles mapped to each" },
  { id: "roles", label: "Roles", hint: "Permission keys and access templates" },
  { id: "clients", label: "Clients", hint: "Client portal access, sessions, and CRM-linked projects" }
];

const UsersPanel = lazy(() =>
  import("../admin-console").then((m) => ({
    default: function UsersPanel() {
      return <m.AdminConsole forceTab="users" embedded />;
    }
  }))
);
const DepartmentsPanel = lazy(() =>
  import("../admin-console").then((m) => ({
    default: function DepartmentsPanel() {
      return <m.AdminConsole forceTab="departments" embedded />;
    }
  }))
);
const RolesPanel = lazy(() =>
  import("../admin-console").then((m) => ({
    default: function RolesPanel() {
      return <m.AdminConsole forceTab="roles" embedded />;
    }
  }))
);
const ClientsPanel = lazy(() => import("../client-portal/client-portal-console"));

const PANEL_BY_TAB: Record<AdminOrgTabId, ComponentType> = {
  users: UsersPanel,
  departments: DepartmentsPanel,
  roles: RolesPanel,
  clients: ClientsPanel
};

function parseTab(raw: string | null): AdminOrgTabId {
  if (raw === "departments" || raw === "dept" || raw === "org") return "departments";
  if (raw === "roles" || raw === "role") return "roles";
  if (raw === "clients" || raw === "client" || raw === "portal") return "clients";
  return "users";
}

function PanelFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center px-4 py-10">
      <p className="font-body text-sm text-[#8B93A1]">Loading organisation…</p>
    </div>
  );
}

function AdminOrganisationHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const Panel = PANEL_BY_TAB[activeTab];
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const setTab = useCallback(
    (id: AdminOrgTabId) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === "users") next.delete("tab");
      else next.set("tab", id);
      const qs = next.toString();
      router.replace(qs ? `/admin/organisation?${qs}` : "/admin/organisation", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[#E5E9EF] bg-white px-3 py-3 sm:px-5 sm:py-4">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B93A1]">
          Administration
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight text-[#1A1D26] sm:text-2xl">
              Organisation
            </h1>
            <p className="mt-0.5 max-w-xl font-body text-sm text-[#5B6472]">
              {activeMeta.hint}. Toggle users, departments, roles, and client portal from one place.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Organisation section"
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
                    ? "bg-[#2D5A5A] text-white shadow-sm"
                    : "border border-[#E5E9EF] bg-[#F4F7F9] text-[#1A1D26] hover:bg-white"
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-6"
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

export function AdminOrganisationHub() {
  return (
    <Suspense
      fallback={
        <div className={`flex min-h-[40vh] items-center justify-center ${adminNeu.canvas}`}>
          <p className="font-body text-sm text-[#8B93A1]">Loading organisation…</p>
        </div>
      }
    >
      <AdminOrganisationHubInner />
    </Suspense>
  );
}
