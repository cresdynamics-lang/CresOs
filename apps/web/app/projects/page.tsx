"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { emitDataRefresh } from "../data-refresh";
import { formatMoney } from "../format-money";
import {
  CrmActionLink,
  CrmDataTable,
  CrmSectionPanel,
  CrmTableHead,
  WorkspaceFilterPills
} from "../../components/crm/crm-section";
import { WorkspaceHubCard } from "../../components/workspace-hub-card";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";
import { DashboardCardRow, DashboardScrollCard } from "../../components/dashboard-card-row";

type Developer = { id: string; name: string | null; email: string };

type TaskSummary = { not_started: number; in_progress: number; waiting_response: number; blocked: number; done: number };

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
  developerAssignments?: {
    id: string;
    userId: string;
    status: string;
    user: { id: string; name: string | null; email: string };
  }[];
  createdBy?: { id: string; name: string | null; email: string } | null;
  approvedBy?: { id: string; name: string | null } | null;
  startDate?: string | null;
  endDate?: string | null;
  clientLink?: string | null;
  timeline?: { date?: string; title?: string }[] | null;
  taskSummary?: TaskSummary;
  financeProjectSeq?: number | null;
  financeRefYear?: number | null;
};

type ClientMessageResult = { message: string; link?: string };

export default function ProjectsPage() {
  const { apiFetch, auth } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [clientMessage, setClientMessage] = useState<{ projectId: string; projectName: string; result: ClientMessageResult } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState<Record<string, string>>({});
  const [copyDone, setCopyDone] = useState(false);
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const isSales = auth.roleKeys.some((r) => ["director_admin", "sales"].includes(r));
  const isDirector = auth.roleKeys.includes("director_admin");
  const isDeveloperOnly =
    auth.roleKeys.includes("developer") &&
    !auth.roleKeys.some((r) => ["admin", "director_admin", "sales", "finance", "analyst", "client"].includes(r));
  /** Developers alone cannot create projects; Sales and Director can. */
  const canCreateProject =
    auth.roleKeys.includes("sales") ||
    auth.roleKeys.includes("director_admin");
  /** Project approval is director-only (not admin). */
  const canApproveProject = auth.roleKeys.includes("director_admin");
  const isFinance = auth.roleKeys.includes("finance");
  const canGenerateMessage = auth.roleKeys.some((r) => ["director_admin", "sales", "analyst"].includes(r));
  const canFilterByApproval = auth.roleKeys.some((r) => ["admin", "director_admin"].includes(r));
  const canSeeManagement = auth.roleKeys.some((r) => ["admin", "director_admin", "finance"].includes(r));

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
          developerAssignments: Array.isArray(p.developerAssignments) ? p.developerAssignments : [],
          createdBy: p.createdBy,
          approvedBy: p.approvedBy,
          startDate: p.startDate,
          endDate: p.endDate,
          clientLink: p.clientLink,
          timeline: p.timeline,
          taskSummary: p.taskSummary,
          financeProjectSeq: p.financeProjectSeq,
          financeRefYear: p.financeRefYear
        }))
      );
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects =
    filter === "all"
      ? projects
      : filter === "pending"
        ? projects.filter((p) => p.approvalStatus === "pending_approval")
        : projects.filter((p) => p.approvalStatus === "approved");

  useEffect(() => {
    if (!createOpen || !canCreateProject) return;
    apiFetch("/projects/assignable-developers")
      .then((r) => r.ok && r.json())
      .then((list) => setDevelopers(Array.isArray(list) ? list : []))
      .catch(() => setDevelopers([]));
  }, [createOpen, canCreateProject, apiFetch]);

  async function handleApprove(projectId: string) {
    setApprovingId(projectId);
    try {
      const res = await apiFetch(`/projects/${projectId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" })
      });
      if (res.ok) {
        await loadProjects();
        emitDataRefresh();
      }
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

  const emptyMessage =
    filter === "all"
      ? `No projects yet.${canCreateProject ? " Create one to get started." : ""}`
      : `No ${filter} projects.`;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canFilterByApproval && (
        <WorkspaceFilterPills
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", tone: "brand" },
            { value: "pending", label: "Pending", tone: "amber" },
            { value: "approved", label: "Approved", tone: "emerald" }
          ]}
        />
      )}
      {canCreateProject && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_-6px_rgba(14,165,233,0.45)] hover:bg-sky-500"
        >
          New project
        </button>
      )}
    </div>
  );

  return (
    <section className="flex min-h-[calc(100dvh-6.5rem)] max-lg:min-h-[calc(100dvh-10rem)] w-full min-w-0 flex-1 flex-col gap-5">
      <WorkspaceDashboardIntro
        title="Projects"
        brandLead="Operating system for growth"
        description="Developers only work on assigned projects (accept when invited). Directors can invite multiple developers and comment on tasks; daily reports remain on Developer reports."
        eyebrow="Delivery"
        showWelcomeBanner={false}
      />

      {canSeeManagement && (
        <DashboardCardRow lgCols={2} layout="scroll" className="shrink-0">
          <DashboardScrollCard>
            <div className="min-w-[14rem]">
              <WorkspaceHubCard
                href="/projects"
                title="Project directory"
                description="All delivery work: finance ref, client, developer assignment, and approval."
                action="Current view"
                tone="emerald"
                icon="▣"
              />
            </div>
          </DashboardScrollCard>
          <DashboardScrollCard>
            <div className="min-w-[14rem]">
              <WorkspaceHubCard
                href="/projects/management"
                title="Projects on management"
                description="Monthly retainer tracking, paid months, and finance invoicing."
                action="Open management"
                tone="sky"
                icon="◎"
              />
            </div>
          </DashboardScrollCard>
        </DashboardCardRow>
      )}

      <CrmSectionPanel
        title="Project directory"
        tone="emerald"
        description={`${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"}${filter !== "all" ? ` · ${filter} filter` : ""}`}
        action={toolbar}
        className="flex min-h-[min(28rem,55vh)] flex-1 flex-col lg:min-h-0"
      >
        <div className="min-h-0 flex-1 overflow-auto">
        <CrmDataTable emptyMessage={emptyMessage} isEmpty={filteredProjects.length === 0}>
          <table className="min-w-[64rem] w-full text-left text-sm text-slate-200">
            <CrmTableHead>
              <th className="px-3 py-2.5 font-medium">Project</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Finance ref</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Client</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 font-medium">Team</th>
              <th className="px-3 py-2.5 font-medium">Delivery</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Approval</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Actions</th>
            </CrmTableHead>
            <tbody>
            {filteredProjects.map((project) => {
              const ts = project.taskSummary;
              const financeRef =
                project.financeProjectSeq != null && project.financeRefYear != null
                  ? `${String(project.financeProjectSeq).padStart(3, "0")}/${String(project.financeRefYear % 100).padStart(2, "0")}`
                  : "—";
              const deliveryShort =
                project.approvalStatus === "approved" && ts
                  ? `Done ${ts.done} · IP ${ts.in_progress} · Wait ${ts.waiting_response} · Blk ${ts.blocked} · NS ${ts.not_started ?? (ts as { todo?: number }).todo ?? 0}`
                  : "—";
              return (
                <tr key={project.id} className="border-b border-slate-800/60 align-top transition-colors hover:bg-emerald-500/5">
                  <td className="max-w-[14rem] px-3 py-2.5 font-medium text-slate-100">
                    {isDeveloperOnly ? (
                      <span className="line-clamp-2">{project.name}</span>
                    ) : (
                      <Link href={`/projects/${project.id}`} className="font-medium text-emerald-300 hover:underline line-clamp-2">
                        {project.name}
                      </Link>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-violet-300/90">{financeRef}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {project.type === "demo" ? (
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                        Demo
                      </span>
                    ) : project.type === "project" ? (
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                        Project
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[10rem] px-3 py-2.5 text-slate-400">
                    <span className="line-clamp-2">{project.clientOrOwnerName ?? "—"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-emerald-400/90">
                    {project.price != null && project.price > 0
                      ? typeof project.price === "number"
                        ? formatMoney(project.price)
                        : project.price
                      : "—"}
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5 text-xs text-slate-500">
                    {project.developerAssignments && project.developerAssignments.length > 0 ? (
                      <span className="line-clamp-2" title={project.developerAssignments.map((a) => a.user.name || a.user.email).join(", ")}>
                        {project.developerAssignments
                          .map((a) => `${a.user.name || a.user.email}${a.status === "accepted" ? "" : ` (${a.status})`}`)
                          .join(", ")}
                      </span>
                    ) : project.assignedDeveloper ? (
                      project.assignedDeveloper.name || project.assignedDeveloper.email
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5 text-xs text-slate-500">
                    <span className="line-clamp-2" title={deliveryShort}>
                      {deliveryShort}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {project.approvalStatus === "pending_approval" && (
                      <span className="rounded bg-amber-900/60 px-2 py-0.5 text-xs text-amber-200">Pending</span>
                    )}
                    {project.approvalStatus === "approved" && (
                      <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">Approved</span>
                    )}
                    {project.approvalStatus && !["pending_approval", "approved"].includes(project.approvalStatus) && (
                      <span className="text-xs capitalize text-slate-400">{project.approvalStatus}</span>
                    )}
                    {!project.approvalStatus && <span className="text-slate-500">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 capitalize text-slate-300">
                    <span className="rounded-full border border-slate-600/50 bg-slate-800/60 px-2 py-0.5 text-xs">
                      {project.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <CrmActionLink href={`/projects/${project.id}`}>
                          {isDeveloperOnly ? "Details" : "View"}
                        </CrmActionLink>
                        {canApproveProject && project.approvalStatus === "pending_approval" && (
                          <button
                            type="button"
                            onClick={() => handleApprove(project.id)}
                            disabled={approvingId === project.id}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {approvingId === project.id ? "…" : "Approve"}
                          </button>
                        )}
                      </div>
                      {!isDeveloperOnly && canGenerateMessage && (
                        <div className="flex max-w-[14rem] flex-wrap justify-end gap-1">
                          <input
                            type="url"
                            placeholder="Link"
                            value={linkInput[project.id] ?? ""}
                            onChange={(e) => setLinkInput((prev) => ({ ...prev, [project.id]: e.target.value }))}
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateClientMessage(project)}
                            disabled={generatingId === project.id}
                            className="shrink-0 rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
                          >
                            {generatingId === project.id ? "…" : "Client msg"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </CrmDataTable>
        </div>
      </CrmSectionPanel>

      {createOpen && canCreateProject && (
        <CreateProjectModal
          developers={developers}
          directorMode={isDirector}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadProjects();
            emitDataRefresh();
          }}
          apiFetch={apiFetch}
        />
      )}

      {clientMessage && (
        <CrmSectionPanel title={`Client message — ${clientMessage.projectName}`} tone="violet">
          <p className="whitespace-pre-wrap rounded-xl border border-violet-500/20 bg-slate-950/50 p-3 text-sm text-slate-200">
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
        </CrmSectionPanel>
      )}
    </section>
  );
}

function CreateProjectModal({
  developers,
  directorMode,
  onClose,
  onCreated,
  apiFetch
}: {
  developers: Developer[];
  directorMode: boolean;
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
  const [assignedDeveloperIds, setAssignedDeveloperIds] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<{ date: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required"); return; }
    if (!directorMode && type === "project" && !price.trim()) {
      // price optional for demo only
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        clientOrOwnerName: clientOrOwnerName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        price: price.trim() ? Number(price) : undefined,
        projectDetails: projectDetails.trim() || undefined,
        status,
        timeline: timeline.length ? timeline : undefined
      };
      if (!directorMode) {
        payload.type = type;
      }
      if (directorMode && assignedDeveloperIds.length > 0) {
        payload.assignedDeveloperIds = assignedDeveloperIds;
      } else if (assignedDeveloperId) {
        payload.assignedDeveloperId = assignedDeveloperId;
      }
      const res = await apiFetch("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
        <h3 className="mb-4 text-lg font-semibold text-slate-50">{directorMode ? "New project (Director)" : "New project"}</h3>
        <p className="mb-2 text-xs text-slate-500">
          {directorMode
            ? "Creates approved immediately. Invite one or more developers — each must accept before working tasks."
            : "Submitted for director approval unless your org policy differs."}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Project name *</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" />
          </label>
          {!directorMode && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as "demo" | "project")} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
                <option value="demo">Demo</option>
                <option value="project">Project</option>
              </select>
            </label>
          )}
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
          {directorMode ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Invite developers (accept required)</span>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-slate-700 bg-slate-800/80 p-2">
                {developers.length === 0 ? (
                  <p className="text-xs text-slate-500">No developers in org.</p>
                ) : (
                  developers.map((d) => (
                    <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={assignedDeveloperIds.includes(d.id)}
                        onChange={(e) => {
                          setAssignedDeveloperIds((prev) =>
                            e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)
                          );
                        }}
                      />
                      {d.name || d.email}
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Assign developer</span>
              <select value={assignedDeveloperId} onChange={(e) => setAssignedDeveloperId(e.target.value)} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100">
                <option value="">—</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name || d.email}</option>
                ))}
              </select>
            </label>
          )}
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
