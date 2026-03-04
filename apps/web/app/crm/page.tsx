"use client";

import { useCallback, useEffect, useState } from "react";
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

type CrmContact = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  addedBy?: { name: string | null; email: string };
};

export default function CrmPage() {
  const { apiFetch, auth } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [contactForm, setContactForm] = useState({ email: "", phone: "", name: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const res = await apiFetch("/crm/contacts");
      if (res.ok) {
        const list = (await res.json()) as CrmContact[];
        setContacts(list);
      }
    } catch {
      // ignore
    }
  }, [apiFetch]);

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
        await loadContacts();
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch, loadContacts]);

  const canManageContacts = auth.roleKeys.some((r) => ["admin", "director_admin", "sales"].includes(r));

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    const email = contactForm.email.trim();
    const phone = contactForm.phone.trim();
    const name = contactForm.name.trim();
    if (!email && !phone) {
      setContactError("Enter at least an email or phone number.");
      return;
    }
    setContactSubmitting(true);
    setContactError(null);
    try {
      const res = await apiFetch("/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined, phone: phone || undefined, name: name || undefined })
      });
      if (res.ok) {
        setContactForm({ email: "", phone: "", name: "" });
        await loadContacts();
      } else {
        const data = await res.json().catch(() => ({}));
        setContactError(data.error ?? "Failed to add contact.");
      }
    } finally {
      setContactSubmitting(false);
    }
  }

  async function handleRemoveContact(id: string) {
    try {
      const res = await apiFetch(`/crm/contacts/${id}`, { method: "DELETE" });
      if (res.ok) await loadContacts();
    } catch {
      // ignore
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">CRM</h2>
        <p className="text-sm text-slate-300">
          Capture leads, track deals, and log activities so your pipeline
          reflects real conversations. Add outreach contacts to send emails or
          reach out about your services.
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

      <div className="shell">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          Outreach contacts
        </p>
        <p className="mb-3 text-sm text-slate-400">
          Add emails or phone numbers to contact about your services. These can
          be used to send communications and follow-ups.
        </p>
        {canManageContacts && (
          <form onSubmit={handleAddContact} className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Name</span>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Optional"
                className="w-40 rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Email</span>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-48 rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Phone</span>
              <input
                type="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Optional"
                className="w-36 rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <button
              type="submit"
              disabled={contactSubmitting}
              className="rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
            >
              {contactSubmitting ? "Adding…" : "Add contact"}
            </button>
            {contactError && (
              <p className="w-full text-sm text-amber-400">{contactError}</p>
            )}
          </form>
        )}
        <ul className="space-y-2 text-sm">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {c.name && <span className="text-slate-100">{c.name}</span>}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="text-sky-400 hover:underline"
                  >
                    {c.email}
                  </a>
                )}
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-slate-300 hover:underline"
                  >
                    {c.phone}
                  </a>
                )}
                {!c.name && !c.email && !c.phone && (
                  <span className="text-slate-500">—</span>
                )}
              </div>
              {canManageContacts && (
                <button
                  type="button"
                  onClick={() => handleRemoveContact(c.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  aria-label="Remove contact"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="text-sm text-slate-400">No outreach contacts yet. Add emails or phones to reach out about your services.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

