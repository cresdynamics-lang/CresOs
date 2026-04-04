"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatMoney } from "../../format-money";
import { useAuth } from "../../auth-context";
import { emitDataRefresh, subscribeDataRefresh } from "../../data-refresh";

type TaskComment = {
  id: string;
  body: string;
  type: string;
  audience?: string | null;
  mentionedUserIds?: string[];
  createdAt: string;
  author?: { id: string; name: string | null; email: string } | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  blockedReason?: string | null;
  dueDate?: string | null;
  description?: string | null;
  comments?: TaskComment[];
};
type Milestone = { id: string; name: string; status: string; dueDate?: string | null };
type DevAssignment = {
  id: string;
  userId: string;
  status: string;
  user: { id: string; name: string | null; email: string };
};

type MentionableUser = { id: string; name: string | null; email: string };

type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  type?: string | null;
  clientOrOwnerName?: string | null;
  phone?: string | null;
  email?: string | null;
  price?: number | null;
  amountReceived?: number;
  managementMonthlyAmount?: number | null;
  managementMonths?: number | null;
  projectDetails?: string | null;
  approvalStatus?: string;
  assignedDeveloper?: { id: string; name: string | null; email: string } | null;
  developerReviewedAt?: string | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  approvedBy?: { id: string; name: string | null } | null;
  developerAssignments?: DevAssignment[];
  mentionableUsers?: MentionableUser[];
  developerAccess?: "none" | "invited" | "active";
  tasks: Task[];
  milestones: Milestone[];
  timeline?: { date?: string; title?: string }[] | null;
};
type Developer = { id: string; name: string | null; email: string };

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { apiFetch, auth } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentAudience, setCommentAudience] = useState("all");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const isDirector = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));
  const canApproveProject = auth.roleKeys.includes("director_admin");
  const isFinance = auth.roleKeys.includes("finance");
  const isSalesOwner = project?.createdBy?.id === auth.userId;
  const isAssignedDev = project?.developerAccess === "active";
  const canCommentOnTasks =
    isDirector || isAssignedDev || (!!isSalesOwner && project?.approvalStatus === "approved");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/projects/${id}`);
      if (res.ok) {
        const data = (await res.json()) as any;
        setProject({
          id: data.id,
          name: data.name,
          status: data.status,
          type: data.type,
          clientOrOwnerName: data.clientOrOwnerName,
          phone: data.phone,
          email: data.email,
          price: data.price,
          amountReceived: data.amountReceived ?? 0,
          managementMonthlyAmount: data.managementMonthlyAmount,
          managementMonths: data.managementMonths,
          projectDetails: data.projectDetails,
          approvalStatus: data.approvalStatus,
          assignedDeveloper: data.assignedDeveloper,
          createdBy: data.createdBy,
          approvedBy: data.approvedBy,
          developerReviewedAt: data.developerReviewedAt,
          developerAssignments: Array.isArray(data.developerAssignments) ? data.developerAssignments : [],
          mentionableUsers: Array.isArray(data.mentionableUsers) ? data.mentionableUsers : [],
          developerAccess: data.developerAccess,
          tasks: Array.isArray(data.tasks)
            ? data.tasks.map((t: Task & { comments?: TaskComment[] }) => ({
                ...t,
                comments: Array.isArray(t.comments) ? t.comments : []
              }))
            : [],
          milestones: data.milestones || [],
          timeline: data.timeline
        });
      } else {
        setProject(null);
      }
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id, apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeDataRefresh(() => void load());
    return unsub;
  }, [load]);

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    try {
      const res = await apiFetch(`/projects/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" })
      });
      if (res.ok) {
        await load();
        emitDataRefresh();
      }
    } finally {
      setApproving(false);
    }
  }

  async function handleMarkReviewed() {
    if (!id) return;
    try {
      const res = await apiFetch(`/projects/${id}/reviewed`, { method: "POST" });
      if (res.ok) await load();
    } catch {
      // ignore
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!addTaskTitle.trim() || !id) return;
    setAddingTask(true);
    try {
      const res = await apiFetch(`/projects/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: addTaskTitle.trim() })
      });
      if (res.ok) {
        setAddTaskTitle("");
        await load();
      }
    } finally {
      setAddingTask(false);
    }
  }

  async function handleTaskStatusChange(taskId: string, status: string) {
    try {
      const body: { status: string; blockedReason?: string } = { status };
      if (status === "blocked") body.blockedReason = "Pending";
      const res = await apiFetch(`/projects/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) await load();
    } catch {
      // ignore
    }
  }

  async function handleRespondAssignment(assignmentId: string, accept: boolean) {
    if (!id) return;
    setRespondingId(assignmentId);
    try {
      const res = await apiFetch(`/projects/${id}/developer-assignments/${assignmentId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept })
      });
      if (res.ok) {
        await load();
        emitDataRefresh();
      }
    } finally {
      setRespondingId(null);
    }
  }

  async function handlePostComment(taskId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    try {
      const res = await apiFetch(`/projects/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: commentBody.trim(),
          audience: commentAudience,
          mentionedUserIds: commentMentions,
          type: isDirector ? "director_note" : "progress"
        })
      });
      if (res.ok) {
        setCommentTaskId(null);
        setCommentBody("");
        setCommentAudience("all");
        setCommentMentions([]);
        await load();
        emitDataRefresh();
      }
    } finally {
      setPostingComment(false);
    }
  }

  useEffect(() => {
    if (handoffOpen) {
      apiFetch("/projects/assignable-developers")
        .then((r) => r.ok && r.json())
        .then((list) => setDevelopers(Array.isArray(list) ? list : []))
        .catch(() => setDevelopers([]));
    }
  }, [handoffOpen, apiFetch]);

  if (loading) {
    return (
      <section className="shell">
        <p className="text-slate-400">Loading…</p>
      </section>
    );
  }
  if (!project) {
    return (
      <section className="shell">
        <p className="text-slate-400">Project not found.</p>
        <Link href="/projects" className="text-sky-400 hover:underline">Back to projects</Link>
      </section>
    );
  }

  const canSeeContact = project.clientOrOwnerName != null || project.phone != null || project.email != null || project.price != null;
  const allocated = project.price != null ? Number(project.price) : null;
  const received = project.amountReceived ?? 0;
  const remaining = allocated != null ? Math.max(0, allocated - received) : null;

  const myPendingAssignment = project.developerAssignments?.find(
    (a) => a.userId === auth.userId && a.status === "pending"
  );

  const deliveryCounts = project.tasks.reduce(
    (acc, t) => {
      const k = t.status as keyof typeof acc;
      if (k in acc) acc[k] += 1;
      return acc;
    },
    { todo: 0, in_progress: 0, blocked: 0, done: 0 }
  );

  function commentTypeLabel(type: string): string {
    switch (type) {
      case "blocker":
        return "Blocker";
      case "scope_issue":
        return "Scope / client";
      case "completion":
        return "Done";
      case "director_note":
        return "Director";
      default:
        return "Progress";
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="mb-2 inline-block text-sm text-slate-400 hover:text-slate-200">← Projects</Link>
          <h2 className="text-xl font-semibold text-slate-50">{project.name}</h2>
          <p className="text-sm text-slate-400 capitalize">{project.status}</p>
          {project.type && <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{project.type === "demo" ? "Demo" : "Project"}</span>}
          {project.approvalStatus === "pending_approval" && (
            <span className="ml-2 rounded bg-amber-900/60 px-2 py-0.5 text-xs text-amber-200">Pending approval</span>
          )}
          {project.approvalStatus === "approved" && (
            <span className="ml-2 rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">Approved</span>
          )}
        </div>
        {canApproveProject && project.approvalStatus === "pending_approval" && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        )}
        {(isFinance || isDirector) && canSeeContact && (
          <button type="button" onClick={() => setEditOpen(true)} className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Update contact / price
          </button>
        )}
        {isAssignedDev && !project.developerReviewedAt && (
          <button type="button" onClick={handleMarkReviewed} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
            Mark as reviewed
          </button>
        )}
        {isAssignedDev && (
          <button type="button" onClick={() => setHandoffOpen(true)} className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Request handoff to another developer
          </button>
        )}
      </div>

      {myPendingAssignment && (
        <div className="shell border-amber-900/50 bg-amber-950/30">
          <p className="text-sm text-amber-100">You were invited to work on this project. Accept to edit tasks and comment; decline if you cannot take it.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={respondingId === myPendingAssignment.id}
              onClick={() => handleRespondAssignment(myPendingAssignment.id, true)}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {respondingId === myPendingAssignment.id ? "…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={respondingId === myPendingAssignment.id}
              onClick={() => handleRespondAssignment(myPendingAssignment.id, false)}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {isAssignedDev && !project.developerReviewedAt && (
        <div className="shell border-sky-600/40 bg-sky-950/30">
          <p className="text-sm text-sky-200">Review this project and add tasks below. When done, click &quot;Mark as reviewed&quot;.</p>
        </div>
      )}

      {canSeeContact && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-medium text-slate-300">Contact & price</h3>
          <ul className="space-y-1 text-sm text-slate-200">
            {project.clientOrOwnerName && <li>Name: {project.clientOrOwnerName}</li>}
            {project.phone && <li>Phone: {project.phone}</li>}
            {project.email && <li>Email: {project.email}</li>}
            {project.price != null && (
              <>
                <li>Allocated: {formatMoney(Number(project.price))}</li>
                <li>Received: {formatMoney(received)} (deducts from allocated when payments confirmed)</li>
                {remaining != null && <li>Remaining: {formatMoney(remaining)}</li>}
              </>
            )}
            {(project.managementMonthlyAmount != null && project.managementMonths != null) && (
              <li className="mt-1 text-sky-300">
                On management: {formatMoney(project.managementMonthlyAmount)}/month for {project.managementMonths} month{project.managementMonths !== 1 ? "s" : ""}
                {project.managementMonths > 0 && (
                  <span className="text-slate-400"> (total {formatMoney(project.managementMonthlyAmount * project.managementMonths)} to upgrade)</span>
                )}
              </li>
            )}
          </ul>
        </div>
      )}

      {project.projectDetails && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-medium text-slate-300">Project details</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-200">{project.projectDetails}</p>
        </div>
      )}

      {project.developerAssignments && project.developerAssignments.length > 0 && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-medium text-slate-300">Team</h3>
          <ul className="space-y-1 text-sm text-slate-200">
            {project.developerAssignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span>{a.user.name || a.user.email}</span>
                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs capitalize text-slate-300">{a.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {project.assignedDeveloper && (!project.developerAssignments || project.developerAssignments.length === 0) && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-medium text-slate-300">Primary contact (developer)</h3>
          <p className="text-sm text-slate-200">{project.assignedDeveloper.name || project.assignedDeveloper.email}</p>
        </div>
      )}

      {project.timeline && project.timeline.length > 0 && (
        <div className="shell">
          <h3 className="mb-2 text-sm font-medium text-slate-300">Timeline</h3>
          <ul className="space-y-2">
            {project.timeline.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-200">
                {t.date && <span className="text-slate-400">{t.date}</span>}
                <span>{t.title || "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.approvalStatus === "approved" && project.tasks.length > 0 && (
        <div className="shell border-emerald-900/30 bg-emerald-950/20">
          <h3 className="mb-2 text-sm font-medium text-emerald-200/90">Delivery snapshot</h3>
          <p className="text-sm text-slate-300">
            <span className="text-emerald-300">{deliveryCounts.done} done</span>
            {" · "}
            <span className="text-sky-300">{deliveryCounts.in_progress} in progress</span>
            {" · "}
            <span className="text-amber-300">{deliveryCounts.blocked} blocked</span>
            {" · "}
            <span className="text-slate-500">{deliveryCounts.todo} todo</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Task notes below stay in sync with development: blockers and scope issues help Sales coordinate with the client (APIs, payment, assets).
          </p>
        </div>
      )}

      <div className="shell">
        <h3 className="mb-2 text-sm font-medium text-slate-300">Tasks</h3>
        {isAssignedDev && (
          <form onSubmit={handleAddTask} className="mb-3 flex gap-2">
            <input
              type="text"
              value={addTaskTitle}
              onChange={(e) => setAddTaskTitle(e.target.value)}
              placeholder="New task title"
              className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
            />
            <button type="submit" disabled={addingTask || !addTaskTitle.trim()} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              {addingTask ? "Adding…" : "Add task"}
            </button>
          </form>
        )}
        {project.tasks.length === 0 ? (
          <p className="text-sm text-slate-400">No tasks yet.</p>
        ) : (
          <ul className="space-y-3">
            {project.tasks.map((t) => (
              <li key={t.id} className="rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{t.title}</span>
                  {isAssignedDev ? (
                    <select
                      value={t.status}
                      onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                      className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
                    >
                      <option value="todo">Todo</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  ) : (
                    <span className="capitalize text-slate-400">{t.status.replace("_", " ")}</span>
                  )}
                </div>
                {t.blockedReason?.trim() && (
                  <p className="mt-2 text-xs text-amber-200/90">
                    <span className="font-medium text-amber-400/90">Blocked: </span>
                    {t.blockedReason}
                  </p>
                )}
                {t.comments && t.comments.length > 0 && (
                  <ul className="mt-2 space-y-2 border-l border-slate-600 pl-3">
                    {t.comments.map((c) => (
                      <li key={c.id} className="text-xs text-slate-300">
                        <span className="text-slate-500">
                          {(c.author?.name || c.author?.email || "Developer") + " · "}
                          <span className="text-slate-400">{commentTypeLabel(c.type)}</span>
                          {c.audience && c.audience !== "all" && (
                            <span className="text-slate-500"> · To: {c.audience}</span>
                          )}
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-200">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {canCommentOnTasks &&
                  (commentTaskId === t.id ? (
                    <form
                      onSubmit={(e) => handlePostComment(t.id, e)}
                      className="mt-2 space-y-2 rounded border border-slate-600 bg-slate-900/50 p-2"
                    >
                      <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Comment for Sales, developers, or everyone…"
                        rows={3}
                        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-slate-400">
                          Audience{" "}
                          <select
                            value={commentAudience}
                            onChange={(e) => setCommentAudience(e.target.value)}
                            className="ml-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="all">Everyone</option>
                            <option value="sales">Sales / owner</option>
                            <option value="developers">Developers</option>
                          </select>
                        </label>
                      </div>
                      {project.mentionableUsers && project.mentionableUsers.length > 0 && (
                        <div className="text-xs text-slate-400">
                          <span className="block text-slate-500">Notify (mention)</span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {project.mentionableUsers.map((u) => (
                              <label key={u.id} className="flex cursor-pointer items-center gap-1 text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={commentMentions.includes(u.id)}
                                  onChange={(e) => {
                                    setCommentMentions((prev) =>
                                      e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
                                    );
                                  }}
                                />
                                {u.name || u.email}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={postingComment || !commentBody.trim()}
                          className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                        >
                          {postingComment ? "Posting…" : "Post comment"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCommentTaskId(null);
                            setCommentBody("");
                            setCommentMentions([]);
                          }}
                          className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCommentTaskId(t.id);
                        setCommentBody("");
                        setCommentAudience("all");
                        setCommentMentions([]);
                      }}
                      className="mt-2 text-xs text-sky-400 hover:underline"
                    >
                      Add comment
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shell">
        <h3 className="mb-2 text-sm font-medium text-slate-300">Milestones</h3>
        {project.milestones.length === 0 ? (
          <p className="text-sm text-slate-400">No milestones yet.</p>
        ) : (
          <ul className="space-y-2">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm">
                <span className="text-slate-100">{m.name}</span>
                <span className="capitalize text-slate-400">{m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editOpen && (isFinance || isDirector) && (
        <EditProjectContactModal
          projectId={project.id}
          initial={{
            clientOrOwnerName: project.clientOrOwnerName ?? "",
            phone: project.phone ?? "",
            email: project.email ?? "",
            price: project.price ?? "",
            managementMonthlyAmount: project.managementMonthlyAmount ?? "",
            managementMonths: project.managementMonths ?? ""
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
            emitDataRefresh();
          }}
          apiFetch={apiFetch}
        />
      )}

      {handoffOpen && isAssignedDev && (
        <HandoffRequestModal
          projectId={project.id}
          projectName={project.name}
          developers={developers.filter((d) => d.id !== auth.userId)}
          onClose={() => setHandoffOpen(false)}
          onSent={() => { setHandoffOpen(false); load(); }}
          apiFetch={apiFetch}
        />
      )}
    </section>
  );
}

function HandoffRequestModal({
  projectId,
  projectName,
  developers,
  onClose,
  onSent,
  apiFetch
}: {
  projectId: string;
  projectName: string;
  developers: Developer[];
  onClose: () => void;
  onSent: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [toUserId, setToUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/projects/${projectId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId })
      });
      if (res.ok) onSent();
      else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Request failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Request handoff — {projectName}</h3>
        <p className="mb-3 text-sm text-slate-400">Another developer can accept to become the assigned developer and edit tasks. If they reject, the project stays with you.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Hand off to</span>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
              <option value="">Select developer</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>{d.name || d.email}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-amber-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !toUserId} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              {submitting ? "Sending…" : "Send request"}
            </button>
            <button type="button" onClick={onClose} className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditProjectContactModal({
  projectId,
  initial,
  onClose,
  onSaved,
  apiFetch
}: {
  projectId: string;
  initial: { clientOrOwnerName: string; phone: string; email: string; price: string | number; managementMonthlyAmount?: string | number; managementMonths?: string | number };
  onClose: () => void;
  onSaved: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [clientOrOwnerName, setClientOrOwnerName] = useState(initial.clientOrOwnerName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [price, setPrice] = useState(String(initial.price ?? ""));
  const [managementMonthlyAmount, setManagementMonthlyAmount] = useState(String(initial.managementMonthlyAmount ?? ""));
  const [managementMonths, setManagementMonths] = useState(String(initial.managementMonths ?? ""));
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientOrOwnerName: clientOrOwnerName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          price: price.trim() ? Number(price) : null,
          managementMonthlyAmount: managementMonthlyAmount.trim() ? Number(managementMonthlyAmount) : null,
          managementMonths: managementMonths.trim() ? Math.max(0, Math.floor(Number(managementMonths))) : null
        })
      });
      if (res.ok) onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Update contact, price & management</h3>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Client / owner name</span>
            <input type="text" value={clientOrOwnerName} onChange={(e) => setClientOrOwnerName(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Price (KES)</span>
            <input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <p className="text-xs text-slate-500">When project is on management:</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Expected per month (KES)</span>
            <input type="number" min={0} step={0.01} value={managementMonthlyAmount} onChange={(e) => setManagementMonthlyAmount(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="e.g. 50000" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">For how long (months)</span>
            <input type="number" min={0} value={managementMonths} onChange={(e) => setManagementMonths(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="e.g. 12" />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={submitting} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              {submitting ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
