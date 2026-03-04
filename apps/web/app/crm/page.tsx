"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type Lead = {
  id: string;
  title: string;
  status: string;
};

type Deal = {
  id: string;
  title: string;
  stage: string;
  value?: number;
};

export default function CrmPage() {
  const { apiFetch } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [leadsRes, dealsRes] = await Promise.all([
          apiFetch("/crm/leads"),
          apiFetch("/crm/deals")
        ]);
        if (leadsRes.ok) {
          const l = (await leadsRes.json()) as any[];
          setLeads(
            l.map((lead) => ({
              id: lead.id,
              title: lead.title,
              status: lead.status
            }))
          );
        }
        if (dealsRes.ok) {
          const d = (await dealsRes.json()) as any[];
          setDeals(
            d.map((deal) => ({
              id: deal.id,
              title: deal.title,
              stage: deal.stage,
              value: deal.value ? Number(deal.value) : undefined
            }))
          );
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">CRM</h2>
        <p className="text-sm text-slate-300">
          Capture leads, track deals, and log activities so your pipeline
          reflects real conversations.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Leads
          </p>
          <ul className="space-y-2 text-sm">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <span className="text-slate-100">{lead.title}</span>
                <span className="text-xs text-slate-400">{lead.status}</span>
              </li>
            ))}
            {leads.length === 0 && (
              <li className="text-sm text-slate-400">No leads yet.</li>
            )}
          </ul>
        </div>
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Deals
          </p>
          <ul className="space-y-2 text-sm">
            {deals.map((deal) => (
              <li
                key={deal.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div>
                  <p className="text-slate-100">{deal.title}</p>
                  <p className="text-xs text-slate-400">{deal.stage}</p>
                </div>
                {deal.value !== undefined && (
                  <span className="text-emerald-400">
                    ${deal.value.toLocaleString()}
                  </span>
                )}
              </li>
            ))}
            {deals.length === 0 && (
              <li className="text-sm text-slate-400">No deals yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

