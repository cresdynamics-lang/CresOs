"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";

type Summary = {
  leadsThisWeek: number;
  dealsWon: number;
  revenueReceived: number;
  invoiceOutstanding: number;
  activeProjects: number;
};

const ROLE_QUICK_LINKS: Record<string, { href: string; label: string }[]> = {
  sales: [{ href: "/crm", label: "CRM" }],
  ops: [{ href: "/projects", label: "Projects" }],
  director_admin: [{ href: "/analytics", label: "Analytics" }, { href: "/approvals", label: "Approvals" }],
  finance: [{ href: "/finance", label: "Finance" }, { href: "/approvals", label: "Approvals" }],
  analyst: [{ href: "/analytics", label: "Analytics" }, { href: "/crm", label: "CRM" }],
  admin: [{ href: "/admin", label: "Users & org" }, { href: "/analytics", label: "Analytics" }],
  client: []
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const { apiFetch, auth } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch("/analytics/summary");
        if (cancelled) return;
        if (!res.ok) {
          setSummaryError(true);
          return;
        }
        const data = (await res.json()) as Summary;
        setSummary(data);
      } catch {
        if (!cancelled) setSummaryError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [apiFetch]);

  const quickLinks = Array.from(
    new Map(
      auth.roleKeys.flatMap((r) => ROLE_QUICK_LINKS[r] ?? []).map((l) => [l.href, l])
    ).values()
  );
  const hasMetrics = summary != null && !summaryError;

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Dashboard</h2>
        <p className="text-sm text-slate-300">
          {hasMetrics
            ? "High-level view of CresOS: leads, deals, delivery, invoices, and revenue in one place."
            : "Welcome. Use the side panel to access your role-based tasks and reports."}
        </p>
      </div>

      {hasMetrics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Leads this week" value={summary!.leadsThisWeek} tone="green" />
          <Metric label="Deals won" value={summary!.dealsWon} tone="green" />
          <Metric label="Active projects" value={summary!.activeProjects} tone="blue" />
          <Metric label="Revenue received" value={`$${summary!.revenueReceived.toLocaleString()}`} tone="green" />
          <Metric label="Invoices outstanding" value={`$${summary!.invoiceOutstanding.toLocaleString()}`} tone="amber" />
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="shell">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Your duties</p>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone: "green" | "amber" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-sky-400";
  return (
    <div className="shell">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

