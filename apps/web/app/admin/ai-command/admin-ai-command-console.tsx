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
          className="rounded-full border border-white/[0.06] bg-[#0e1319] px-3 py-1.5 text-left text-[11px] text-slate-400 hover:border-indigo-500/30 hover:text-slate-200"
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function AdminAiCommandConsole() {
  const { apiFetch, auth } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");
  const [tab, setTab] = useState<Tab>("intelligence");
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
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        form.append("audio", blob, `admin-command.${ext}`);
        form.append("mode", tab);
        if (tab === "intelligence" && focus !== "general") form.append("focus", focus);
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
    [apiFetch, tab, focus, loadSessions]
  );

  const runAudioFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", file, file.name || "admin-audio-entry");
        form.append("mode", tab);
        if (tab === "intelligence" && focus !== "general") form.append("focus", focus);
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
    [apiFetch, tab, focus, loadSessions]
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

  const prompts = tab === "execute" ? EXECUTE_PROMPTS : INTELLIGENCE_PROMPTS;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row sm:p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <AdminPanel>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">Command · AI</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">Admin AI Command</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Create meetings and tasks, or ask deep org intelligence — projects, people, hours vs days, and Cres Dynamics
            fit.
          </p>

          <div className="mt-4 flex gap-2 border-b border-white/[0.06] pb-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setTab("execute");
                  setResult(null);
                  setError(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  tab === "execute" ? adminNeu.navActive : adminNeu.navIdle
                }`}
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
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                tab === "intelligence" ? adminNeu.navActive : adminNeu.navIdle
              }`}
            >
              Intelligence
            </button>
          </div>

          {tab === "intelligence" ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {INTELLIGENCE_FOCUS_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFocus(f.id)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    focus === f.id
                      ? "bg-indigo-500/25 text-indigo-100"
                      : "border border-white/[0.06] text-slate-500"
                  }`}
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
              onSubmit={() => void runChat(message, tab)}
              onVoiceResult={(blob, mime) => void runVoice(blob, mime)}
              onAudioFile={(file) => void runAudioFile(file)}
              loading={loading}
              placeholder={
                tab === "execute"
                  ? "e.g. Meet Paul Tuesday 3pm, assign Wilson 4h on ERP scope…"
                  : "e.g. Summarize all projects, how is Wilson doing, convert report days to hours…"
              }
              submitLabel={tab === "execute" ? "Preview actions" : "Analyze"}
            />
          </div>

          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </AdminPanel>

        {result ? (
          <AdminPanel>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {result.aiGenerated ? "AI response" : "Fallback"}
              </span>
              {result.transcript ? (
                <span className="text-[11px] text-slate-500">Transcript: {result.transcript.slice(0, 120)}…</span>
              ) : null}
            </div>

            {tab === "execute" ? (
              <div className="space-y-4">
                <p className="whitespace-pre-wrap text-sm text-slate-300">{result.reply}</p>
                {executeMessage ? (
                  <div className="space-y-2">
                    <p
                      className={`text-sm ${executeMessage.includes("failed") ? "text-amber-300" : "text-emerald-300"}`}
                    >
                      {executeMessage}
                    </p>
                    {executeMessage.includes("created") && !executeMessage.includes("failed") ? (
                      <Link
                        href="/schedule?period=week"
                        className="inline-block text-xs font-medium text-indigo-300 hover:text-indigo-200"
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
        <AdminPanel>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recent sessions</p>
          <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {sessions.length === 0 ? (
              <li className="text-xs text-slate-500">No sessions yet</li>
            ) : (
              sessions.map((s) => (
                <li key={s.id} className={`${adminNeu.listRow} px-2 py-2`}>
                  <p className="text-[10px] uppercase text-slate-500">
                    {s.mode}
                    {s.focus ? ` · ${s.focus}` : ""}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">{s.message}</p>
                  <p className="mt-1 text-[10px] text-slate-600">
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
