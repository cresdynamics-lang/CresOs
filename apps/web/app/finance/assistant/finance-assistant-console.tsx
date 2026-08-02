"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth-context";
import { financeNeu } from "../../../components/finance/finance-theme";
import { AssistantInputPanel } from "../../../components/assistant/assistant-input-panel";
import { AssistantStreamPanel } from "../../../components/assistant/assistant-stream-panel";
import { FinanceActionChips } from "../../../components/assistant/finance-action-chips";
import { useAssistantStream } from "../../../hooks/use-assistant-stream";
import {
  FINANCE_EXECUTE_PROMPTS,
  FINANCE_INTELLIGENCE_PROMPTS,
  type FinanceAssistantResponse,
  type FinanceAssistantSessionRow,
  type FinanceExecuteResponse,
  type FinanceExecutedAction,
  type FinanceProposedAction
} from "../../../components/assistant/finance-assistant-types";

type Tab = "execute" | "intelligence";

export function FinanceAssistantConsole() {
  const { apiFetch } = useAuth();
  const {
    start: startStream,
    reset: resetStream,
    phase: streamPhase,
    statusMessage: streamStatus,
    reply: streamReply,
    loading: streamLoading,
    error: streamError
  } = useAssistantStream();
  const [tab, setTab] = useState<Tab>("execute");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinanceAssistantResponse | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<FinanceExecutedAction[]>([]);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<FinanceAssistantSessionRow[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch("/finance/assistant/sessions?limit=8");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: FinanceAssistantSessionRow[] };
      setSessions(data.sessions ?? []);
    } catch {
      /* optional */
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const runChat = useCallback(
    async (text: string, mode: Tab) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      setResult(null);
      setExecutionResults([]);
      setExecuteMessage(null);
      setLoading(true);

      const out = await startStream("/finance/assistant/stream", { message: trimmed, mode });
      setLoading(false);

      if (out.error && out.error !== "aborted") {
        setError(out.error);
        return;
      }
      if (!out.reply && !out.donePayload) return;

      const payload = (out.donePayload ?? {}) as Partial<FinanceAssistantResponse>;
      const reply = out.reply || payload.reply || "";
      setResult({
        mode,
        reply,
        aiGenerated: payload.aiGenerated ?? true,
        proposedActions: (payload.proposedActions as FinanceProposedAction[]) ?? [],
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined
      });
      void loadSessions();
    },
    [startStream, loadSessions]
  );

  const runVoice = useCallback(
    async (blob: Blob, mimeType: string) => {
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        form.append("audio", blob, `finance-command.${ext}`);
        form.append("mode", tab);
        const res = await apiFetch("/finance/assistant/from-voice", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as FinanceAssistantResponse & { error?: string };
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
    [apiFetch, tab, loadSessions]
  );

  const runAudioFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("audio", file, file.name || "finance-audio-entry");
        form.append("mode", tab);
        const res = await apiFetch("/finance/assistant/from-audio", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as FinanceAssistantResponse & { error?: string };
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
    [apiFetch, tab, loadSessions]
  );

  const runExecute = useCallback(
    async (actions: FinanceProposedAction[]) => {
      if (actions.length === 0) return;
      setExecuting(true);
      setExecuteMessage(null);
      try {
        const res = await apiFetch("/finance/assistant/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions })
        });
        const data = (await res.json().catch(() => ({}))) as FinanceExecuteResponse & { error?: string };
        if (!res.ok) {
          setExecuteMessage(data.error ?? "Record failed");
          return;
        }
        setExecutionResults((prev) => {
          const map = new Map(prev.map((r) => [r.actionId, r]));
          for (const r of data.results) map.set(r.actionId, r);
          return Array.from(map.values());
        });
        setExecuteMessage(
          data.failed > 0
            ? `${data.succeeded} recorded, ${data.failed} failed`
            : `${data.succeeded} item${data.succeeded === 1 ? "" : "s"} recorded`
        );
        void loadSessions();
      } catch {
        setExecuteMessage("Could not reach the server");
      } finally {
        setExecuting(false);
      }
    },
    [apiFetch, loadSessions]
  );

  const prompts = tab === "execute" ? FINANCE_EXECUTE_PROMPTS : FINANCE_INTELLIGENCE_PROMPTS;
  const busy = loading || streamLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <div className={`${financeNeu.panel} p-4 sm:p-6`}>
          <p className={financeNeu.eyebrow}>Finance · AI</p>
          <h1 className={`mt-1 ${financeNeu.titleSm}`}>Finance AI Assistant</h1>
          <p className={`mt-1 max-w-2xl ${financeNeu.body}`}>
            Ask streams live from the ledger + knowledge pool. Record mode previews expenses/payments for confirmation.
          </p>

          <div className="mt-4 flex gap-2 border-b border-[#E5E9EF] pb-3">
            <button
              type="button"
              onClick={() => {
                setTab("execute");
                setResult(null);
                setError(null);
                resetStream();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                tab === "execute" ? financeNeu.navActive : financeNeu.navIdle
              }`}
            >
              Record
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("intelligence");
                setResult(null);
                setError(null);
                resetStream();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                tab === "intelligence" ? financeNeu.navActive : financeNeu.navIdle
              }`}
            >
              Ask
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMessage(p)}
                className="rounded-full border border-[#E5E9EF] bg-white px-3 py-1.5 text-left text-[11px] text-[#5B6472] hover:border-emerald-500/30 hover:text-[#1A1D26]"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <AssistantInputPanel
              value={message}
              onChange={setMessage}
              onSubmit={() => void runChat(message, tab)}
              onVoiceResult={(blob, mime) => void runVoice(blob, mime)}
              onAudioFile={(file) => void runAudioFile(file)}
              loading={busy}
              placeholder={
                tab === "execute"
                  ? "e.g. Paid Wilson 8000 transport yesterday, client sent 50k M-Pesa for invoice 12…"
                  : "e.g. How much did we spend on salaries this month?"
              }
              submitLabel={tab === "execute" ? "Preview" : "Ask"}
            />
          </div>

          {(busy || streamReply) && !result ? (
            <div className="mt-4">
              <AssistantStreamPanel
                phase={streamPhase}
                statusMessage={streamStatus}
                reply={streamReply}
                loading={streamLoading}
                accentClass="text-[#1B6B3A]"
              />
            </div>
          ) : null}

          {error || streamError ? (
            <p className="mt-3 text-sm text-[#C62828]">{error || streamError}</p>
          ) : null}
        </div>

        {result ? (
          <div className={`${financeNeu.panel} p-4 sm:p-6`}>
            {tab === "execute" ? (
              <div className="space-y-4">
                <AssistantStreamPanel
                  phase={streamPhase === "idle" ? "done" : streamPhase}
                  statusMessage={streamStatus}
                  reply={result.reply}
                  loading={false}
                  accentClass="text-[#1B6B3A]"
                />
                {executeMessage ? (
                  <div className="space-y-2">
                    <p className="text-sm text-[#1B6B3A]">{executeMessage}</p>
                    {executeMessage.includes("recorded") ? (
                      <div className="flex flex-wrap gap-3 text-xs font-medium">
                        <Link href="/finance/ledger" className="text-[#1B6B3A] hover:text-[#1B6B3A]">
                          All transactions →
                        </Link>
                        <Link href="/finance/projects" className="text-[#1B6B3A] hover:text-[#1B6B3A]">
                          Project balances →
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <FinanceActionChips
                  actions={result.proposedActions ?? []}
                  executing={executing}
                  executionResults={executionResults}
                  onExecuteAll={() => void runExecute(result.proposedActions ?? [])}
                  onExecuteOne={(a) => void runExecute([a])}
                />
              </div>
            ) : (
              <AssistantStreamPanel
                phase={streamPhase === "idle" ? "done" : streamPhase}
                statusMessage={streamStatus}
                reply={result.reply}
                loading={false}
                accentClass="text-[#1B6B3A]"
              />
            )}
          </div>
        ) : null}
      </div>

      {sessions.length > 0 ? (
        <aside className={`${financeNeu.panel} w-full shrink-0 p-4 lg:w-72`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]">Recent sessions</p>
          <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.id} className={`${financeNeu.panelInset} rounded-lg px-3 py-2 text-xs`}>
                <p className="font-medium text-[#5B6472]">{s.mode}</p>
                <p className="mt-1 line-clamp-2 text-[#5B6472]">{s.message}</p>
                <p className="mt-1 text-[10px] text-[#5B6472]">
                  {new Date(s.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short"
                  })}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
