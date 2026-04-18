"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { PageHeader } from "../page-header";
import { SalesWorkspaceNav } from "./sales-workspace-nav";
import { DashboardCardRow, DashboardScrollCard } from "../../components/dashboard-card-row";
import { ScheduleKpiStrip, type ScheduleKpiStats } from "../../components/schedule-kpi-strip";

type HubCard = {
  href: string;
  title: string;
  description: string;
  action: string;
  roles: string[];
};

const HUB_CARDS: HubCard[] = [
  {
    href: "/sales/invoices",
    title: "Invoices",
    description: "Dashboard, create draft invoices, and track finance approval status.",
    action: "Open invoices",
    roles: ["admin", "sales"]
  },
  {
    href: "/crm",
    title: "CRM",
    description: "Accounts, contacts, and pipeline in one place.",
    action: "Go to CRM",
    roles: ["admin", "sales", "director_admin", "finance"]
  },
  {
    href: "/leads",
    title: "Leads",
    description: "Capture, qualify, and move leads through your funnel.",
    action: "View leads",
    roles: ["admin", "director_admin", "sales", "finance"]
  },
  {
    href: "/reports",
    title: "Sales reports",
    description: "Activity, targets, and performance summaries.",
    action: "Open reports",
    roles: ["admin", "director_admin", "sales"]
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Delivery status, handoffs, and client work in progress.",
    action: "Browse projects",
    roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"]
  },
  {
    href: "/approvals",
    title: "Approvals",
    description: "Pending finance and director decisions affecting sales.",
    action: "Review queue",
    roles: ["admin", "director_admin", "finance"]
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
    const canSchedule = keys.some((r) => ["sales", "admin", "director_admin"].includes(r));
    if (!hydrated || !auth.accessToken || !canSchedule) return;
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
      <PageHeader
        title="Sales workspace"
        description="Jump to the tools you use for pipeline, delivery handoffs, and revenue."
      />

      <div className="mb-8">
        <SalesWorkspaceNav />
      </div>

      {scheduleKpis && (
        <div className="mb-6">
          <div className="shell py-1.5 sm:py-2.5">
            <ScheduleKpiStrip stats={scheduleKpis} />
          </div>
        </div>
      )}

      {keys.some((r) => ["admin", "sales"].includes(r)) && statsLoaded && stats && (
        <div className="mb-8">
          <div className="shell py-1.5 sm:py-2.5">
            <div className="flex w-full min-w-0 flex-nowrap items-stretch divide-x divide-slate-700/70 overflow-x-auto">
              {(
                [
                  { title: "Total", sub: "invoice drafts", value: stats.total, tone: "text-slate-100" },
                  { title: "Pending", sub: "awaiting approval", value: stats.pending, tone: "text-amber-400" },
                  { title: "Approved", sub: "cleared", value: stats.approved, tone: "text-emerald-400" },
                  { title: "Rejected", sub: "declined", value: stats.rejected, tone: "text-rose-400" }
                ] as const
              ).map((s) => (
                <div
                  key={s.title}
                  className="flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-x-0.5 px-1 py-0.5 sm:gap-x-1.5 sm:px-2 sm:py-1"
                >
                  <span className="shrink-0 text-[8px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">
                    {s.title}
                  </span>
                  <span className={`shrink-0 text-xs font-semibold tabular-nums leading-none sm:text-base ${s.tone}`}>
                    {s.value}
                  </span>
                  <span className="min-w-0 truncate text-[8px] leading-tight text-slate-500 sm:text-[10px]">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <DashboardCardRow lgCols={3}>
        {cards.map((card) => (
          <DashboardScrollCard key={card.href} width="wide">
          <div
            className="group flex h-full min-h-[200px] flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm transition-colors hover:border-slate-600 hover:bg-slate-900/70"
          >
            <h2 className="text-lg font-semibold text-slate-100">{card.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{card.description}</p>
            <Link
              href={card.href}
              className="mt-5 inline-flex w-fit items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {card.action}
            </Link>
          </div>
          </DashboardScrollCard>
        ))}
      </DashboardCardRow>
    </div>
  );
}
