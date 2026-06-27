"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { SalesStatInline, SalesStatRow } from "../../components/sales/sales-ui";
import { salesWs } from "../../components/sales/sales-theme";
import { ScheduleKpiStrip, type ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import type { StatTone } from "../../components/stat-card";

type HubCard = {
  href: string;
  title: string;
  description: string;
  action: string;
  roles: string[];
  tone: StatTone;
};

const HUB_CARDS: HubCard[] = [
  {
    href: "/sales/invoices",
    title: "Invoices",
    description: "Dashboard, create draft invoices, and track finance approval status.",
    action: "Open invoices",
    roles: ["admin", "sales"],
    tone: "brand"
  },
  {
    href: "/crm",
    title: "CRM",
    description: "Accounts, contacts, and pipeline in one place.",
    action: "Go to CRM",
    roles: ["admin", "sales", "director_admin", "finance"],
    tone: "sky"
  },
  {
    href: "/leads",
    title: "Leads",
    description: "Capture, qualify, and move leads through your funnel.",
    action: "View leads",
    roles: ["admin", "director_admin", "sales", "finance"],
    tone: "amber"
  },
  {
    href: "/reports",
    title: "Sales reports",
    description: "Activity, targets, and performance summaries.",
    action: "Open reports",
    roles: ["admin", "director_admin", "sales"],
    tone: "violet"
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Delivery status, handoffs, and client work in progress.",
    action: "Browse projects",
    roles: ["admin", "director_admin", "developer", "sales", "analyst", "finance"],
    tone: "emerald"
  },
  {
    href: "/approvals",
    title: "Approvals",
    description: "Pending finance and director decisions affecting sales.",
    action: "Review queue",
    roles: ["admin", "director_admin", "finance"],
    tone: "rose"
  }
];

const toolTitleClass: Record<StatTone, string> = {
  brand: "text-brand",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  sky: "text-sky-400",
  violet: "text-violet-400"
};

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
    <section className="flex min-h-0 flex-1 flex-col gap-8">
      <WorkspaceDashboardIntro
        title="Sales"
        description="Pipeline, delivery handoffs, and revenue in one workspace."
        eyebrow="Sales"
        welcomeChildren={
          <>
            <DashboardSectionLabel roleKeys={auth.roleKeys}>
              Today&apos;s priorities (your queue)
            </DashboardSectionLabel>
            <p className="font-body text-sm leading-relaxed text-slate-400">
              Use <span className="font-medium text-amber-300/90">Sales mail</span> and the sections below for live
              pipeline and delivery data.
            </p>
          </>
        }
      />

      {scheduleKpis && (
        <div className={salesWs.scheduleBanner}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm font-semibold text-sky-300">This week — tasks & schedule</p>
            <Link
              href="/schedule"
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
            >
              Open Tasks →
            </Link>
          </div>
          <ScheduleKpiStrip stats={scheduleKpis} />
        </div>
      )}

      {keys.some((r) => ["admin", "sales"].includes(r)) && statsLoaded && stats && (
        <SalesStatRow>
          <SalesStatInline label="Invoice drafts" value={stats.total} hint="Total drafts" tone="brand" />
          <SalesStatInline label="Pending" value={stats.pending} hint="Awaiting approval" tone="amber" />
          <SalesStatInline label="Approved" value={stats.approved} hint="Cleared" tone="emerald" />
          <SalesStatInline label="Rejected" value={stats.rejected} hint="Declined" tone="rose" />
        </SalesStatRow>
      )}

      <div>
        <p className="mb-2 font-label text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
          Workspace tools
        </p>
        <ul>
          {cards.map((card) => (
            <li key={card.href}>
              <Link href={card.href} className={salesWs.toolRow}>
                <div className="min-w-0">
                  <p className={`font-medium ${toolTitleClass[card.tone]}`}>{card.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{card.description}</p>
                </div>
                <span className="shrink-0 text-sm text-slate-400">{card.action} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
