"use client";

import Link from "next/link";
import { formatMoney } from "../format-money";
import { directorNeu } from "../../components/director/director-theme";
import { DirectorFullscreenPage, DirectorPageHero, DirectorSection } from "../../components/director/director-shell";

type TaskSummary = { not_started: number; in_progress: number; waiting_response: number; blocked: number; done: number };

export type DirectorProjectRow = {
  id: string;
  name: string;
  status: string;
  type?: string | null;
  clientOrOwnerName?: string | null;
  price?: number | null;
  approvalStatus?: string;
  assignedDeveloper?: { id: string; name: string | null; email: string } | null;
  developerAssignments?: {
    id: string;
    userId: string;
    status: string;
    user: { id: string; name: string | null; email: string };
  }[];
  taskSummary?: TaskSummary;
  financeProjectSeq?: number | null;
  financeRefYear?: number | null;
};

type Filter = "all" | "pending" | "approved";

export function DirectorProjectsView({
  projects,
  filter,
  onFilterChange,
  emptyMessage,
  loading,
  onNewProject,
  onApprove,
  approvingId,
  onGenerateClientMessage,
  generatingId,
  linkInput,
  onLinkInputChange,
  clientMessage,
  onDismissClientMessage,
  onCopyClientMessage,
  copyDone
}: {
  projects: DirectorProjectRow[];
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  emptyMessage: string;
  loading: boolean;
  onNewProject: () => void;
  onApprove: (id: string) => void;
  approvingId: string | null;
  onGenerateClientMessage: (project: DirectorProjectRow) => void;
  generatingId: string | null;
  linkInput: Record<string, string>;
  onLinkInputChange: (projectId: string, value: string) => void;
  clientMessage?: { projectName: string; message: string; link?: string } | null;
  onDismissClientMessage?: () => void;
  onCopyClientMessage?: () => void;
  copyDone?: boolean;
}) {
  const filterPills: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" }
  ];

  const heroActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {filterPills.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={
                active
                  ? "rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200"
                  : "rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <Link href="/projects/management" className={directorNeu.btnGhost}>
        Management billing
      </Link>
      <button type="button" onClick={onNewProject} className={directorNeu.btnPrimary}>
        New project
      </button>
    </div>
  );

  return (
    <DirectorFullscreenPage>
      <DirectorPageHero
        eyebrow="Delivery"
        title="Projects"
        description={
          loading
            ? "Loading project directory…"
            : `${projects.length} project${projects.length === 1 ? "" : "s"}${filter !== "all" ? ` · ${filter}` : ""}`
        }
        actions={heroActions}
      />

      <DirectorSection
        label="Project directory"
        description="Finance ref, client, team assignment, delivery status, and approval."
      >
        {loading ? (
          <p className="py-8 text-sm text-slate-500">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto lg:-mx-8">
            <table className="min-w-[64rem] w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#0e1319]/90 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-5 py-2.5 font-medium lg:px-8">Project</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Finance ref</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Client</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="px-3 py-2.5 font-medium">Team</th>
                  <th className="px-3 py-2.5 font-medium">Delivery</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Approval</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium lg:px-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {projects.map((project) => {
                  const ts = project.taskSummary;
                  const financeRef =
                    project.financeProjectSeq != null && project.financeRefYear != null
                      ? `${String(project.financeProjectSeq).padStart(3, "0")}/${String(project.financeRefYear % 100).padStart(2, "0")}`
                      : "—";
                  const deliveryShort =
                    project.approvalStatus === "approved" && ts
                      ? `Done ${ts.done} · IP ${ts.in_progress} · Wait ${ts.waiting_response} · Blk ${ts.blocked} · NS ${ts.not_started ?? 0}`
                      : "—";
                  return (
                    <tr key={project.id} className="align-top transition-colors hover:bg-sky-500/[0.04]">
                      <td className="max-w-[14rem] px-5 py-3 font-medium text-slate-100 lg:px-8">
                        <Link
                          href={`/projects/${project.id}`}
                          className="line-clamp-2 font-medium text-sky-300 hover:text-sky-200 hover:underline"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-400">{financeRef}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {project.type === "demo" ? (
                          <span className="rounded-full border border-violet-500/25 bg-violet-950/30 px-2 py-0.5 text-xs text-violet-300">
                            Demo
                          </span>
                        ) : project.type === "project" ? (
                          <span className="rounded-full border border-sky-500/25 bg-sky-950/30 px-2 py-0.5 text-xs text-sky-300">
                            Project
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[10rem] px-3 py-3 text-slate-400">
                        <span className="line-clamp-2">{project.clientOrOwnerName ?? "—"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-200">
                        {project.price != null && project.price > 0 ? formatMoney(Number(project.price)) : "—"}
                      </td>
                      <td className="max-w-[12rem] px-3 py-3 text-xs text-slate-500">
                        {project.developerAssignments && project.developerAssignments.length > 0 ? (
                          <span
                            className="line-clamp-2"
                            title={project.developerAssignments.map((a) => a.user.name || a.user.email).join(", ")}
                          >
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
                      <td className="max-w-[12rem] px-3 py-3 text-xs text-slate-500">
                        <span className="line-clamp-2" title={deliveryShort}>
                          {deliveryShort}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {project.approvalStatus === "pending_approval" && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-200">
                            Pending
                          </span>
                        )}
                        {project.approvalStatus === "approved" && (
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-300">
                            Approved
                          </span>
                        )}
                        {project.approvalStatus &&
                          !["pending_approval", "approved"].includes(project.approvalStatus) && (
                            <span className="text-xs capitalize text-slate-400">{project.approvalStatus}</span>
                          )}
                        {!project.approvalStatus && <span className="text-slate-600">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 capitalize text-slate-300">
                        <span className="rounded-full border border-white/[0.08] bg-[#0e1319] px-2 py-0.5 text-xs">
                          {project.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right lg:px-8">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Link
                              href={`/projects/${project.id}`}
                              className="inline-flex rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200 hover:bg-sky-500/15"
                            >
                              View
                            </Link>
                            {project.approvalStatus === "pending_approval" && (
                              <button
                                type="button"
                                onClick={() => onApprove(project.id)}
                                disabled={approvingId === project.id}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {approvingId === project.id ? "…" : "Approve"}
                              </button>
                            )}
                          </div>
                          <div className="flex max-w-[14rem] flex-wrap justify-end gap-1">
                            <input
                              type="url"
                              placeholder="Client link"
                              value={linkInput[project.id] ?? ""}
                              onChange={(e) => onLinkInputChange(project.id, e.target.value)}
                              className={`min-w-0 flex-1 ${directorNeu.input} !px-2 !py-1 text-xs`}
                            />
                            <button
                              type="button"
                              onClick={() => onGenerateClientMessage(project)}
                              disabled={generatingId === project.id}
                              className="shrink-0 rounded-lg border border-white/[0.08] bg-[#121820] px-2 py-1 text-xs text-slate-200 hover:text-white disabled:opacity-50"
                            >
                              {generatingId === project.id ? "…" : "Client msg"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DirectorSection>

      {clientMessage && (
        <DirectorSection label={`Client message — ${clientMessage.projectName}`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{clientMessage.message}</p>
          {clientMessage.link && (
            <a
              href={clientMessage.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-sky-400 hover:underline"
            >
              View status: {clientMessage.link}
            </a>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCopyClientMessage} className={directorNeu.btnGhost}>
              {copyDone ? "Copied" : "Copy message"}
            </button>
            <button type="button" onClick={onDismissClientMessage} className={directorNeu.btnGhost}>
              Close
            </button>
          </div>
        </DirectorSection>
      )}
    </DirectorFullscreenPage>
  );
}
