"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "../format-money";
import { useAuth } from "../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../data-refresh";
import {
  CrmActionLink,
  CrmDataTable,
  CrmSectionPanel,
  CrmSectionQuickCard,
  CrmTabBar,
  CrmTableHead,
  type CrmTabDef
} from "../../components/crm/crm-section";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { DashboardCardRow, DashboardScrollCard } from "../../components/dashboard-card-row";

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

type ClientSummary = {
  key: string;
  clientId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  projects: { id: string; name: string; status: string; approvalStatus: string }[];
};

export default function CrmPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [clientSummary, setClientSummary] = useState<{ total: number; clients: ClientSummary[] } | null>(null);
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
  const [tab, setTab] = useState<"outreach" | "bulk" | "leads_deals" | "clients">("leads_deals");

  const canAccessCrm = auth.roleKeys.some((r) => ["admin", "sales", "director_admin", "finance"].includes(r));
  const canManageContacts = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));
  const canBulkMessage = auth.roleKeys.some((r) => ["admin", "sales", "director_admin"].includes(r));

  const tabs = useMemo((): CrmTabDef[] => {
    const all: (CrmTabDef & { hidden?: boolean })[] = [
      { key: "leads_deals", label: "Leads & deals", tone: "amber", icon: "◆" },
      { key: "outreach", label: "Outreach", tone: "violet", icon: "✉" },
      { key: "bulk", label: "Bulk messages", tone: "sky", icon: "◎", hidden: !canBulkMessage },
      { key: "clients", label: "Clients", tone: "emerald", icon: "▣" }
    ];
    return all.filter((t) => !t.hidden);
  }, [canBulkMessage]);

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

  const loadClients = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const res = await apiFetch("/crm/clients/summary");
      if (res.ok) {
        const data = (await res.json()) as { total: number; clients: ClientSummary[] };
        setClientSummary(data);
      } else {
        setClientSummary(null);
      }
    } catch {
      setClientSummary(null);
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
      await loadClients();
    } catch {
      setLeads([]);
      setDeals([]);
    } finally {
      setLoadedOnce(true);
    }
  }, [apiFetch, auth.accessToken, loadContacts, loadClients]);

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
      <WorkspaceDashboardIntro
        title="CRM"
        description="Contacts below can receive bulk emails (templates for invoices, new products, or new services)."
        brandLead="Pipeline and outreach in one place"
        eyebrow="Sales"
        showWelcomeBanner={false}
        actions={
          <Link
            href="/leads"
            className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
          >
            Open Leads →
          </Link>
        }
      />

      <p className="-mt-2 text-xs text-slate-500">
        Message templates: use <code className="rounded bg-slate-800 px-1 text-amber-400/90">{"{{name}}"}</code> and{" "}
        <code className="rounded bg-slate-800 px-1 text-amber-400/90">{"{{org}}"}</code> in the body.
      </p>

      {loadedOnce && (
        <>
          <DashboardCardRow lgCols={4} layout="scroll">
            {tabs.map((t) => (
              <DashboardScrollCard key={t.key}>
                <CrmSectionQuickCard
                  label={t.label}
                  description={
                    t.key === "leads_deals"
                      ? "Pipeline titles, status, and deal value."
                      : t.key === "outreach"
                        ? "Manual contacts and client outreach list."
                        : t.key === "bulk"
                          ? "Queue emails to selected contacts."
                          : "All clients and linked projects."
                  }
                  tone={t.tone}
                  icon={t.icon}
                  active={tab === t.key}
                  onClick={() => setTab(t.key as typeof tab)}
                />
              </DashboardScrollCard>
            ))}
          </DashboardCardRow>
          <CrmTabBar tabs={tabs} active={tab} onChange={(k) => setTab(k as typeof tab)} />
        </>
      )}

      {!loadedOnce && <p className="text-sm text-slate-400">Loading CRM…</p>}

      {loadedOnce && (
        <>
          {tab === "leads_deals" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <CrmSectionPanel title="Leads" tone="amber" description="Capture and qualify opportunities in your funnel.">
                <CrmDataTable emptyMessage="No leads yet." isEmpty={leads.length === 0}>
                  <table className="min-w-full text-left text-sm">
                    <CrmTableHead>
                      <th className="px-3 py-2.5 font-medium">Title</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Open</th>
                    </CrmTableHead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead.id} className="border-b border-slate-800/60 text-slate-200 last:border-0">
                          <td className="max-w-[20rem] break-words px-3 py-2.5 font-medium text-slate-100">
                            {lead.title}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                              {lead.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <CrmActionLink href={`/leads/${lead.id}`}>View</CrmActionLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CrmDataTable>
              </CrmSectionPanel>
              <CrmSectionPanel title="Deals" tone="emerald" description="Track stage and value through the pipeline.">
                <CrmDataTable emptyMessage="No deals yet." isEmpty={deals.length === 0}>
                  <table className="min-w-full text-left text-sm">
                    <CrmTableHead>
                      <th className="px-3 py-2.5 font-medium">Title</th>
                      <th className="px-3 py-2.5 font-medium">Stage</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Value</th>
                    </CrmTableHead>
                    <tbody>
                      {deals.map((deal) => (
                        <tr key={deal.id} className="border-b border-slate-800/60 text-slate-200 last:border-0">
                          <td className="max-w-[20rem] break-words px-3 py-2.5 font-medium text-slate-100">
                            {deal.title}
                          </td>
                          <td className="px-3 py-2.5 text-violet-300">{deal.stage}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-emerald-400">
                            {deal.value !== undefined ? formatMoney(deal.value) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CrmDataTable>
              </CrmSectionPanel>
            </div>
          )}

          {tab === "clients" && (
            <CrmSectionPanel
              title={`Clients (${clientSummary?.total ?? 0})`}
              tone="emerald"
              description="All project owners/clients are listed automatically. One row per project; contact columns repeat for the same client."
            >
              <CrmDataTable
                emptyMessage="No clients yet. Add a project with client details to populate."
                isEmpty={(clientSummary?.clients?.length ?? 0) === 0}
              >
                <table className="min-w-[42rem] w-full text-left text-sm">
                  <CrmTableHead>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium">Email</th>
                    <th className="px-3 py-2.5 font-medium">Phone</th>
                    <th className="px-3 py-2.5 font-medium">Project</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-medium">Approval</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Open</th>
                  </CrmTableHead>
                  <tbody>
                    {(clientSummary?.clients ?? []).slice(0, 30).flatMap((c) =>
                      c.projects.length === 0
                        ? [
                            <tr key={c.key} className="border-b border-slate-800/80 text-slate-200">
                              <td className="max-w-[12rem] px-3 py-2 font-medium text-slate-100 break-words">{c.name}</td>
                              <td className="max-w-[14rem] px-3 py-2 break-words text-slate-400">
                                {c.email ? (
                                  <a className="text-sky-400 hover:underline" href={`mailto:${c.email}`}>
                                    {c.email}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                                {c.phone ? (
                                  <a className="hover:underline" href={`tel:${c.phone}`}>
                                    {c.phone}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td colSpan={4} className="px-3 py-2 text-slate-500">
                                No linked projects
                              </td>
                            </tr>
                          ]
                        : c.projects.map((p) => (
                            <tr key={`${c.key}-${p.id}`} className="border-b border-slate-800/80 text-slate-200">
                              <td className="max-w-[12rem] px-3 py-2 font-medium text-slate-100 break-words">{c.name}</td>
                              <td className="max-w-[14rem] px-3 py-2 break-words text-slate-400">
                                {c.email ? (
                                  <a className="text-sky-400 hover:underline" href={`mailto:${c.email}`}>
                                    {c.email}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                                {c.phone ? (
                                  <a className="hover:underline" href={`tel:${c.phone}`}>
                                    {c.phone}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="max-w-[14rem] px-3 py-2 break-words text-slate-200">
                                <Link href={`/projects/${p.id}`} className="text-sky-300 hover:underline">
                                  {p.name}
                                </Link>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 capitalize text-slate-400">{p.status}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{p.approvalStatus}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right">
                                <CrmActionLink href={`/projects/${p.id}`}>View</CrmActionLink>
                              </td>
                            </tr>
                          ))
                    )}
                  </tbody>
                </table>
              </CrmDataTable>
            </CrmSectionPanel>
          )}

          {tab === "bulk" && canBulkMessage && (
            <CrmSectionPanel
              title="Bulk messages"
              tone="sky"
              description="Choose recipients with email, pick a sample message or write your own, then queue. Messages are sent through the same email queue as the rest of the app (not instant)."
            >
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
                  className="w-fit rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_-6px_rgba(14,165,233,0.5)] hover:bg-sky-500 disabled:opacity-50"
                >
                  {bulkSending ? "Queueing…" : "Queue bulk emails"}
                </button>
              </form>
            </CrmSectionPanel>
          )}

          {tab === "outreach" && (
            <CrmSectionPanel
              title="Outreach"
              tone="violet"
              description="Manual contacts and clients with projects. Add emails or phone numbers — they appear in Bulk messages when an email is set."
            >
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
                  className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-slate-950/50 px-3 py-2.5 transition-colors hover:border-violet-500/35"
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
                <li className="rounded-xl border border-dashed border-violet-500/25 bg-violet-500/5 px-4 py-8 text-center font-display text-sm text-violet-300/80">
                  No outreach contacts yet. Add emails or phones to reach out about your services.
                </li>
              )}
            </ul>
            </CrmSectionPanel>
          )}
        </>
      )}
    </section>
  );
}
