"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanningNote, ProjectAiPlan } from "../../lib/project-ai-plan-types";
import { countPlanMilestones, countPlanTasks } from "../../lib/project-ai-plan-types";

type PlannerTab = "voice" | "text" | "document";

type ProjectAiPlannerPanelProps = {
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  roleKeys: string[];
  projectId?: string;
  /** create = attach plan to new project; project = clarifications on existing; client = client remarks */
  mode?: "create" | "project" | "client";
  onPlanChange?: (plan: ProjectAiPlan | null) => void;
  onApplied?: () => void;
  onSuggestedFields?: (fields: {
    name?: string;
    projectDetails?: string;
    successCriteria?: string;
    timeline?: { date?: string; title: string }[];
  }) => void;
  compact?: boolean;
};

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

function canUploadDocument(roleKeys: string[]): boolean {
  return roleKeys.some((r) => ["director_admin", "sales", "project_manager"].includes(r));
}

function canUsePlanner(roleKeys: string[]): boolean {
  return roleKeys.some((r) =>
    ["director_admin", "sales", "project_manager", "admin", "client"].includes(r)
  );
}

export function ProjectAiPlannerPanel({
  apiFetch,
  roleKeys,
  projectId,
  mode = projectId ? "project" : "create",
  onPlanChange,
  onApplied,
  onSuggestedFields,
  compact = false
}: ProjectAiPlannerPanelProps) {
  const [tab, setTab] = useState<PlannerTab>("text");
  const [brief, setBrief] = useState("");
  const [plan, setPlan] = useState<ProjectAiPlan | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [notes, setNotes] = useState<PlanningNote[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const docInputRef = useRef<HTMLInputElement>(null);

  const allowDoc = canUploadDocument(roleKeys);
  const isClient = mode === "client";

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    const res = await apiFetch(`/projects/${projectId}/ai/planning-notes`);
    if (res.ok) setNotes((await res.json()) as PlanningNote[]);
  }, [apiFetch, projectId]);

  useEffect(() => {
    if (projectId && notesOpen) void loadNotes();
  }, [projectId, notesOpen, loadNotes]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handlePlanResult = useCallback(
    (next: ProjectAiPlan, extra?: { transcript?: string }) => {
      setPlan(next);
      onPlanChange?.(next);
      if (extra?.transcript) setTranscript(extra.transcript);
      onSuggestedFields?.({
        name: next.suggestedProjectName,
        projectDetails: next.projectSummary,
        successCriteria: next.successCriteria,
        timeline: next.timeline?.length ? next.timeline : undefined
      });
    },
    [onPlanChange, onSuggestedFields]
  );

  const generateFromText = async () => {
    const text = brief.trim();
    if (!text) {
      setError("Describe the project or paste clarifications first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isClient && projectId) {
        const form = new FormData();
        form.append("brief", text);
        const res = await apiFetch(`/projects/${projectId}/ai/client-remark`, { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { error?: string; plan?: ProjectAiPlan };
        if (!res.ok) {
          setError(data.error ?? "Could not process remark");
          return;
        }
        if (data.plan) handlePlanResult(data.plan);
        setBrief("");
        onApplied?.();
        return;
      }

      const res = await apiFetch("/projects/ai/plan-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: text, projectId })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; plan?: ProjectAiPlan };
      if (!res.ok) {
        setError(data.error ?? "AI planning failed");
        return;
      }
      if (data.plan) handlePlanResult(data.plan);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const uploadVoiceBlob = async (blob: Blob, mimeType: string) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      form.append("audio", blob, `planning.${ext}`);
      if (projectId) form.append("projectId", projectId);

      if (isClient && projectId) {
        const res = await apiFetch(`/projects/${projectId}/ai/client-remark`, { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          plan?: ProjectAiPlan;
        };
        if (!res.ok) {
          setError(data.error ?? "Voice remark failed");
          return;
        }
        if (data.plan) handlePlanResult(data.plan);
        onApplied?.();
        return;
      }

      const res = await apiFetch("/projects/ai/plan-from-voice", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        plan?: ProjectAiPlan;
        transcript?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Voice planning failed");
        return;
      }
      if (data.plan) handlePlanResult(data.plan, { transcript: data.transcript });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (loading || recording) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopStream();
        void uploadVoiceBlob(blob, type);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      stopStream();
      setError("Microphone permission denied.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const uploadDocument = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("document", file);
      if (projectId) form.append("projectId", projectId);

      if (isClient && projectId) {
        form.append("brief", brief.trim());
        const res = await apiFetch(`/projects/${projectId}/ai/client-remark`, { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { error?: string; plan?: ProjectAiPlan };
        if (!res.ok) {
          setError(data.error ?? "Document remark failed");
          return;
        }
        if (data.plan) handlePlanResult(data.plan);
        onApplied?.();
        return;
      }

      const res = await apiFetch("/projects/ai/plan-from-document", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string; plan?: ProjectAiPlan };
      if (!res.ok) {
        setError(data.error ?? "Could not read document");
        return;
      }
      if (data.plan) handlePlanResult(data.plan);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const applyPlan = async () => {
    if (!projectId || !plan) return;
    setApplying(true);
    setError(null);
    try {
      const res = await apiFetch(`/projects/${projectId}/ai/apply-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, merge: true })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to apply plan");
        return;
      }
      onApplied?.();
      void loadNotes();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setApplying(false);
    }
  };

  if (!canUsePlanner(roleKeys)) return null;

  const panelClass = compact
    ? "rounded-xl border border-violet-500/25 bg-violet-950/20 p-4"
    : "rounded-xl border border-violet-500/30 bg-gradient-to-b from-violet-950/40 to-slate-900/80 p-5";

  const title =
    mode === "client"
      ? "Share feedback with AI"
      : mode === "create"
        ? "AI project planner"
        : "AI planning & clarifications";

  const subtitle =
    mode === "client"
      ? "Speak or type remarks — AI updates milestones and tasks for your team."
      : "Describe the project by voice or text. AI breaks it into agile sprints, milestones, daily tasks, and role briefs.";

  return (
    <div className={panelClass}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">AI assist</p>
          <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">{subtitle}</p>
        </div>
        {projectId && mode !== "create" ? (
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            className="text-xs text-violet-300 hover:text-violet-200"
          >
            {notesOpen ? "Hide history" : "Planning history"}
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {(["text", "voice", ...(allowDoc ? (["document"] as const) : [])] as PlannerTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              tab === t
                ? "bg-violet-600/40 text-violet-100"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "text" && (
        <div className="flex flex-col gap-2">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={compact ? 3 : 4}
            placeholder={
              isClient
                ? "What should change? New requirements, priorities, or questions for the team…"
                : "E.g. Build a retail POS with inventory, 3 sprints, launch in 8 weeks, success = 99% uptime…"
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void generateFromText()}
            className="self-start rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "AI is planning…" : isClient ? "Send remark" : "Generate agile plan"}
          </button>
        </div>
      )}

      {tab === "voice" && (
        <div className="flex flex-col gap-2">
          {!recording ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void startRecording()}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-violet-500/40 bg-violet-950/50 px-4 py-2.5 text-sm font-medium text-violet-100 hover:border-violet-400/60 disabled:opacity-50"
            >
              <span aria-hidden>🎙</span>
              {loading ? "Processing…" : "Record project brief"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-500/50 bg-rose-950/40 px-4 py-2.5 text-sm font-medium text-rose-200"
            >
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              Stop & plan
            </button>
          )}
          <p className="text-xs text-slate-500">
            Speak naturally about scope, deadlines, success criteria, and deliverables.
          </p>
        </div>
      )}

      {tab === "document" && allowDoc && (
        <div className="flex flex-col gap-2">
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadDocument(file);
            }}
            className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-700 file:px-3 file:py-2 file:text-sm file:text-white"
          />
          <p className="text-xs text-slate-500">Upload PDF or Word — AI maps modules, sprints, milestones, and tasks.</p>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

      {transcript ? (
        <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Transcript</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{transcript}</p>
        </div>
      ) : null}

      {plan ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-emerald-200">
              {plan.sprints.length} sprints
            </span>
            <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-emerald-200">
              {countPlanMilestones(plan)} milestones
            </span>
            <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-emerald-200">
              {countPlanTasks(plan)} tasks
            </span>
          </div>
          {plan.projectSummary ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{plan.projectSummary}</p>
            </div>
          ) : null}
          {plan.successCriteria ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Success criteria</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{plan.successCriteria}</p>
            </div>
          ) : null}
          {plan.sprints.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sprint outline</p>
              <ul className="mt-2 space-y-2">
                {plan.sprints.map((s, i) => (
                  <li key={i} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <span className="font-medium text-slate-100">{s.name}</span>
                    {s.goal ? <span className="text-slate-500"> — {s.goal}</span> : null}
                    <span className="ml-2 text-slate-500">
                      ({s.milestones.length} milestones,{" "}
                      {s.milestones.reduce((n, m) => n + m.tasks.length, 0)} tasks)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.roleBriefs ? (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer text-violet-300">Role briefs (dev, sales, director, PM)</summary>
              <div className="mt-2 space-y-2">
                {plan.roleBriefs.developers ? (
                  <p>
                    <span className="text-slate-500">Developers: </span>
                    {plan.roleBriefs.developers}
                  </p>
                ) : null}
                {plan.roleBriefs.projectManager ? (
                  <p>
                    <span className="text-slate-500">PM: </span>
                    {plan.roleBriefs.projectManager}
                  </p>
                ) : null}
                {plan.roleBriefs.sales ? (
                  <p>
                    <span className="text-slate-500">Sales: </span>
                    {plan.roleBriefs.sales}
                  </p>
                ) : null}
                {plan.roleBriefs.director ? (
                  <p>
                    <span className="text-slate-500">Director: </span>
                    {plan.roleBriefs.director}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
          {projectId && mode !== "create" && !isClient ? (
            <button
              type="button"
              disabled={applying}
              onClick={() => void applyPlan()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply plan to project (add milestones & tasks)"}
            </button>
          ) : mode === "create" ? (
            <p className="text-xs text-emerald-300/90">
              Plan will be included when you create the project — milestones and tasks are added automatically.
            </p>
          ) : null}
        </div>
      ) : null}

      {notesOpen && notes.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent planning notes</p>
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
              <div className="flex flex-wrap justify-between gap-1 text-slate-500">
                <span className="capitalize">{n.source.replace(/_/g, " ")}</span>
                <span>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              {n.aiSummary ? <p className="mt-1 text-slate-300">{n.aiSummary}</p> : null}
              {n.roleBriefs?.developers ? (
                <p className="mt-1 text-slate-500">
                  <span className="text-slate-600">Dev brief: </span>
                  {n.roleBriefs.developers.slice(0, 200)}
                  {n.roleBriefs.developers.length > 200 ? "…" : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
