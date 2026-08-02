"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth-context";
import { adminNeu } from "../../../components/admin/admin-theme";
import { AdminPanel } from "../../../components/admin/admin-ui";
import { AssistantInputPanel } from "../../../components/assistant/assistant-input-panel";
import { ActionChips } from "../../../components/assistant/action-chips";
import { IntelligenceAnswer } from "../../../components/assistant/intelligence-answer";
import {
  EXECUTE_PROMPTS,
  INTELLIGENCE_FOCUS_OPTIONS,
  INTELLIGENCE_PROMPTS,
  type AdminAssistantMode,
  type AdminAssistantResponse,
  type AssistantSessionRow,
  type ExecuteActionsResponse,
  type ExecutedActionResult,
  type IntelligenceFocus,
  type ProposedAction
} from "../../../components/assistant/admin-assistant-types";

type Tab = AdminAssistantMode;

function PromptChips({ prompts, onPick }: { prompts: string[]; onPick: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          className="rounded-lg border border-[#E5E9EF] bg-white px-3 py-1.5 text-left font-body text-[11px] font-semibold text-[#1A1D26] hover:border-[#2D5A5A]/40 hover:bg-[#E8F0F0] hover:text-[#2D5A5A]"
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function AdminAiCommandConsole({
  forceMode,
  embedded = false
}: {
  /** When set, lock to this mode (used by AI Command hub tabs). */
  forceMode?: AdminAssistantMode;
  embedded?: boolean;
} = {}) {
  const { apiFetch, auth } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");
  const [tab, setTab] = useState<Tab>(() => forceMode ?? "intelligence");
  const [focus, setFocus] = useState<IntelligenceFocus>("general");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminAssistantResponse | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutedActionResult[]>([]);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, { assigneeId?: string; projectId?: string }>
  >({});
  const [sessions, setSessions] = useState<AssistantSessionRow[]>([]);

  useEffect(() => {
    if (forceMode) {
      setTab(forceMode);
      setResult(null);
      setError(null);
    }
  }, [forceMode]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/assistant/sessions?limit=8");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: AssistantSessionRow[] };
      setSessions(data.sessions ?? []);
    } catch {
      /* optional */
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const runExecute = useCallback(
    async (actions: ProposedAction[]) => {
      if (actions.length === 0 || !isAdmin) return;
      setExecuting(true);
      setExecuteMessage(null);
      try {
        const res = await apiFetch("/admin/assistant/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions,
            overrides,
            sourceMessage: message.trim() || undefined
          })
        });
        const data = (await res.json().catch(() => ({}))) as ExecuteActionsResponse & { error?: string };
        if (!res.ok) {
          setExecuteMessage(data.error ?? "Execute failed");
          return;
        }
        setExecutionResults((prev) => {
          const map = new Map(prev.map((r) => [r.actionId, r]));
          for (const r of data.results) map.set(r.actionId, r);
          return Array.from(map.values());
        });
        setExecuteMessage(
          data.failed > 0
            ? `${data.succeeded} created, ${data.failed} failed — pick a match or edit hints`
            : `${data.succeeded} action${data.succeeded === 1 ? "" : "s"} created`
        );
        void loadSessions();
      } catch {
        setExecuteMessage("Could not reach the server");
      } finally {
        setExecuting(false);
      }
    },
    [apiFetch, overrides, message, isAdmin, loadSessions]
  );

  const runChat = useCallback(
    async (text: string, mode: Tab) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/admin/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            mode,
            ...(mode === "intelligence" && focus !== "general" ? { focus } : {})
          })
        });
        const data = (await res.json().catch(() => ({}))) as AdminAssistantResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Assistant request failed");
          return;
        }
        setResult(data);
        setExecutionResults([]);
        setExecuteMessage(null);
        setOverrides({});
        void loadSessions();
      } catch {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, focus, loadSessions]
  );

  const runVoice = useCallback(
    async (blob: Blob, mimeType: string) => {
      const mode = forceMode ?? tab;
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        form.append("audio", blob, `admin-command.${ext}`);
        form.append("mode", mode);
        if (mode === "intelligence" && focus !== "general") form.append("focus", focus);
        const res = await apiFetch("/admin/assistant/from-voice", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as AdminAssistantResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Voice request failed");
          return;
        }
        if (data.transcript) setMessage(data.transcript);
        setResult(data);
        setExecutionResults([]);
        setExecuteMessage(null);
        void loadSessions();
      } catch {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, tab, forceMode, focus, loadSessions]
  );

  const runAudioFile = useCallback(
    async (file: File) => {
      const mode = forceMode ?? tab;
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", file, file.name || "admin-audio-entry");
        form.append("mode", mode);
        if (mode === "intelligence" && focus !== "general") form.append("focus", focus);
        const res = await apiFetch("/admin/assistant/from-audio", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as AdminAssistantResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Audio upload failed");
          return;
        }
        if (data.transcript) setMessage(data.transcript);
        setResult(data);
        setExecutionResults([]);
        setExecuteMessage(null);
        void loadSessions();
      } catch {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, tab, forceMode, focus, loadSessions]
  );

  const resolveCandidate = useCallback(
    (action: ProposedAction, field: "assignee" | "project", candidateId: string) => {
      setOverrides((prev) => ({
        ...prev,
        [action.id]: {
          ...prev[action.id],
          ...(field === "assignee" ? { assigneeId: candidateId } : { projectId: candidateId })
        }
      }));
      void runExecute([action]);
    },
    [runExecute]
  );

  const lockedMode = Boolean(forceMode);
  const activeMode = forceMode ?? tab;
  const prompts = activeMode === "execute" ? EXECUTE_PROMPTS : INTELLIGENCE_PROMPTS;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <AdminPanel className="!p-4 sm:!p-5">
          {!embedded ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={adminNeu.eyebrow}>Command · AI</p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#1A1D26]">
                  {activeMode === "execute" ? "AI task creation" : "Admin AI Command"}
                </h1>
                <p className="mt-1.5 max-w-2xl font-body text-sm font-medium leading-relaxed text-[#5B6472]">
                  {activeMode === "execute"
                    ? "Preview and create meetings, schedule tasks, and project tasks from natural language or voice."
                    : "Ask deep org intelligence — projects, people, hours vs days, and Cres Dynamics fit."}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold tracking-tight text-[#1A1D26]">
                {activeMode === "execute" ? "AI tasks & creation" : "Org intelligence"}
              </h2>
              <p className="mt-0.5 max-w-2xl font-body text-sm font-medium text-[#5B6472]">
                {activeMode === "execute"
                  ? "Create meetings and tasks; confirm actions before they land on the schedule."
                  : "Analyze projects, people, delivery hours, and services fit."}
              </p>
            </div>
          )}

          {!lockedMode ? (
            <div className="mt-4 flex flex-wrap gap-2 border-b border-[#E5E9EF] pb-3">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab("execute");
                    setResult(null);
                    setError(null);
                  }}
                  className={activeMode === "execute" ? adminNeu.segActive : adminNeu.segIdle}
                >
                  Execute
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setTab("intelligence");
                  setResult(null);
                  setError(null);
                }}
                className={activeMode === "intelligence" ? adminNeu.segActive : adminNeu.segIdle}
              >
                Intelligence
              </button>
            </div>
          ) : null}

          {activeMode === "intelligence" ? (
            <div className={`${lockedMode || embedded ? "mt-3" : "mt-3"} flex flex-wrap gap-1.5`}>
              {INTELLIGENCE_FOCUS_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFocus(f.id)}
                  className={
                    focus === f.id
                      ? "rounded-lg border border-[#2D5A5A] bg-[#2D5A5A] px-2.5 py-1 font-label text-[10px] font-bold text-white"
                      : "rounded-lg border border-[#E5E9EF] bg-white px-2.5 py-1 font-label text-[10px] font-bold text-[#5B6472] hover:bg-[#F4F7F9] hover:text-[#2D5A5A]"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <PromptChips prompts={prompts} onPick={setMessage} />
          </div>

          <div className="mt-4">
            <AssistantInputPanel
              value={message}
              onChange={setMessage}
              onSubmit={() => void runChat(message, activeMode)}
              onVoiceResult={(blob, mime) => void runVoice(blob, mime)}
              onAudioFile={(file) => void runAudioFile(file)}
              loading={loading}
              placeholder={
                activeMode === "execute"
                  ? "e.g. Meet Paul Tuesday 3pm, assign Wilson 4h on ERP scope…"
                  : "e.g. Summarize all projects, how is Wilson doing, convert report days to hours…"
              }
              submitLabel={activeMode === "execute" ? "Preview actions" : "Analyze"}
            />
          </div>

          {error ? (
            <p className={`${adminNeu.alertDanger} mt-3 px-3 py-2 font-body text-sm font-semibold text-[#C62828]`}>
              {error}
            </p>
          ) : null}
        </AdminPanel>

        {result ? (
          <AdminPanel className="!p-4 sm:!p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={adminNeu.badgeAccent}>{result.aiGenerated ? "AI response" : "Fallback"}</span>
              {result.transcript ? (
                <span className="font-body text-[11px] font-medium text-[#5B6472]">
                  Transcript: {result.transcript.slice(0, 120)}…
                </span>
              ) : null}
            </div>

            {activeMode === "execute" ? (
              <div className="space-y-4">
                <p className="whitespace-pre-wrap font-body text-sm font-medium leading-relaxed text-[#1A1D26]">
                  {result.reply}
                </p>
                {executeMessage ? (
                  <div className="space-y-2">
                    <p
                      className={`font-body text-sm font-semibold ${
                        executeMessage.includes("failed") ? "text-[#9A6B12]" : "text-[#2E7D4F]"
                      }`}
                    >
                      {executeMessage}
                    </p>
                    {executeMessage.includes("created") && !executeMessage.includes("failed") ? (
                      <Link
                        href="/schedule?period=week"
                        className="inline-block font-label text-xs font-bold text-[#2D5A5A] hover:underline"
                      >
                        View on Schedule (Today / This week) →
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                <ActionChips
                  actions={result.proposedActions ?? []}
                  executing={executing}
                  executionResults={executionResults}
                  onExecuteAll={() => void runExecute(result.proposedActions ?? [])}
                  onExecuteOne={(a) => void runExecute([a])}
                  onResolveCandidate={resolveCandidate}
                />
              </div>
            ) : (
              <IntelligenceAnswer result={result} />
            )}
          </AdminPanel>
        ) : null}
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <AdminPanel className="!p-4">
          <p className={adminNeu.eyebrow}>Recent sessions</p>
          <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {sessions.length === 0 ? (
              <li className="font-body text-xs font-medium text-[#5B6472]">No sessions yet</li>
            ) : (
              sessions.map((s) => (
                <li key={s.id} className={`${adminNeu.listRow} px-2.5 py-2`}>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.08em] text-[#5B6472]">
                    {s.mode}
                    {s.focus ? ` · ${s.focus}` : ""}
                  </p>
                  <p className="mt-0.5 line-clamp-2 font-body text-xs font-semibold text-[#1A1D26]">{s.message}</p>
                  <p className="mt-1 font-body text-[10px] font-medium text-[#8B93A1]">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </AdminPanel>
      </aside>
    </div>
  );
}
