"use client";

import { Suspense, lazy, useCallback, useMemo, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminNeu } from "../../../components/admin/admin-theme";

export type AdminAiTabId = "command" | "tasks" | "playbook" | "pool" | "email";

const TABS: { id: AdminAiTabId; label: string; hint: string }[] = [
  { id: "command", label: "AI Command", hint: "Org intelligence — projects, people, hours, fit" },
  { id: "tasks", label: "AI tasks", hint: "Create meetings and tasks from language or voice" },
  { id: "playbook", label: "Playbook", hint: "Role playbook, expectations, who to ask" },
  { id: "pool", label: "Data pool", hint: "Searchable knowledge index for the whole org" },
  { id: "email", label: "Email AI", hint: "Inbox drafts, approvals, and automation" }
];

const CommandPanel = lazy(() =>
  import("./admin-ai-command-console").then((m) => ({
    default: function CommandPanel() {
      return <m.AdminAiCommandConsole forceMode="intelligence" embedded />;
    }
  }))
);
const TasksPanel = lazy(() =>
  import("./admin-ai-command-console").then((m) => ({
    default: function TasksPanel() {
      return <m.AdminAiCommandConsole forceMode="execute" embedded />;
    }
  }))
);
const PlaybookPanel = lazy(() =>
  import("../../../components/onboarding/onboarding-console").then((m) => ({
    default: m.OnboardingConsole
  }))
);
const PoolPanel = lazy(() =>
  import("../../pm/knowledge/page").then((m) => ({
    default: function PoolPanel() {
      return <m.KnowledgePoolConsole variant="admin" />;
    }
  }))
);
const EmailPanel = lazy(() =>
  import("../email-automation/email-automation-console").then((m) => ({
    default: m.EmailAutomationConsole
  }))
);

const PANEL_BY_TAB: Record<AdminAiTabId, ComponentType> = {
  command: CommandPanel,
  tasks: TasksPanel,
  playbook: PlaybookPanel,
  pool: PoolPanel,
  email: EmailPanel
};

function parseTab(raw: string | null): AdminAiTabId {
  if (raw === "tasks" || raw === "execute" || raw === "creation") return "tasks";
  if (raw === "playbook" || raw === "onboarding") return "playbook";
  if (raw === "pool" || raw === "data" || raw === "knowledge") return "pool";
  if (raw === "email" || raw === "emil" || raw === "mail") return "email";
  return "command";
}

function PanelFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center px-4 py-10">
      <p className="font-body text-sm text-[#8B93A1]">Loading AI workspace…</p>
    </div>
  );
}

function AdminAiCommandHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const Panel = PANEL_BY_TAB[activeTab];
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const setTab = useCallback(
    (id: AdminAiTabId) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === "command") next.delete("tab");
      else next.set("tab", id);
      const qs = next.toString();
      router.replace(qs ? `/admin/ai-command?${qs}` : "/admin/ai-command", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[#E5E9EF] bg-white px-3 py-3 sm:px-5 sm:py-4">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B93A1]">Command</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight text-[#1A1D26] sm:text-2xl">
              AI Command
            </h1>
            <p className="mt-0.5 max-w-xl font-body text-sm text-[#5B6472]">
              {activeMeta.hint}. One place for playbook, intelligence, task creation, data pool, and email AI.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="AI Command sections"
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

export function AdminAiCommandHub() {
  return (
    <Suspense
      fallback={
        <div className={`flex min-h-[40vh] items-center justify-center ${adminNeu.canvas}`}>
          <p className="font-body text-sm text-[#8B93A1]">Loading AI workspace…</p>
        </div>
      }
    >
      <AdminAiCommandHubInner />
    </Suspense>
  );
}
