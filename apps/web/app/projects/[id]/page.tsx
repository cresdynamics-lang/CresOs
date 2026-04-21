"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  startDate?: string | null;
  endDate?: string | null;
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
  const [addTaskHours, setAddTaskHours] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentAudience, setCommentAudience] = useState("all");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapToUserId, setSwapToUserId] = useState("");
  const [swapError, setSwapError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [addMilestoneName, setAddMilestoneName] = useState("");
  const [addMilestoneDueDate, setAddMilestoneDueDate] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const progressKey = useMemo(() => (id ? `cresos_dev_project_progress_${id}` : ""), [id]);

  const isDirector = auth.roleKeys.includes("director_admin");
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
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
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
    setReviewError(null);
    if ((project?.tasks?.length ?? 0) === 0 || (project?.milestones?.length ?? 0) === 0) {
      setReviewError("Add at least 1 task and 1 milestone before marking this project as reviewed.");
      return;
    }
    try {
      const res = await apiFetch(`/projects/${id}/reviewed`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setReviewError(j.error ?? "Could not mark reviewed");
        return;
      }
      await load();
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
        body: JSON.stringify({
          title: addTaskTitle.trim(),
          estimatedHours: addTaskHours.trim() ? Number(addTaskHours) : undefined
        })
      });
      if (res.ok) {
        setAddTaskTitle("");
        setAddTaskHours("");
        await load();
      }
    } finally {
      setAddingTask(false);
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !addMilestoneName.trim()) return;
    setAddingMilestone(true);
    setMilestoneError(null);
    try {
      const res = await apiFetch(`/projects/${id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addMilestoneName.trim(),
          dueDate: addMilestoneDueDate.trim() ? addMilestoneDueDate.trim() : undefined
        })
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMilestoneError(j.error ?? "Could not add milestone");
        return;
      }
      setAddMilestoneName("");
      setAddMilestoneDueDate("");
      await load();
    } finally {
      setAddingMilestone(false);
    }
  }

  // Persist developer progress (cookie-like) so they can continue later.
  useEffect(() => {
    if (!progressKey) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(progressKey);
      if (!raw) return;
      const j = JSON.parse(raw) as Partial<{
        addTaskTitle: string;
        addTaskHours: string;
        addMilestoneName: string;
        addMilestoneDueDate: string;
      }>;
      if (typeof j.addTaskTitle === "string") setAddTaskTitle((v) => (v ? v : j.addTaskTitle!));
      if (typeof j.addTaskHours === "string") setAddTaskHours((v) => (v ? v : j.addTaskHours!));
      if (typeof j.addMilestoneName === "string") setAddMilestoneName((v) => (v ? v : j.addMilestoneName!));
      if (typeof j.addMilestoneDueDate === "string") setAddMilestoneDueDate((v) => (v ? v : j.addMilestoneDueDate!));
    } catch {
      // ignore
    }
    // only load once per project
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey]);

  useEffect(() => {
    if (!progressKey) return;
    if (typeof window === "undefined") return;
    const payload = {
      addTaskTitle,
      addTaskHours,
      addMilestoneName,
      addMilestoneDueDate
    };
    window.localStorage.setItem(progressKey, JSON.stringify(payload));
  }, [progressKey, addTaskTitle, addTaskHours, addMilestoneName, addMilestoneDueDate]);

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

  async function handleSwapRequest() {
    if (!id || !swapToUserId) return;
    setSwapping(true);
    setSwapError(null);
    try {
      const res = await apiFetch(`/projects/${id}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: swapToUserId })
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSwapError(j.error ?? "Swap request failed");
        return;
      }
      setSwapOpen(false);
      setSwapToUserId("");
      await load();
      emitDataRefresh();
    } finally {
      setSwapping(false);
    }
  }

  async function saveTaskEdit(taskId: string) {
    setSavingTaskEdit(true);
    try {
      const res = await apiFetch(`/projects/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTaskTitle.trim(),
          description: editTaskDescription.trim() || null
        })
      });
      if (res.ok) {
        setEditingTaskId(null);
        await load();
      }
    } finally {
      setSavingTaskEdit(false);
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
    if (handoffOpen || swapOpen) {
      apiFetch("/projects/assignable-developers")
        .then((r) => r.ok && r.json())
        .then((list) => setDevelopers(Array.isArray(list) ? list : []))
        .catch(() => setDevelopers([]));
    }
  }, [handoffOpen, swapOpen, apiFetch]);

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
      const k = (t.status === "todo" ? "not_started" : t.status) as keyof typeof acc;
      if (k in acc) acc[k] += 1;
      return acc;
    },
    { not_started: 0, in_progress: 0, waiting_response: 0, blocked: 0, done: 0 }
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
        {isDirector && (
          <button type="button" onClick={() => setEditOpen(true)} className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Edit project
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

      {reviewError && (
        <div className="shell border-rose-900/40 bg-rose-950/20">
          <p className="text-sm text-rose-200">{reviewError}</p>
        </div>
      )}

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
              onClick={() => { setSwapOpen(true); setSwapError(null); }}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Swap to another developer
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

      {swapOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setSwapOpen(false);
            setSwapError(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-slate-50">Swap project to another developer</h3>
            <p className="mb-3 text-sm text-slate-400">
              Pick who should take this project. They will receive an in-app request to accept.
            </p>
            {swapError && <p className="mb-2 text-sm text-rose-300">{swapError}</p>}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Developer</span>
              <select
                value={swapToUserId}
                onChange={(e) => setSwapToUserId(e.target.value)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              >
                <option value="">Select developer</option>
                {developers.filter((d) => d.id !== auth.userId).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={swapping || !swapToUserId}
                onClick={() => void handleSwapRequest()}
                className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {swapping ? "Sending…" : "Request swap"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSwapOpen(false);
                  setSwapError(null);
                }}
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
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
            <span className="text-violet-300">{deliveryCounts.waiting_response} waiting</span>
            {" · "}
            <span className="text-amber-300">{deliveryCounts.blocked} blocked</span>
            {" · "}
            <span className="text-slate-500">{deliveryCounts.not_started} not started</span>
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
            <input
              type="number"
              min={0}
              step={0.25}
              value={addTaskHours}
              onChange={(e) => setAddTaskHours(e.target.value)}
              placeholder="Hours"
              className="w-24 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
            />
            <button
              type="submit"
              disabled={
                addingTask ||
                !addTaskTitle.trim() ||
                (project.status === "active" && !addTaskHours.trim())
              }
              className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              title={project.status === "active" && !addTaskHours.trim() ? "Hours are required for active projects" : ""}
            >
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
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-100">{t.title}</span>
                    {t.description && (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{t.description}</p>
                    )}
                  </div>
                  {isAssignedDev ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={t.status === "todo" ? "not_started" : t.status}
                        onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="waiting_response">Waiting response</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTaskId(t.id);
                          setEditTaskTitle(t.title);
                          setEditTaskDescription(t.description ?? "");
                        }}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <span className="capitalize text-slate-400">{t.status.replace("_", " ")}</span>
                  )}
                </div>
                {isAssignedDev && editingTaskId === t.id && (
                  <div className="mt-2 rounded border border-slate-700 bg-slate-900/50 p-2">
                    <label className="block text-xs text-slate-400">
                      Title
                      <input
                        type="text"
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                      />
                    </label>
                    <label className="mt-2 block text-xs text-slate-400">
                      Description (optional)
                      <textarea
                        value={editTaskDescription}
                        onChange={(e) => setEditTaskDescription(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                      />
                    </label>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={savingTaskEdit || !editTaskTitle.trim()}
                        onClick={() => void saveTaskEdit(t.id)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {savingTaskEdit ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
        {isAssignedDev && (
          <form onSubmit={handleAddMilestone} className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-slate-400">Milestone name</span>
              <input
                type="text"
                value={addMilestoneName}
                onChange={(e) => setAddMilestoneName(e.target.value)}
                placeholder="e.g. UI complete"
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Due date (optional)</span>
              <input
                type="date"
                value={addMilestoneDueDate}
                onChange={(e) => setAddMilestoneDueDate(e.target.value)}
                className="w-44 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
              />
            </label>
            <button
              type="submit"
              disabled={addingMilestone || !addMilestoneName.trim()}
              className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {addingMilestone ? "Adding…" : "Add milestone"}
            </button>
          </form>
        )}
        {milestoneError && <p className="mb-2 text-sm text-rose-300">{milestoneError}</p>}
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

      {editOpen && isDirector && (
        <EditProjectContactModal
          projectId={project.id}
          initial={{
            name: project.name,
            status: project.status,
            startDate: project.startDate ? String(project.startDate).slice(0, 10) : "",
            endDate: project.endDate ? String(project.endDate).slice(0, 10) : "",
            clientOrOwnerName: project.clientOrOwnerName ?? "",
            phone: project.phone ?? "",
            email: project.email ?? "",
            price: project.price ?? "",
            managementMonthlyAmount: project.managementMonthlyAmount ?? "",
            managementMonths: project.managementMonths ?? "",
            projectDetails: project.projectDetails ?? "",
            timeline: Array.isArray(project.timeline) ? project.timeline : [],
            assignedDeveloperId: project.assignedDeveloper?.id ?? ""
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
  initial: {
    name: string;
    status: string;
    startDate?: string;
    endDate?: string;
    clientOrOwnerName: string;
    phone: string;
    email: string;
    price: string | number;
    managementMonthlyAmount?: string | number;
    managementMonths?: string | number;
    projectDetails?: string;
    timeline?: { date?: string; title?: string }[];
    assignedDeveloperId?: string;
  };
  onClose: () => void;
  onSaved: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const { apiFetch: apiFetch2 } = useAuth();
  const [clientOrOwnerName, setClientOrOwnerName] = useState(initial.clientOrOwnerName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [price, setPrice] = useState(String(initial.price ?? ""));
  const [managementMonthlyAmount, setManagementMonthlyAmount] = useState(String(initial.managementMonthlyAmount ?? ""));
  const [managementMonths, setManagementMonths] = useState(String(initial.managementMonths ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(initial.name);
  const [status, setStatus] = useState(initial.status);
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [projectDetails, setProjectDetails] = useState(initial.projectDetails ?? "");
  const [timeline, setTimeline] = useState<{ date: string; title: string }[]>(
    Array.isArray(initial.timeline) ? initial.timeline.map((t) => ({ date: t.date ?? "", title: t.title ?? "" })) : []
  );
  const [developers, setDevelopers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [assignedDeveloperId, setAssignedDeveloperId] = useState(initial.assignedDeveloperId ?? "");

  useEffect(() => {
    apiFetch2("/projects/assignable-developers")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setDevelopers(Array.isArray(list) ? list : []))
      .catch(() => setDevelopers([]));
  }, [apiFetch2]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          clientOrOwnerName: clientOrOwnerName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          price: price.trim() ? Number(price) : null,
          managementMonthlyAmount: managementMonthlyAmount.trim() ? Number(managementMonthlyAmount) : null,
          managementMonths: managementMonths.trim() ? Math.max(0, Math.floor(Number(managementMonths))) : null,
          projectDetails: projectDetails.trim() || null,
          timeline: timeline.length ? timeline.map((t) => ({ date: t.date || undefined, title: t.title || undefined })) : null,
          assignedDeveloperId: assignedDeveloperId || null
        })
      });
      if (res.ok) onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-700 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-50">Edit project</h3>
          <p className="mt-1 text-xs text-slate-500">Scroll the form on small screens; actions stay pinned at the bottom.</p>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Project name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-slate-400">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-slate-400">End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Assigned developer</span>
            <select value={assignedDeveloperId} onChange={(e) => setAssignedDeveloperId(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
              <option value="">—</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.email}
                </option>
              ))}
            </select>
          </label>
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
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Project details</span>
            <textarea value={projectDetails} onChange={(e) => setProjectDetails(e.target.value)} rows={4} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-400">Timeline</span>
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="date"
                  value={t.date}
                  onChange={(e) => setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Title"
                  value={t.title}
                  onChange={(e) => setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                />
                <button type="button" onClick={() => setTimeline((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-slate-200">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setTimeline((prev) => [...prev, { date: "", title: "" }])} className="text-xs text-sky-400 hover:underline">
              + Add timeline item
            </button>
          </div>
          <p className="text-xs text-slate-500">When project is on management:</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Expected per month (KES)</span>
            <input type="number" min={0} step={0.01} value={managementMonthlyAmount} onChange={(e) => setManagementMonthlyAmount(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="e.g. 50000" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">For how long (months)</span>
            <input type="number" min={0} value={managementMonths} onChange={(e) => setManagementMonths(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="e.g. 12" />
          </label>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-700 bg-slate-900/95 px-5 py-3">
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
