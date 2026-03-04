"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";

type Comment = { id: string; content: string; createdAt: string; author: { name: string | null; email: string } };
type FollowUp = {
  id: string;
  type: string;
  name: string | null;
  business: string | null;
  reason: string | null;
  phone: string | null;
  scheduledAt: string;
  assignedTo: { name: string | null; email: string };
};
type Lead = {
  id: string;
  title: string;
  status: string;
  approvalStatus: string;
  source: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  approvedBy: { id: string; name: string | null; email: string } | null;
  comments: Comment[];
  followUps: FollowUp[];
};

const REMINDER_OPTIONS = [
  { value: 2880, label: "2 days before" },
  { value: 1440, label: "1 day before" },
  { value: 60, label: "1 hour before" },
  { value: 30, label: "30 minutes before" },
  { value: 5, label: "5 minutes before" }
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { apiFetch, auth } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [comment, setComment] = useState("");
  const [followUpType, setFollowUpType] = useState<"meeting" | "call">("meeting");
  const [followName, setFollowName] = useState("");
  const [followBusiness, setFollowBusiness] = useState("");
  const [followReason, setFollowReason] = useState("");
  const [followPhone, setFollowPhone] = useState("");
  const [followScheduled, setFollowScheduled] = useState("");
  const [followReminders, setFollowReminders] = useState<number[]>([60, 30, 5]);
  const [loading, setLoading] = useState(false);

  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));

  const load = async () => {
    try {
      const res = await apiFetch(`/crm/leads/${id}`);
      if (res.ok) setLead((await res.json()) as Lead);
      else if (res.status === 404) router.replace("/leads");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, [id, apiFetch, router]);

  const handleApprove = async (status: "approved" | "rejected") => {
    setLoading(true);
    try {
      const res = await apiFetch(`/crm/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus: status })
      });
      if (res.ok) load();
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/crm/leads/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: comment.trim() })
      });
      if (res.ok) {
        setComment("");
        load();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followScheduled) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/crm/leads/${id}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({
          type: followUpType,
          name: followName.trim() || undefined,
          business: followBusiness.trim() || undefined,
          reason: followReason.trim() || undefined,
          phone: followPhone.trim() || undefined,
          scheduledAt: new Date(followScheduled).toISOString(),
          reminderSlots: followReminders
        })
      });
      if (res.ok) {
        setFollowName("");
        setFollowBusiness("");
        setFollowReason("");
        setFollowPhone("");
        setFollowScheduled("");
        load();
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleReminder = (minutes: number) => {
    setFollowReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes].sort((a, b) => b - a)
    );
  };

  if (!lead) {
    return (
      <section className="shell">
        <p className="text-slate-400">Loading…</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/leads" className="text-sm text-brand hover:underline">
            ← Back to leads
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-slate-50">{lead.title}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {lead.owner && <>Owner: {lead.owner.name ?? lead.owner.email}</>}
            {lead.approvalStatus === "approved" && lead.approvedBy && (
              <> · Approved by {lead.approvedBy.name ?? lead.approvedBy.email}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">{lead.status}</span>
          <span
            className={`rounded px-2 py-1 text-xs ${
              lead.approvalStatus === "approved"
                ? "bg-emerald-900/60 text-emerald-300"
                : lead.approvalStatus === "rejected"
                  ? "bg-rose-900/60 text-rose-300"
                  : "bg-amber-900/60 text-amber-300"
            }`}
          >
            {lead.approvalStatus}
          </span>
          {isDirector && lead.approvalStatus === "pending_approval" && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleApprove("approved")}
                className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleApprove("rejected")}
                className="rounded bg-rose-600 px-3 py-1 text-sm text-white hover:bg-rose-500 disabled:opacity-60"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {isDirector && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Director comments</h3>
          <form onSubmit={handleAddComment} className="flex flex-col gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="Add a comment..."
            />
            <button
              type="submit"
              disabled={loading || !comment.trim()}
              className="w-fit rounded bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
            >
              Post comment
            </button>
          </form>
          {lead.comments.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-slate-700 pt-3">
              {lead.comments.map((c) => (
                <li key={c.id} className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
                  <p className="text-slate-300">{c.content}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.author.name ?? c.author.email} · {new Date(c.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lead.comments.length > 0 && !isDirector && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Director comments</h3>
          <ul className="space-y-2">
            {lead.comments.map((c) => (
              <li key={c.id} className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
                <p className="text-slate-300">{c.content}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(c.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="shell">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Schedule meeting or call</h3>
        <p className="mb-3 text-xs text-slate-400">
          You will be notified by email and in-app at the chosen times before the meeting/call.
        </p>
        <form onSubmit={handleAddFollowUp} className="flex flex-col gap-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="followType"
                checked={followUpType === "meeting"}
                onChange={() => setFollowUpType("meeting")}
              />
              <span className="text-sm">Meeting</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="followType"
                checked={followUpType === "call"}
                onChange={() => setFollowUpType("call")}
              />
              <span className="text-sm">Call</span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={followName}
              onChange={(e) => setFollowName(e.target.value)}
              placeholder="Contact name"
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              type="text"
              value={followBusiness}
              onChange={(e) => setFollowBusiness(e.target.value)}
              placeholder="Business"
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              type="text"
              value={followReason}
              onChange={(e) => setFollowReason(e.target.value)}
              placeholder="Reason"
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              type="text"
              value={followPhone}
              onChange={(e) => setFollowPhone(e.target.value)}
              placeholder="Phone"
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Date & time</label>
            <input
              type="datetime-local"
              value={followScheduled}
              onChange={(e) => setFollowScheduled(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              required
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-slate-400">Notify me</p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={followReminders.includes(opt.value)}
                    onChange={() => toggleReminder(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-fit rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            Schedule {followUpType}
          </button>
        </form>
      </div>

      {lead.followUps.length > 0 && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Upcoming meetings & calls</h3>
          <ul className="space-y-2">
            {lead.followUps
              .filter((f) => new Date(f.scheduledAt) >= new Date())
              .map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                >
                  <span className="font-medium capitalize text-slate-200">{f.type}</span>
                  <span className="text-slate-400">{new Date(f.scheduledAt).toLocaleString()}</span>
                  {(f.name || f.business) && (
                    <span className="text-slate-400">{[f.name, f.business].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
