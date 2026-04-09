"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { PageHeader } from "../page-header";
import { SalesWorkspaceNav } from "./sales-workspace-nav";

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

      {keys.some((r) => ["admin", "sales"].includes(r)) && statsLoaded && stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Invoice drafts (total)", value: stats.total, tone: "text-slate-200" },
            { label: "Pending approval", value: stats.pending, tone: "text-amber-400" },
            { label: "Approved", value: stats.approved, tone: "text-emerald-400" },
            { label: "Rejected", value: stats.rejected, tone: "text-rose-400" }
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-4 shadow-sm"
            >
              <div className={`text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.href}
            className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm transition-colors hover:border-slate-600 hover:bg-slate-900/70"
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
        ))}
      </div>
    </div>
  );
}
