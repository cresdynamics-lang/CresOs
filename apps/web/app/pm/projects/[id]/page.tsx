"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../auth-context";
import { pmNeu } from "../../../../components/pm/pm-theme";
import { PmFullscreenPage, PmPageHero, PmSection } from "../../../../components/pm/pm-shell";
import { PmHealthBadge } from "../../../../components/pm/pm-health-badge";
import { canAccessPmWorkspace } from "../../../../lib/is-pm-only";

type Milestone = {
  id: string;
  name: string;
  dueDate: string | null;
  status: string;
  acceptanceCriteria?: string | null;
  completionNotes?: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  assignee?: { id: string; name: string } | null;
};

type DevAssignment = { user: { id: string; name: string; email: string } };

type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  successCriteria?: string | null;
  agileSprintNotes?: string | null;
  projectDetails?: string | null;
  milestones?: Milestone[];
  tasks?: Task[];
  developerAssignments?: DevAssignment[];
};

export default function PmProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [successCriteria, setSuccessCriteria] = useState("");
  const [sprintNotes, setSprintNotes] = useState("");
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [sprintSuggestion, setSprintSuggestion] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(`/pm/projects/${id}`);
    if (res.ok) {
      const data = (await res.json()) as ProjectDetail;
      setProject(data);
      setSuccessCriteria(data.successCriteria ?? "");
      setSprintNotes(data.agileSprintNotes ?? "");
    }
    const intelRes = await apiFetch("/pm/intelligence?brief=0");
    if (intelRes.ok) {
      const intel = (await intelRes.json()) as { projects: { projectId: string; healthScore: number }[] };
      const row = intel.projects?.find((p) => p.projectId === id);
      if (row) setHealthScore(row.healthScore);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    if (!canAccess || !id) return;
    void load();
  }, [canAccess, id, load]);

  const saveProject = async () => {
    setSaving(true);
    try {
      await apiFetch(`/pm/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successCriteria, agileSprintNotes: sprintNotes })
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const fetchSprintSuggestion = async () => {
    setLoadingSuggestion(true);
    try {
      const res = await apiFetch(`/pm/projects/${id}/sprint-suggestion`, { method: "POST" });
      if (res.ok) {
        const j = (await res.json()) as { suggestion: string; healthScore: number };
        setSprintSuggestion(j.suggestion);
        setHealthScore(j.healthScore);
      }
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const addMilestone = async () => {
    if (!milestoneName.trim()) return;
    await apiFetch(`/pm/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: milestoneName, dueDate: milestoneDue || undefined })
    });
    setMilestoneName("");
    setMilestoneDue("");
    await load();
  };

  const updateMilestoneStatus = async (milestoneId: string, status: string) => {
    await apiFetch(`/pm/milestones/${milestoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await load();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await apiFetch(`/pm/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskTitle,
        assigneeId: taskAssignee || undefined
      })
    });
    setTaskTitle("");
    setTaskAssignee("");
    await load();
  };

  if (!canAccess) return null;
  if (!project) {
    return <p className="px-5 py-8 text-sm text-slate-500">Loading project…</p>;
  }

  const devs = project.developerAssignments?.map((a) => a.user) ?? [];

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Project"
        title={project.name}
        description={project.projectDetails?.slice(0, 200) || "Agile delivery tracking"}
        backHref="/pm/projects"
        backLabel="All projects"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {healthScore != null ? (
              <PmHealthBadge
                score={healthScore}
                riskLevel={healthScore >= 75 ? "healthy" : healthScore >= 55 ? "watch" : healthScore >= 35 ? "at_risk" : "critical"}
              />
            ) : null}
            <button
              type="button"
              className={pmNeu.btnGhost}
              disabled={loadingSuggestion}
              onClick={() => void fetchSprintSuggestion()}
            >
              {loadingSuggestion ? "Thinking…" : "Smart sprint recovery"}
            </button>
            <button type="button" className={pmNeu.btnPrimary} disabled={saving} onClick={() => void saveProject()}>
              {saving ? "Saving…" : "Save criteria"}
            </button>
          </div>
        }
      />

      {sprintSuggestion ? (
        <div className={`${pmNeu.panelInset} mx-5 mb-4 whitespace-pre-wrap text-sm text-slate-300 lg:mx-8`}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-teal-400">AI agile recovery plan</p>
          {sprintSuggestion}
        </div>
      ) : null}

      <PmSection label="Success criteria">
        <textarea
          className="w-full rounded-xl border border-white/[0.06] bg-[#0e1319] p-3 text-sm text-slate-200"
          rows={3}
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder="What does done look like for this project?"
        />
        <label className="mt-3 block text-xs text-slate-500">Agile sprint notes (delays, blockers, retro)</label>
        <textarea
          className="mt-1 w-full rounded-xl border border-white/[0.06] bg-[#0e1319] p-3 text-sm text-slate-200"
          rows={3}
          value={sprintNotes}
          onChange={(e) => setSprintNotes(e.target.value)}
          placeholder="Sprint goals, slip reasons, mitigation…"
        />
      </PmSection>

      <PmSection label="Milestones" description="Mark delayed items and move status as delivery evolves.">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm"
            placeholder="Milestone name"
            value={milestoneName}
            onChange={(e) => setMilestoneName(e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm"
            value={milestoneDue}
            onChange={(e) => setMilestoneDue(e.target.value)}
          />
          <button type="button" className={pmNeu.btnGhost} onClick={() => void addMilestone()}>
            Add
          </button>
        </div>
        {(project.milestones ?? []).map((m) => {
          const overdue =
            m.status !== "completed" && m.dueDate && new Date(m.dueDate).getTime() < Date.now();
          return (
            <div key={m.id} className={`${pmNeu.listRow} flex flex-wrap items-center justify-between gap-2`}>
              <div>
                <p className="text-sm text-slate-100">
                  {m.name}
                  {overdue ? <span className="ml-2 text-xs text-amber-400">overdue</span> : null}
                </p>
                <p className="text-xs text-slate-500">
                  Due {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "—"} · {m.status}
                </p>
              </div>
              <select
                className="rounded-lg border border-white/[0.06] bg-[#0e1319] px-2 py-1 text-xs"
                value={m.status}
                onChange={(e) => void updateMilestoneStatus(m.id, e.target.value)}
              >
                <option value="pending">pending</option>
                <option value="in_progress">in progress</option>
                <option value="completed">completed</option>
                <option value="blocked">blocked</option>
              </select>
            </div>
          );
        })}
      </PmSection>

      <PmSection label="Tasks" description="Assigned tasks appear on the developer schedule automatically.">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm"
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <select
            className="rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm"
            value={taskAssignee}
            onChange={(e) => setTaskAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {devs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" className={pmNeu.btnGhost} onClick={() => void addTask()}>
            Assign task
          </button>
        </div>
        {(project.tasks ?? []).map((t) => (
          <div key={t.id} className={`${pmNeu.listRow} flex justify-between gap-2`}>
            <div>
              <p className="text-sm text-slate-100">{t.title}</p>
              <p className="text-xs text-slate-500">
                {t.assignee?.name ?? "Unassigned"} · {t.status}
              </p>
            </div>
          </div>
        ))}
      </PmSection>

      <PmSection label="Team on project">
        {devs.length === 0 ? (
          <p className="text-sm text-slate-500">No accepted developers yet.</p>
        ) : (
          <ul className="space-y-2">
            {devs.map((d) => (
              <li key={d.id} className="text-sm text-slate-300">
                {d.name} <span className="text-slate-600">({d.email})</span>
              </li>
            ))}
          </ul>
        )}
      </PmSection>
    </PmFullscreenPage>
  );
}
