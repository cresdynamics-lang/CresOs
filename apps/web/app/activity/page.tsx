"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { PageHeader } from "../page-header";

type AdminMessage = {
  id: string;
  type: string;
  summary: string;
  body: string | null;
  actorId: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};

type AuditEvent = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
};

type UnifiedRow =
  | { kind: "message"; createdAt: string; data: AdminMessage }
  | { kind: "audit"; createdAt: string; data: AuditEvent };

type ActivityFilter = "all" | "approvals" | "users" | "projects" | "delays" | "communications" | "audit";

function filterCategoryMessage(m: AdminMessage): ActivityFilter | "other" {
  const t = m.type.toLowerCase();
  if (t.includes("approval") || t.includes("finance") || t.includes("decline") || t.includes("payout") || t.includes("expense")) {
    return "approvals";
  }
  if (t.includes("user") || t.includes("invite") || t.includes("role") || t.includes("login") || t.includes("session")) {
    return "users";
  }
  if (t.includes("project") || t.includes("milestone") || t.includes("task") || t.includes("handoff")) {
    return "projects";
  }
  if (t.includes("delay") || t.includes("overdue") || t.includes("risk") || t.includes("blocked")) {
    return "delays";
  }
  if (t.includes("meeting") || t.includes("email") || t.includes("director") || t.includes("visibility")) {
    return "communications";
  }
  return "other";
}

function filterCategoryAudit(e: AuditEvent): ActivityFilter | "other" {
  const t = e.type.toLowerCase();
  if (t.includes("approval") || t.includes("finance") || t.includes("expense") || t.includes("payout")) {
    return "approvals";
  }
  if (t.includes("user") || t.includes("session") || t.includes("permission") || t.includes("invite")) {
    return "users";
  }
  if (t.includes("project") || t.includes("lead") || t.includes("task")) {
    return "projects";
  }
  if (t.includes("override") || t.includes("risk")) {
    return "delays";
  }
  return "audit";
}

function rowCategory(row: UnifiedRow): ActivityFilter | "other" {
  if (row.kind === "message") return filterCategoryMessage(row.data);
  const cat = filterCategoryAudit(row.data);
  return cat === "audit" ? "audit" : cat;
}

const FILTER_TABS: { id: ActivityFilter; label: string; className: string }[] = [
  { id: "all", label: "All events", className: "text-slate-100 bg-slate-700" },
  { id: "approvals", label: "Approvals & finance", className: "text-amber-200 border border-amber-600/50" },
  { id: "users", label: "Users & access", className: "text-sky-200 border border-sky-600/50" },
  { id: "projects", label: "Projects & delivery", className: "text-emerald-200 border border-emerald-600/50" },
  { id: "delays", label: "Risks & delays", className: "text-rose-200 border border-rose-600/50" },
  { id: "communications", label: "Meetings & mail", className: "text-violet-200 border border-violet-600/50" },
  { id: "audit", label: "System audit", className: "text-slate-200 border border-slate-500/50" }
];

export default function ActivityPage() {
  const { apiFetch, auth } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isAdmin = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [mRes, aRes] = await Promise.all([
          apiFetch("/admin/messages?limit=200"),
          apiFetch("/admin/audit?limit=200")
        ]);
        if (!cancelled && mRes.ok) {
          const data = (await mRes.json()) as AdminMessage[];
          setMessages(Array.isArray(data) ? data : []);
        }
        if (!cancelled && aRes.ok) {
          const data = (await aRes.json()) as AuditEvent[];
          setAudit(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
          setAudit([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, isAdmin]);

  const merged = useMemo((): UnifiedRow[] => {
    const a: UnifiedRow[] = messages.map((m) => ({ kind: "message" as const, createdAt: m.createdAt, data: m }));
    const b: UnifiedRow[] = audit.map((e) => ({ kind: "audit" as const, createdAt: e.createdAt, data: e }));
    return [...a, ...b].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  }, [messages, audit]);

  const filtered = useMemo(() => {
    if (filter === "all") return merged;
    return merged.filter((row) => {
      const cat = rowCategory(row);
      if (filter === "communications") return cat === "communications";
      if (filter === "audit") return row.kind === "audit" || cat === "audit";
      return cat === filter;
    });
  }, [merged, filter]);

  if (!isAdmin) {
    return (
      <section className="shell">
        <p className="text-slate-400">Only Admin can view platform activity.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Activity log"
        description="Admin activity messages plus the immutable event audit. Filter by category; expand rows for full detail."
      />

      <div className="shell border border-slate-600/60 bg-slate-950/40">
        <p className="text-sm leading-relaxed text-slate-400">
          Combines <strong className="text-slate-300">operational messages</strong> (meeting requests, emails, reminders) with the{" "}
          <strong className="text-slate-300">event audit</strong> (approvals, user actions, overrides). Entries cannot be edited or deleted.
        </p>
      </div>

      <div className="shell">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Live feed</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-slate-100 text-slate-900" : `bg-slate-900/80 ${tab.className} hover:bg-slate-800`
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-slate-400">Loading activity…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No events in this view yet.</p>
        ) : (
          <ul className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {filtered.map((row) => {
              const key = row.kind === "message" ? `m-${row.data.id}` : `e-${row.data.id}`;
              const isOpen = expanded[key] ?? false;
              if (row.kind === "message") {
                const m = row.data;
                return (
                  <li key={key} className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase text-slate-500">
                        {m.type.replace(/_/g, " ")} · message
                      </span>
                      <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-200">{m.summary}</p>
                    {m.body && (
                      <p className={`mt-1 text-xs text-slate-400 ${isOpen ? "whitespace-pre-wrap" : "line-clamp-4"}`}>{m.body}</p>
                    )}
                    {m.body && m.body.length > 200 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((s) => ({ ...s, [key]: !isOpen }))}
                        className="mt-1 text-xs text-sky-400 hover:underline"
                      >
                        {isOpen ? "Show less" : "Show full"}
                      </button>
                    )}
                    {m.actor && (
                      <p className="mt-1 text-xs text-slate-500">
                        Actor: {m.actor.name ?? m.actor.email}
                      </p>
                    )}
                  </li>
                );
              }
              const e = row.data;
              const metaStr =
                e.metadata != null ? JSON.stringify(e.metadata, null, 0) : "";
              return (
                <li key={key} className="rounded-lg border border-slate-600/80 bg-slate-900/40 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-slate-500">
                      {e.type.replace(/_/g, " ")} · {e.entityType}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {e.entityId}
                    {e.actorId && <span className="ml-2 text-slate-600">actor {e.actorId.slice(0, 8)}…</span>}
                  </p>
                  {metaStr && (
                    <p className={`mt-1 text-xs text-slate-400 ${isOpen ? "whitespace-pre-wrap break-all" : "line-clamp-3"}`}>{metaStr}</p>
                  )}
                  {metaStr.length > 180 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((s) => ({ ...s, [key]: !isOpen }))}
                      className="mt-1 text-xs text-sky-400 hover:underline"
                    >
                      {isOpen ? "Show less" : "Show full metadata"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shell border border-slate-600/80">
        <h3 className="text-sm font-semibold text-slate-200">Audit trail rules</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li>
            <strong className="text-slate-300">Immutability:</strong> No row can be edited or deleted — even by Admin — so disputes have a single source of truth.
          </li>
          <li>
            <strong className="text-slate-300">What you see:</strong> Admin messages (notifications stream) and EventLog audit rows (governance actions). Use filters to narrow.
          </li>
        </ul>
      </div>
    </section>
  );
}
