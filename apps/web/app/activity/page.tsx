"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type AdminMessage = {
  id: string;
  type: string;
  summary: string;
  body: string | null;
  actorId: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};

export default function ActivityPage() {
  const { apiFetch, auth } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!isAdmin) {
    return (
      <section className="shell">
        <p className="text-slate-400">Only Admin can view platform activity.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Activity</h2>
        <p className="text-sm text-slate-300">
          All key activities across CresOS: emails sent, approvals, finance and sales events,
          and other admin messages. Read-only stream for governance.
        </p>
      </div>
      <div className="shell">
        {loading ? (
          <p className="text-slate-400">Loading activity…</p>
        ) : messages.length === 0 ? (
          <p className="text-slate-400">No activity messages yet.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
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
                    By {m.actor.name ?? m.actor.email}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

