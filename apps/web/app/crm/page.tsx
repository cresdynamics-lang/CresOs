"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "../format-money";
import { useAuth } from "../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../data-refresh";

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
  addedBy?: { name: string | null; email: string } | null;
  kind?: "manual" | "client_with_project";
};

type MessageTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export default function CrmPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [contactForm, setContactForm] = useState({ email: "", phone: "", name: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [templateChoice, setTemplateChoice] = useState<string>("");

  const canAccessCrm = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));
  const canManageContacts = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));
  const canBulkMessage = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessCrm) {
      router.replace("/leads");
    }
  }, [hydrated, auth.accessToken, canAccessCrm, router]);

  const loadContacts = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const res = await apiFetch("/crm/contacts");
      if (res.ok) {
        const list = (await res.json()) as CrmContact[];
        setContacts(list);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    }
  }, [apiFetch, auth.accessToken]);

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const [leadsRes, dealsRes, tplRes] = await Promise.all([
        apiFetch("/crm/leads"),
        apiFetch("/crm/deals"),
        apiFetch("/crm/message-templates")
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
      } else {
        setLeads([]);
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
      } else {
        setDeals([]);
      }
      if (tplRes.ok) {
        const data = (await tplRes.json()) as { templates?: MessageTemplate[] };
        setTemplates(data.templates ?? []);
      }
      await loadContacts();
    } catch {
      setLeads([]);
      setDeals([]);
    } finally {
      setLoadedOnce(true);
    }
  }, [apiFetch, auth.accessToken, loadContacts]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    void load();
  }, [hydrated, auth.accessToken, load]);

  useEffect(() => {
    const unsub = subscribeDataRefresh(() => {
      void load();
    });
    return unsub;
  }, [load]);

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
        emitDataRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setContactError((data as { error?: string }).error ?? "Failed to add contact.");
      }
    } finally {
      setContactSubmitting(false);
    }
  }

  async function handleRemoveContact(id: string) {
    try {
      const res = await apiFetch(`/crm/contacts/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadContacts();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        emitDataRefresh();
      }
    } catch {
      // ignore
    }
  }

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllWithEmail() {
    const withEmail = contacts.filter((c) => c.email && String(c.email).trim()).map((c) => c.id);
    setSelectedIds(new Set(withEmail));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  useEffect(() => {
    if (!templateChoice) return;
    const t = templates.find((x) => x.id === templateChoice);
    if (t) {
      setBulkSubject(t.subject);
      setBulkBody(t.body);
    }
  }, [templateChoice, templates]);

  async function handleBulkSend(e: React.FormEvent) {
    e.preventDefault();
    setBulkMessage(null);
    if (selectedIds.size === 0) {
      setBulkMessage("Select at least one contact with an email (or add emails first).");
      return;
    }
    if (!bulkSubject.trim() || !bulkBody.trim()) {
      setBulkMessage("Subject and message body are required.");
      return;
    }
    setBulkSending(true);
    try {
      const res = await apiFetch("/crm/bulk-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selectedIds),
          subject: bulkSubject.trim(),
          body: bulkBody.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBulkMessage(
          `Queued email to ${(data as { queued?: number }).queued ?? 0} recipient(s). They will be sent by the mail worker.`
        );
        clearSelection();
      } else {
        setBulkMessage((data as { error?: string }).error ?? "Could not queue messages.");
      }
    } catch {
      setBulkMessage("Network error.");
    } finally {
      setBulkSending(false);
    }
  }

  const contactsWithEmail = contacts.filter((c) => c.email && String(c.email).trim());

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-50">CRM</h2>
          <p className="text-sm text-slate-300">
            Pipeline and outreach in one place. Contacts below can receive bulk emails (templates for invoices, new products,
            or new services). Use <code className="rounded bg-slate-800 px-1">{"{{name}}"}</code> and{" "}
            <code className="rounded bg-slate-800 px-1">{"{{org}}"}</code> in the message body.
          </p>
        </div>
        <Link
          href="/leads"
          className="shrink-0 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Open Leads →
        </Link>
      </div>

      {!loadedOnce && (
        <div className="shell">
          <p className="text-sm text-slate-400">Loading CRM…</p>
        </div>
      )}

      {loadedOnce && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="shell">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Leads</p>
              <ul className="space-y-2 text-sm">
                {leads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 hover:border-slate-600"
                    >
                      <span className="text-slate-100">{lead.title}</span>
                      <span className="text-xs text-slate-400">{lead.status}</span>
                    </Link>
                  </li>
                ))}
                {leads.length === 0 && <li className="text-sm text-slate-400">No leads yet.</li>}
              </ul>
            </div>
            <div className="shell">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Deals</p>
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
                      <span className="text-emerald-400">{formatMoney(deal.value)}</span>
                    )}
                  </li>
                ))}
                {deals.length === 0 && <li className="text-sm text-slate-400">No deals yet.</li>}
              </ul>
            </div>
          </div>

          {canBulkMessage && (
            <div className="shell border-sky-800/40 bg-sky-950/20">
              <h3 className="mb-1 text-sm font-semibold text-sky-200">Bulk messages to clients &amp; contacts</h3>
              <p className="mb-4 text-xs text-slate-400">
                Choose recipients with email, pick a sample message or write your own, then queue. Messages are sent through
                the same email queue as the rest of the app (not instant).
              </p>
              <form onSubmit={handleBulkSend} className="flex flex-col gap-4">
                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-slate-500">Recipients ({selectedIds.size} selected)</p>
                    <button
                      type="button"
                      onClick={selectAllWithEmail}
                      className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Select all with email ({contactsWithEmail.length})
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {contacts.map((c) => {
                      const hasEmail = Boolean(c.email && String(c.email).trim());
                      return (
                        <li key={c.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleContact(c.id)}
                            disabled={!hasEmail}
                            className="rounded border-slate-600"
                          />
                          <span className={hasEmail ? "text-slate-200" : "text-slate-500"}>
                            {c.name || c.email || c.phone || "—"}
                            {c.kind === "client_with_project" && (
                              <span className="ml-1 text-[10px] text-emerald-400">· client</span>
                            )}
                            {hasEmail ? (
                              <span className="ml-2 text-xs text-slate-500">{c.email}</span>
                            ) : (
                              <span className="ml-2 text-xs text-amber-500/90">(add email to include)</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Sample message:</span>
                  <select
                    value={templateChoice}
                    onChange={(e) => setTemplateChoice(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">Custom only (no template)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Subject</span>
                  <input
                    type="text"
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    placeholder="Email subject line"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Message</span>
                  <textarea
                    value={bulkBody}
                    onChange={(e) => setBulkBody(e.target.value)}
                    rows={10}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    placeholder="Email body — use {{name}} for the contact name, {{org}} for your org name"
                  />
                </label>
                {bulkMessage && <p className="text-sm text-sky-300">{bulkMessage}</p>}
                <button
                  type="submit"
                  disabled={bulkSending || selectedIds.size === 0}
                  className="w-fit rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {bulkSending ? "Queueing…" : "Queue bulk emails"}
                </button>
              </form>
            </div>
          )}

          <div className="shell">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Outreach contacts (manual) and clients with projects
            </p>
            <p className="mb-3 text-sm text-slate-400">
              Add emails or phone numbers. These appear above for bulk messaging when an email is set.
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
                {contactError && <p className="w-full text-sm text-amber-400">{contactError}</p>}
              </form>
            )}
            <ul className="space-y-2 text-sm">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {c.name && (
                      <span className="text-slate-100">
                        {c.name}
                        {c.kind === "client_with_project" && (
                          <span className="ml-1 text-[10px] uppercase text-emerald-400">· client (with project)</span>
                        )}
                      </span>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-sky-400 hover:underline">
                        {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-slate-300 hover:underline">
                        {c.phone}
                      </a>
                    )}
                    {!c.name && !c.email && !c.phone && <span className="text-slate-500">—</span>}
                  </div>
                  {canManageContacts && c.kind !== "client_with_project" && (
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(c.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      aria-label="Remove contact"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
              {contacts.length === 0 && (
                <li className="text-sm text-slate-400">
                  No outreach contacts yet. Add emails or phones to reach out about your services.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
