"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type Summary = {
  leadsThisWeek: number;
  dealsWon: number;
  revenueReceived: number;
  invoiceOutstanding: number;
  activeProjects: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const { apiFetch } = useAuth();

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/analytics/summary");
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as Summary;
        setSummary(data);
      } catch {
        // ignore for now
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Dashboard</h2>
        <p className="text-sm text-slate-300">
          High-level view of CresOS: leads, deals, delivery, invoices, and
          revenue in one place.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Leads this week"
          value={summary?.leadsThisWeek ?? 0}
          tone="green"
        />
        <Metric
          label="Deals won"
          value={summary?.dealsWon ?? 0}
          tone="green"
        />
        <Metric
          label="Active projects"
          value={summary?.activeProjects ?? 0}
          tone="blue"
        />
        <Metric
          label="Revenue received"
          value={`$${summary?.revenueReceived.toLocaleString() ?? "0"}`}
          tone="green"
        />
        <Metric
          label="Invoices outstanding"
          value={`$${summary?.invoiceOutstanding.toLocaleString() ?? "0"}`}
          tone="amber"
        />
      </div>
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

