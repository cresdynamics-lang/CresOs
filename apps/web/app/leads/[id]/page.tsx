"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { formatNairobiDateTime } from "../../../lib/nairobi-datetime";

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
  client?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  project?: { id: string; name: string; approvalStatus?: string } | null;
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
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState("new");
  const [editProjectId, setEditProjectId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [followUpType, setFollowUpType] = useState<"meeting" | "call">("meeting");
  const [followName, setFollowName] = useState("");
  const [followBusiness, setFollowBusiness] = useState("");
  const [followReason, setFollowReason] = useState("");
  const [followPhone, setFollowPhone] = useState("");
  const [followScheduled, setFollowScheduled] = useState("");
  const [followReminders, setFollowReminders] = useState<number[]>([60, 30, 5]);
  const [loading, setLoading] = useState(false);

  const isAdmin = auth.roleKeys.includes("admin");
  const isSales = auth.roleKeys.includes("sales");
  const canEditLead = isSales || isAdmin;
  const canScheduleFollowUp = auth.roleKeys.some((r) => ["sales", "analyst"].includes(r));

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

  useEffect(() => {
    if (!auth.accessToken) return;
    apiFetch("/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setProjects(Array.isArray(list) ? list.map((p: any) => ({ id: p.id, name: p.name })) : []))
      .catch(() => setProjects([]));
  }, [apiFetch, auth.accessToken]);

  useEffect(() => {
    if (!lead) return;
    setEditStatus(lead.status || "new");
    setEditProjectId(lead.project?.id ?? "");
    setClientName(lead.client?.name ?? "");
    setClientEmail(lead.client?.email ?? "");
    setClientPhone(lead.client?.phone ?? "");
  }, [lead]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditLead) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/crm/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editStatus,
          projectId: editProjectId || null,
          client: {
            name: clientName.trim() || undefined,
            email: clientEmail.trim() || null,
            phone: clientPhone.trim() || null
          }
        })
      });
      if (res.ok) {
        setEditing(false);
        load();
      }
    } finally {
      setLoading(false);
    }
  };

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
      <section className="flex w-full min-w-0 flex-col gap-4 bg-white pb-6">
        <p className="text-[#605E5C]">Loading…</p>
      </section>
    );
  }

  return (
    <section className="flex w-full min-w-0 flex-col gap-4 bg-white pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5">
        <div>
          <Link href="/leads" className="text-sm font-semibold text-[#005CAB] hover:underline">
            ← Back to leads
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-[#242424]">{lead.title}</h2>
          <p className="mt-1 text-xs text-[#605E5C]">
            {lead.owner && <>Owner: {lead.owner.name ?? lead.owner.email}</>}
            {lead.approvalStatus === "approved" && lead.approvedBy && (
              <> · Approved by {lead.approvedBy.name ?? lead.approvedBy.email}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#E1DFDD] bg-white px-2 py-1 text-xs font-semibold text-[#605E5C]">
            {lead.status}
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-bold text-white ${
              lead.approvalStatus === "approved"
                ? "bg-[#0B6A0B]"
                : lead.approvalStatus === "rejected"
                  ? "bg-[#C50F1F]"
                  : "bg-[#C19C00]"
            }`}
          >
            {lead.approvalStatus}
          </span>
          {isAdmin && lead.approvalStatus === "pending_approval" && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleApprove("approved")}
                className="rounded-md bg-[#0B6A0B] px-3 py-1 text-sm font-semibold text-white hover:bg-[#095609] disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleApprove("rejected")}
                className="rounded-md bg-[#C50F1F] px-3 py-1 text-sm font-semibold text-white hover:bg-[#A50D1A] disabled:opacity-60"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {lead.status === "closed" && !lead.project && (
        <div className="rounded-lg border border-[#E8A0A6] border-l-4 border-l-[#C50F1F] bg-white p-4">
          <p className="text-sm text-[#C50F1F]">
            This lead is <span className="font-semibold">closed</span> but not linked to any project.
            Please link it to a project so delivery can be tracked.
          </p>
          {canEditLead && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 rounded-md bg-[#C50F1F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#A50D1A]"
            >
              Link to project
            </button>
          )}
        </div>
      )}

      {canEditLead && (
        <div className="rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#242424]">Lead status & contact</h3>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-1.5 text-sm text-[#242424] hover:bg-[#F5F5F5]"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          {editing && (
            <form onSubmit={handleSave} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-[#605E5C]">Status</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="waiting">Waiting</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="closed">Closed</option>
                  <option value="disqualified">Disqualified</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-[#605E5C]">Project</span>
                <select
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(e.target.value)}
                  className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                >
                  <option value="">No project yet</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-[#605E5C]">Client name</span>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[#605E5C]">Client phone</span>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-[#605E5C]">Client email</span>
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-[#005CAB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004A8C] disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {(lead.client || lead.project) && (
        <div className="rounded-lg border border-[#B4CDE8] border-l-4 border-l-[#005CAB] bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-[#242424]">Client &amp; project</h3>
          {lead.client && (
            <p className="text-sm text-[#242424]">
              <span className="text-[#605E5C]">Client:</span> {lead.client.name}
              {lead.client.phone ? ` · ${lead.client.phone}` : ""}
              {lead.client.email ? ` · ${lead.client.email}` : ""}
            </p>
          )}
          {lead.project && (
            <p className="mt-2 text-sm">
              <span className="text-[#605E5C]">Project:</span>{" "}
              <Link href={`/projects/${lead.project.id}`} className="font-semibold text-[#005CAB] hover:underline">
                {lead.project.name}
              </Link>
              {lead.project.approvalStatus && (
                <span className="ml-2 text-xs text-[#8A8886]">({lead.project.approvalStatus})</span>
              )}
            </p>
          )}
          {lead.source === "project" && (
            <p className="mt-2 text-xs text-[#8A8886]">Source: linked from project</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5">
        <h3 className="mb-2 text-sm font-semibold text-[#242424]">Comments</h3>
        {isAdmin && (
          <form onSubmit={handleAddComment} className="mb-3 flex flex-col gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
              placeholder="Add a comment…"
            />
            <button
              type="submit"
              disabled={loading || !comment.trim()}
              className="w-fit rounded-md bg-[#005CAB] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#004A8C] disabled:opacity-60"
            >
              Post comment
            </button>
          </form>
        )}
        {lead.comments.length > 0 ? (
          <ul className={`space-y-2 ${isAdmin ? "mt-0 border-t border-[#E1DFDD] pt-3" : ""}`}>
            {lead.comments.map((c) => (
              <li key={c.id} className="rounded-md border border-[#E1DFDD] bg-white px-3 py-2 text-sm">
                <p className="text-[#242424]">{c.content}</p>
                <p className="mt-1 text-xs text-[#8A8886]">
                  {c.author.name ?? c.author.email} · {new Date(c.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#8A8886]">No comments yet.</p>
        )}
      </div>

      <div className="rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#242424]">Schedule meeting or call</h3>
        {!canScheduleFollowUp ? (
          <p className="mb-3 text-xs text-[#605E5C]">
            Scheduling is available to sales and analyst roles. Upcoming items are listed below when present.
          </p>
        ) : (
          <p className="mb-3 text-xs text-[#605E5C]">
            You will be notified by email and in-app at the chosen times before the meeting/call.
          </p>
        )}
        {canScheduleFollowUp && (
        <form onSubmit={handleAddFollowUp} className="flex flex-col gap-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="followType"
                checked={followUpType === "meeting"}
                onChange={() => setFollowUpType("meeting")}
              />
              <span className="text-sm text-[#242424]">Meeting</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="followType"
                checked={followUpType === "call"}
                onChange={() => setFollowUpType("call")}
              />
              <span className="text-sm text-[#242424]">Call</span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={followName}
              onChange={(e) => setFollowName(e.target.value)}
              placeholder="Contact name"
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
            />
            <input
              type="text"
              value={followBusiness}
              onChange={(e) => setFollowBusiness(e.target.value)}
              placeholder="Business"
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
            />
            <input
              type="text"
              value={followReason}
              onChange={(e) => setFollowReason(e.target.value)}
              placeholder="Reason"
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
            />
            <input
              type="text"
              value={followPhone}
              onChange={(e) => setFollowPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#605E5C]">Date & time</label>
            <input
              type="datetime-local"
              value={followScheduled}
              onChange={(e) => setFollowScheduled(e.target.value)}
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20"
              required
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-[#605E5C]">Notify me</p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm text-[#242424]">
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
            className="w-fit rounded-md bg-[#005CAB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004A8C] disabled:opacity-60"
          >
            Schedule {followUpType}
          </button>
        </form>
        )}
      </div>

      {lead.followUps.length > 0 && (
        <div className="rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-[#242424]">Upcoming meetings & calls</h3>
          <ul className="space-y-2">
            {lead.followUps
              .filter((f) => new Date(f.scheduledAt) >= new Date())
              .map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E1DFDD] bg-white px-3 py-2 text-sm"
                >
                  <span className="font-medium capitalize text-[#242424]">{f.type}</span>
                  <span className="text-[#605E5C]">{formatNairobiDateTime(f.scheduledAt)}</span>
                  {(f.name || f.business) && (
                    <span className="text-[#605E5C]">{[f.name, f.business].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
