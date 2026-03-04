"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";

type Developer = { id: string; name: string | null; email: string };

type Project = {
  id: string;
  name: string;
  status: string;
  type?: string | null;
  clientOrOwnerName?: string | null;
  phone?: string | null;
  email?: string | null;
  price?: number | null;
  projectDetails?: string | null;
  approvalStatus?: string;
  assignedDeveloperId?: string | null;
  assignedDeveloper?: Developer | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  approvedBy?: { id: string; name: string | null } | null;
  startDate?: string | null;
  endDate?: string | null;
  clientLink?: string | null;
  timeline?: { date?: string; title?: string }[] | null;
};

type ClientMessageResult = { message: string; link?: string };

export default function ProjectsPage() {
  const { apiFetch, auth } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [clientMessage, setClientMessage] = useState<{ projectId: string; projectName: string; result: ClientMessageResult } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState<Record<string, string>>({});
  const [copyDone, setCopyDone] = useState(false);
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const isSales = auth.roleKeys.some((r) => ["admin", "director_admin", "sales"].includes(r));
  const isDirector = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));
  const isFinance = auth.roleKeys.includes("finance");
  const canGenerateMessage = auth.roleKeys.some((r) => ["admin", "director_admin", "sales", "developer", "analyst"].includes(r));

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiFetch("/projects");
      if (!res.ok) return;
      const data = (await res.json()) as any[];
      setProjects(
        data.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          type: p.type,
          clientOrOwnerName: p.clientOrOwnerName,
          phone: p.phone,
          email: p.email,
          price: p.price,
          projectDetails: p.projectDetails,
          approvalStatus: p.approvalStatus,
          assignedDeveloperId: p.assignedDeveloperId,
          assignedDeveloper: p.assignedDeveloper,
          createdBy: p.createdBy,
          approvedBy: p.approvedBy,
          startDate: p.startDate,
          endDate: p.endDate,
          clientLink: p.clientLink,
          timeline: p.timeline
        }))
      );
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!createOpen || !isSales) return;
    apiFetch("/projects/assignable-developers")
      .then((r) => r.ok && r.json())
      .then((list) => setDevelopers(Array.isArray(list) ? list : []))
      .catch(() => setDevelopers([]));
  }, [createOpen, isSales, apiFetch]);

  async function handleApprove(projectId: string) {
    setApprovingId(projectId);
    try {
      const res = await apiFetch(`/projects/${projectId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" })
      });
      if (res.ok) await loadProjects();
    } finally {
      setApprovingId(null);
    }
  }

  async function handleGenerateClientMessage(project: Project) {
    setGeneratingId(project.id);
    setClientMessage(null);
    try {
      const link = linkInput[project.id]?.trim() || undefined;
      const res = await apiFetch(`/projects/${project.id}/client-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link ? { link } : {})
      });
      const data = (await res.json()) as ClientMessageResult | { error?: string; fallback?: string };
      if (res.ok && "message" in data) {
        setClientMessage({ projectId: project.id, projectName: project.name, result: { message: data.message, link: data.link } });
      } else if (!res.ok && "fallback" in data && data.fallback) {
        setClientMessage({ projectId: project.id, projectName: project.name, result: { message: data.fallback } });
      }
    } catch {
      // ignore
    } finally {
      setGeneratingId(null);
    }
  }

  async function saveProjectLink(projectId: string, link: string) {
    if (!link.trim()) return;
    setSavingLinkId(projectId);
    try {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientLink: link.trim() })
      });
      if (res.ok) await loadProjects();
    } finally {
      setSavingLinkId(null);
    }
  }

  function copyToClipboard() {
    if (!clientMessage) return;
    const text = clientMessage.result.link
      ? `${clientMessage.result.message}\n\nView status: ${clientMessage.result.link}`
      : clientMessage.result.message;
    navigator.clipboard.writeText(text).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Projects</h2>
          <p className="text-sm text-slate-300">
            Track projects, milestones, and tasks. Sales create projects for director approval; developers receive approved projects and tasks; finance sees contact and price after approval.
          </p>
        </div>
        {isSales && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            New project
          </button>
        )}
      </div>

      {/* Card grid: 3 per row desktop, 1 mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="flex flex-col rounded-xl border border-slate-700 bg-slate-900/60 p-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                <h3 className="truncate font-medium text-slate-100">{project.name}</h3>
              </Link>
              <span className="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-xs capitalize text-slate-300">
                {project.status}
              </span>
            </div>
            {project.type && (
              <p className="mb-1 text-xs text-slate-400">
                {project.type === "demo" ? "Demo" : "Project"}
              </p>
            )}
            {project.clientOrOwnerName != null && (
              <p className="truncate text-xs text-slate-400">Client: {project.clientOrOwnerName}</p>
            )}
            {project.price != null && project.price > 0 && (
              <p className="text-xs text-emerald-400">
                {typeof project.price === "number" ? `$${project.price.toLocaleString()}` : project.price}
              </p>
            )}
            {project.assignedDeveloper && (
              <p className="mt-1 text-xs text-slate-500">
                Dev: {project.assignedDeveloper.name || project.assignedDeveloper.email}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {project.approvalStatus === "pending_approval" && (
                <span className="rounded bg-amber-900/60 px-2 py-0.5 text-xs text-amber-200">
                  Pending approval
                </span>
              )}
              {project.approvalStatus === "approved" && (
                <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">
                  Approved
                </span>
              )}
              {isDirector && project.approvalStatus === "pending_approval" && (
                <button
                  type="button"
                  onClick={() => handleApprove(project.id)}
                  disabled={approvingId === project.id}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {approvingId === project.id ? "Approving…" : "Approve"}
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/projects/${project.id}`}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                View
              </Link>
              {canGenerateMessage && (
                <>
                  <input
                    type="url"
                    placeholder="Link"
                    value={linkInput[project.id] ?? ""}
                    onChange={(e) => setLinkInput((prev) => ({ ...prev, [project.id]: e.target.value }))}
                    className="w-24 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateClientMessage(project)}
                    disabled={generatingId === project.id}
                    className="rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {generatingId === project.id ? "…" : "Client msg"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {projects.length === 0 && (
        <div className="shell text-center text-sm text-slate-400">
          No projects yet. {isSales && "Create one to get started."}
        </div>
      )}

      {createOpen && isSales && (
        <CreateProjectModal
          developers={developers}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); loadProjects(); }}
          apiFetch={apiFetch}
        />
      )}

      {clientMessage && (
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Client message — {clientMessage.projectName}
          </p>
          <p className="whitespace-pre-wrap rounded border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-200">
            {clientMessage.result.message}
            {clientMessage.result.link && (
              <>
                {"\n\n"}
                <a href={clientMessage.result.link} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                  View status: {clientMessage.result.link}
                </a>
              </>
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copyToClipboard} className="rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-500">
              {copyDone ? "Copied" : "Copy message (with link)"}
            </button>
            <button type="button" onClick={() => setClientMessage(null)} className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CreateProjectModal({
  developers,
  onClose,
  onCreated,
  apiFetch
}: {
  developers: Developer[];
  onClose: () => void;
  onCreated: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"demo" | "project">("project");
  const [clientOrOwnerName, setClientOrOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [price, setPrice] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  const [status, setStatus] = useState("planned");
  const [assignedDeveloperId, setAssignedDeveloperId] = useState("");
  const [timeline, setTimeline] = useState<{ date: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required"); return; }
    if (type === "project" && !price.trim()) {
      // price optional for demo only
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          clientOrOwnerName: clientOrOwnerName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          price: price.trim() ? Number(price) : undefined,
          projectDetails: projectDetails.trim() || undefined,
          status,
          assignedDeveloperId: assignedDeveloperId || undefined,
          timeline: timeline.length ? timeline : undefined
        })
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Failed to create project");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-slate-50">New project</h3>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Project name *</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as "demo" | "project")} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
              <option value="demo">Demo</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Client / project owner name</span>
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
            <span className="text-xs text-slate-400">Price {type === "demo" ? "(optional)" : ""}</span>
            <input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Project details</span>
            <textarea value={projectDetails} onChange={(e) => setProjectDetails(e.target.value)} rows={3} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
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
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Assign developer</span>
            <select value={assignedDeveloperId} onChange={(e) => setAssignedDeveloperId(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
              <option value="">—</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>{d.name || d.email}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Timeline (optional)</span>
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input type="date" value={t.date} onChange={(e) => setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100" />
                <input type="text" placeholder="Title" value={t.title} onChange={(e) => setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100" />
                <button type="button" onClick={() => setTimeline((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-slate-200">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setTimeline((prev) => [...prev, { date: "", title: "" }])} className="mt-1 text-xs text-sky-400 hover:underline">
              + Add timeline item
            </button>
          </div>
          {error && <p className="text-sm text-amber-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={submitting} className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              {submitting ? "Creating…" : "Create"}
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
