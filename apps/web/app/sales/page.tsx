"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { SalesWorkspaceNav } from "./sales-workspace-nav";
import { StatCard, StatCardGrid, type StatTone } from "../../components/stat-card";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { DashboardCardRow, DashboardScrollCard } from "../../components/dashboard-card-row";
import { WorkspaceHubCard } from "../../components/workspace-hub-card";
import { ScheduleKpiStrip, type ScheduleKpiStats } from "../../components/schedule-kpi-strip";

type HubCard = {
  href: string;
  title: string;
  description: string;
  action: string;
  roles: string[];
  tone: StatTone;
  icon: string;
};

const HUB_CARDS: HubCard[] = [
  {
    href: "/sales/invoices",
    title: "Invoices",
    description: "Dashboard, create draft invoices, and track finance approval status.",
    action: "Open invoices",
    roles: ["admin", "sales"],
    tone: "brand",
    icon: "₹"
  },
  {
    href: "/crm",
    title: "CRM",
    description: "Accounts, contacts, and pipeline in one place.",
    action: "Go to CRM",
    roles: ["admin", "sales", "director_admin", "finance"],
    tone: "sky",
    icon: "◎"
  },
  {
    href: "/leads",
    title: "Leads",
    description: "Capture, qualify, and move leads through your funnel.",
    action: "View leads",
    roles: ["admin", "director_admin", "sales", "finance"],
    tone: "amber",
    icon: "◆"
  },
  {
    href: "/reports",
    title: "Sales reports",
    description: "Activity, targets, and performance summaries.",
    action: "Open reports",
    roles: ["admin", "director_admin", "sales"],
    tone: "violet",
    icon: "▤"
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Delivery status, handoffs, and client work in progress.",
    action: "Browse projects",
    roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"],
    tone: "emerald",
    icon: "▣"
  },
  {
    href: "/approvals",
    title: "Approvals",
    description: "Pending finance and director decisions affecting sales.",
    action: "Review queue",
    roles: ["admin", "director_admin", "finance"],
    tone: "rose",
    icon: "✓"
  }
];

export default function SalesHubPage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const keys = auth.roleKeys;
  const canSeeHub = keys.some((r) => ["admin", "sales", "director_admin", "finance"].includes(r));
  const cards = HUB_CARDS.filter((c) => c.roles.some((r) => keys.includes(r)));
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number; rejected: number } | null>(
    null
  );
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [scheduleKpis, setScheduleKpis] = useState<ScheduleKpiStats | null>(null);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canSeeHub) {
      router.replace("/dashboard");
    }
  }, [hydrated, auth.accessToken, canSeeHub, router]);

  useEffect(() => {
    if (!auth.accessToken || !keys.some((r) => ["admin", "sales"].includes(r))) {
      setStatsLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/sales/dashboard");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.data?.stats && !cancelled) {
          setStats(data.data.stats);
        }
      } catch {
        /* optional snapshot */
      } finally {
        if (!cancelled) setStatsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, apiFetch, keys]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/schedule?period=week&completed=all");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { stats?: ScheduleKpiStats };
        if (body?.stats && !cancelled) setScheduleKpis(body.stats);
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
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <WorkspaceDashboardIntro
        title="Sales workspace"
        description="Jump to the tools you use for pipeline, delivery handoffs, and revenue."
        eyebrow="Sales"
      />

      <div className="mb-8">
        <SalesWorkspaceNav />
      </div>

      {scheduleKpis && (
        <div className="mb-6 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 via-slate-950/90 to-slate-950 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm font-semibold text-sky-300">This week — tasks & schedule</p>
            <a
              href="/schedule"
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
            >
              Open Tasks →
            </a>
          </div>
          <ScheduleKpiStrip stats={scheduleKpis} />
        </div>
      )}

      {keys.some((r) => ["admin", "sales"].includes(r)) && statsLoaded && stats && (
        <StatCardGrid>
          <StatCard label="Invoice drafts" value={stats.total} hint="Total drafts" tone="brand" />
          <StatCard label="Pending" value={stats.pending} hint="Awaiting approval" tone="amber" />
          <StatCard label="Approved" value={stats.approved} hint="Cleared" tone="emerald" />
          <StatCard label="Rejected" value={stats.rejected} hint="Declined" tone="rose" />
        </StatCardGrid>
      )}

      <div className="mt-8">
        <p className="mb-3 font-label text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
          Workspace tools
        </p>
        <DashboardCardRow lgCols={3}>
          {cards.map((card) => (
            <DashboardScrollCard key={card.href} width="wide">
              <WorkspaceHubCard
                href={card.href}
                title={card.title}
                description={card.description}
                action={card.action}
                tone={card.tone}
                icon={card.icon}
              />
            </DashboardScrollCard>
          ))}
        </DashboardCardRow>
      </div>
    </div>
  );
}
