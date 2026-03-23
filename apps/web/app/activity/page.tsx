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

type ActivityFilter = "all" | "approvals" | "users" | "projects" | "delays";

function filterCategory(m: AdminMessage): ActivityFilter | "other" {
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
  return "other";
}

const FILTER_TABS: { id: ActivityFilter; label: string; className: string }[] = [
  { id: "all", label: "All events", className: "text-slate-100 bg-slate-700" },
  { id: "approvals", label: "Approvals", className: "text-amber-200 border border-amber-600/50" },
  { id: "users", label: "User changes", className: "text-sky-200 border border-sky-600/50" },
  { id: "projects", label: "Projects", className: "text-emerald-200 border border-emerald-600/50" },
  { id: "delays", label: "Delays", className: "text-rose-200 border border-rose-600/50" }
];

export default function ActivityPage() {
  const { apiFetch, auth } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const isAdmin = auth.roleKeys.includes("admin");

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch("/admin/messages");
        if (!cancelled && res.ok) {
          const data = (await res.json()) as AdminMessage[];
          setMessages(data);
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, isAdmin]);

  const filtered = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((m) => filterCategory(m) === filter);
  }, [messages, filter]);

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
        description="Immutable stream of governance-relevant events. Filter by category; entries are retained for audit."
      />

      <div className="shell border border-slate-600/60 bg-slate-950/40">
        <p className="text-sm leading-relaxed text-slate-400">
          This log is <strong className="text-slate-300">immutable</strong>. It records approvals, declines, role changes, invites, project transitions, module completion, finance requests, and sign-in events — each with a timestamp and actor where available. Admins can filter but cannot delete or edit entries.
        </p>
      </div>

      <div className="shell">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Live activity feed</p>
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
          <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {filtered.map((m) => (
              <li key={m.id} className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-slate-500">
                    {m.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-200">{m.summary}</p>
                {m.body && <p className="mt-1 text-xs text-slate-400 line-clamp-3">{m.body}</p>}
                {m.actor && (
                  <p className="mt-1 text-xs text-slate-500">
                    Actor: {m.actor.name ?? m.actor.email} ({m.actor.id.slice(0, 8)}…)
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shell border border-slate-600/80">
        <h3 className="text-sm font-semibold text-slate-200">Audit trail rules</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li>
            <strong className="text-slate-300">Immutability:</strong> No row can be edited or deleted — even by Admin — so disputes have a single source of truth for the Director.
          </li>
          <li>
            <strong className="text-slate-300">What generates a row:</strong> Finance request submitted · Approval or decline · Decline note · User invited or suspended · Role changed · Project assignment · Module complete · Director sign-off · Swap request · Sign-in (where logged).
          </li>
          <li>
            <strong className="text-slate-300">Export:</strong> Use Admin reporting or data export tools (where enabled) for date-bounded extracts for Director review or external audit.
          </li>
        </ul>
      </div>
    </section>
  );
}
