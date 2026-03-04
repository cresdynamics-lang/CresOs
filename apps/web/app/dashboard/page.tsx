"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { notify, requestNotificationPermission } from "../browser-notify";

type Summary = {
  leadsThisWeek: number;
  dealsWon: number;
  revenueReceived: number;
  invoiceOutstanding: number;
  activeProjects: number;
};

type Attention = {
  notifications: { id: string; subject: string | null; body: string; readAt: string | null; createdAt: string; type: string }[];
  upcomingMeetings: { id: string; type: string; scheduledAt: string; name: string | null; lead: { id: string; title: string } }[];
  upcomingCalls: { id: string; type: string; scheduledAt: string; name: string | null; lead: { id: string; title: string } }[];
  leadsPendingApproval: { id: string; title: string; owner: { name: string | null; email: string } | null }[];
  approvalsPending: { id: string; entityType: string; entityId: string; requester: { name: string | null; email: string } | null }[];
  stats?: {
    notificationsCount: number;
    messagesCount: number;
    dueCount: number;
    workProgressPercent: number;
    reportStreakDays: number;
  };
  messages?: { id: string; reportId: string; content: string; askedAt: string }[];
  dueToday?: { id: string; type: string; scheduledAt: string; lead: { id: string; title: string } }[];
  reportReminderDue?: boolean;
  lastReportSubmittedAt?: string | null;
  projectsNeedingReview?: { id: string; name: string }[];
  handoffRequestsReceived?: { id: string; projectId: string; project: { name: string }; fromUser: { name: string | null; email: string } }[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst",
  client: "Client"
};

const ROLE_QUICK_LINKS: Record<string, { href: string; label: string }[]> = {
  sales: [{ href: "/crm", label: "CRM" }, { href: "/leads", label: "Leads" }],
  developer: [{ href: "/projects", label: "Projects" }],
  director_admin: [{ href: "/analytics", label: "Analytics" }, { href: "/approvals", label: "Approvals" }, { href: "/leads", label: "Leads" }],
  finance: [{ href: "/finance", label: "Finance" }, { href: "/approvals", label: "Approvals" }],
  analyst: [{ href: "/analytics", label: "Analytics" }, { href: "/crm", label: "CRM" }],
  admin: [{ href: "/admin", label: "Users & org" }, { href: "/analytics", label: "Analytics" }],
  client: []
};

const REPORT_REMINDER_DISMISS_KEY = "cresos_report_reminder_dismiss";

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [attention, setAttention] = useState<Attention | null>(null);
  const [reportReminderDismissed, setReportReminderDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const until = sessionStorage.getItem(REPORT_REMINDER_DISMISS_KEY);
    return until ? Date.now() < parseInt(until, 10) : false;
  });
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const { apiFetch, auth } = useAuth();

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  const dismissReportReminder = () => {
    setReportReminderDismissed(true);
    sessionStorage.setItem(REPORT_REMINDER_DISMISS_KEY, String(Date.now() + 60 * 60 * 1000));
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [summaryRes, attentionRes] = await Promise.all([
          apiFetch("/analytics/summary"),
          apiFetch("/dashboard/attention")
        ]);
        if (cancelled) return;
        if (summaryRes.ok) {
          const data = (await summaryRes.json()) as Summary;
          setSummary(data);
        } else setSummaryError(true);
        if (attentionRes.ok) {
          const data = (await attentionRes.json()) as Attention;
          setAttention(data);
          if (!cancelled && data?.notifications) {
            const unread = data.notifications.filter((n) => !n.readAt);
            let first = true;
            for (const n of unread.slice(0, 5)) {
              if (notifiedIdsRef.current.has(n.id)) continue;
              notifiedIdsRef.current.add(n.id);
              notify(n.subject ?? "Reminder", {
                body: n.body?.slice(0, 120) ?? "",
                tag: `notif-${n.id}`,
                playSound: first
              });
              first = false;
            }
          }
        }
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
  const primaryRoleLabel = auth.roleKeys.map((r) => ROLE_LABELS[r]).filter(Boolean)[0] ?? "User";
  const unreadCount = attention?.stats?.notificationsCount ?? attention?.notifications?.filter((n) => !n.readAt).length ?? 0;
  const messagesCount = attention?.stats?.messagesCount ?? attention?.messages?.length ?? 0;
  const dueCount = attention?.stats?.dueCount ?? attention?.dueToday?.length ?? 0;
  const workProgress = attention?.stats?.workProgressPercent ?? 0;
  const reportStreak = attention?.stats?.reportStreakDays ?? 0;
  const reportReminderDue = attention?.reportReminderDue === true && auth.roleKeys.includes("sales") && !reportReminderDismissed;
  const projectsNeedingReview = attention?.projectsNeedingReview ?? [];
  const handoffRequests = attention?.handoffRequestsReceived ?? [];
  const hasAttention = unreadCount > 0 || messagesCount > 0 || dueCount > 0 || (attention?.upcomingMeetings?.length ?? 0) > 0 || (attention?.upcomingCalls?.length ?? 0) > 0 || (attention?.leadsPendingApproval?.length ?? 0) > 0 || (attention?.approvalsPending?.length ?? 0) > 0 || projectsNeedingReview.length > 0 || handoffRequests.length > 0;

  return (
    <section className="flex flex-col gap-4">
      {projectsNeedingReview.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-600/50 bg-sky-950/40 px-4 py-3">
          <p className="text-sm text-sky-200">
            Review and add tasks for {projectsNeedingReview.length} project(s) assigned to you.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {projectsNeedingReview.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {handoffRequests.length > 0 && (
        <div className="rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-3">
          <p className="mb-2 text-sm font-medium text-slate-200">Handoff requests</p>
          <ul className="space-y-2">
            {handoffRequests.map((h) => (
              <HandoffRespondRow key={h.id} requestId={h.id} projectName={h.project.name} fromUser={h.fromUser} apiFetch={apiFetch} onDone={() => setAttention((a) => ({ ...a!, handoffRequestsReceived: (a?.handoffRequestsReceived ?? []).filter((r) => r.id !== h.id) }))} />
            ))}
          </ul>
        </div>
      )}

      {reportReminderDue && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-3">
          <p className="text-sm text-amber-200">
            It’s been 11+ hours since your last report. Submit a report to keep your streak and stay on track.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/reports/new"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              Submit report
            </Link>
            <button
              type="button"
              onClick={dismissReportReminder}
              className="rounded p-1.5 text-amber-300 hover:bg-amber-900/50"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="shell">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-50">
            {primaryRoleLabel} dashboard
          </h2>
          <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300">
            Signed in as {auth.roleKeys.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
          </span>
        </div>
        <p className="text-sm text-slate-300">
          {hasMetrics
            ? "High-level view of CresOS: leads, deals, delivery, invoices, and revenue in one place."
            : "Use the side panel to access your role-based tasks and reports."}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Notifications" value={unreadCount} />
        <StatCard label="Messages" value={messagesCount} sub="to respond" />
        <StatCard label="Due today" value={dueCount} />
        <StatCard label="Work progress" value={`${workProgress}%`} />
        <StatCard label="Report streak" value={reportStreak} sub="days" />
      </div>

      {hasAttention && attention && (
        <div className="shell border-brand/30 bg-brand/5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            What needs your attention
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unreadCount > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Notifications</p>
                <ul className="space-y-1 text-sm">
                  {attention.notifications.filter((n) => !n.readAt).slice(0, 5).map((n) => (
                    <li key={n.id} className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5">
                      <span className="text-slate-200">{(n.subject || n.body).slice(0, 60)}{(n.body?.length > 60 ? "…" : "")}</span>
                    </li>
                  ))}
                  {unreadCount > 5 && <li className="text-slate-400">+{unreadCount - 5} more</li>}
                </ul>
              </div>
            )}
            {messagesCount > 0 && attention.messages && attention.messages.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Messages (need response)</p>
                <ul className="space-y-1 text-sm">
                  {attention.messages.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <Link href={`/reports/${m.reportId}`} className="text-brand hover:underline">
                        {m.content.slice(0, 50)}{m.content.length > 50 ? "…" : ""}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dueCount > 0 && attention.dueToday && attention.dueToday.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Due today</p>
                <ul className="space-y-1 text-sm">
                  {attention.dueToday.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <Link href={`/leads/${d.lead.id}`} className="text-brand hover:underline">
                        {d.lead.title}
                      </Link>
                      <span className="ml-1 text-slate-400">{new Date(d.scheduledAt).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.upcomingMeetings?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Upcoming meetings</p>
                <ul className="space-y-1 text-sm">
                  {attention.upcomingMeetings.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <Link href={`/leads/${m.lead.id}`} className="text-brand hover:underline">
                        {m.lead.title}
                      </Link>
                      <span className="ml-1 text-slate-400">{new Date(m.scheduledAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.upcomingCalls?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Upcoming calls</p>
                <ul className="space-y-1 text-sm">
                  {attention.upcomingCalls.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link href={`/leads/${c.lead.id}`} className="text-brand hover:underline">
                        {c.lead.title}
                      </Link>
                      <span className="ml-1 text-slate-400">{new Date(c.scheduledAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.leadsPendingApproval?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Leads pending approval</p>
                <ul className="space-y-1 text-sm">
                  {attention.leadsPendingApproval.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link href={`/leads/${l.id}`} className="text-brand hover:underline">
                        {l.title}
                      </Link>
                      {l.owner && <span className="ml-1 text-slate-400">({l.owner.name ?? l.owner.email})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(attention.approvalsPending?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Approvals pending</p>
                <ul className="space-y-1 text-sm">
                  {attention.approvalsPending.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <Link href="/approvals" className="text-brand hover:underline">
                        {a.entityType} #{a.entityId.slice(0, 8)}
                      </Link>
                      {a.requester && <span className="ml-1 text-slate-400">({a.requester.name ?? a.requester.email})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {hasMetrics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Leads this week" value={summary!.leadsThisWeek} tone="green" />
          <Metric label="Deals won" value={summary!.dealsWon} tone="green" />
          <Metric label="Active projects" value={summary!.activeProjects} tone="blue" />
          <Metric label="Revenue received" value={`$${summary!.revenueReceived.toLocaleString()}`} tone="green" />
          <Metric label="Invoices outstanding" value={`$${summary!.invoiceOutstanding.toLocaleString()}`} tone="amber" />
        </div>
      )}

      {auth.roleKeys.includes("sales") && (
        <div className="shell border-amber-800/40 bg-amber-950/20">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Report submission streak</h3>
          <p className="text-2xl font-bold text-amber-400">{reportStreak} day{reportStreak !== 1 ? "s" : ""}</p>
          <p className="mt-1 text-xs text-slate-400">
            Submit a report today to keep your streak. Consecutive days with at least one submitted report.
          </p>
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

function StatCard({
  label,
  value,
  sub
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="shell">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-slate-400">{sub}</span>}
      </p>
    </div>
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

function HandoffRespondRow({
  requestId,
  projectName,
  fromUser,
  apiFetch,
  onDone
}: {
  requestId: string;
  projectName: string;
  fromUser: { name: string | null; email: string };
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const fromName = fromUser.name || fromUser.email;
  async function respond(accept: boolean) {
    setLoading(true);
    try {
      const res = await apiFetch(`/projects/handoff-requests/${requestId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept })
      });
      if (res.ok) onDone();
    } finally {
      setLoading(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm">
      <span className="text-slate-200">
        <strong>{fromName}</strong> requested to hand off <strong>{projectName}</strong> to you.
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => respond(true)} disabled={loading} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
          Accept
        </button>
        <button type="button" onClick={() => respond(false)} disabled={loading} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50">
          Reject
        </button>
      </div>
    </li>
  );
}

