"use client";

import { useCallback, useState } from "react";
import { useAuth } from "../../auth-context";
import { adminNeu } from "../../../components/admin/admin-theme";
import { AdminPanel } from "../../../components/admin/admin-ui";
import { AssistantInputPanel } from "../../../components/assistant/assistant-input-panel";
import { ActionChips } from "../../../components/assistant/action-chips";
import {
  EXECUTE_PROMPTS,
  INTELLIGENCE_PROMPTS,
  type AdminAssistantMode,
  type AdminAssistantResponse
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

function IntelligenceAnswer({ result }: { result: AdminAssistantResponse }) {
  return (
    <div className="space-y-4">
      <div className={`${adminNeu.panelInset} whitespace-pre-wrap text-sm leading-relaxed text-slate-200`}>
        {result.reply}
      </div>
      {result.projectBriefs && result.projectBriefs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Projects</p>
          <ul className="space-y-2">
            {result.projectBriefs.map((p) => (
              <li key={p.projectId || p.projectName} className={`${adminNeu.listRow} px-3 py-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-100">{p.projectName}</span>
                  <span className="text-[10px] uppercase text-slate-500">
                    {p.riskLevel} · {p.healthScore}/100
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.personInsights && result.personInsights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">People</p>
          <ul className="space-y-2">
            {result.personInsights.map((p) => (
              <li key={p.personHint} className={`${adminNeu.listRow} px-3 py-3`}>
                <p className="text-sm font-medium text-slate-100">{p.personHint}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AdminAiCommandConsole() {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<Tab>("intelligence");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminAssistantResponse | null>(null);

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
          body: JSON.stringify({ message: trimmed, mode })
        });
        const data = (await res.json().catch(() => ({}))) as AdminAssistantResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Assistant request failed");
          return;
        }
        setResult(data);
      } catch {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
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
        const res = await apiFetch("/admin/assistant/from-voice", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as AdminAssistantResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Voice request failed");
          return;
        }
        if (data.transcript) setMessage(data.transcript);
        setResult(data);
      } catch {
        setError("Could not reach the server");
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, tab]
  );

  const prompts = tab === "execute" ? EXECUTE_PROMPTS : INTELLIGENCE_PROMPTS;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <AdminPanel>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">Command · AI</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">Admin AI Command</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Speak or type to preview tasks and meetings, or ask for org intelligence using the knowledge pool and Cres
          Dynamics context.
        </p>

        <div className="mt-4 flex gap-2 border-b border-white/[0.06] pb-3">
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

        <div className="mt-4">
          <PromptChips
            prompts={prompts}
            onPick={(p) => {
              setMessage(p);
            }}
          />
        </div>

        <div className="mt-4">
          <AssistantInputPanel
            value={message}
            onChange={setMessage}
            onSubmit={() => void runChat(message, tab)}
            onVoiceResult={(blob, mime) => void runVoice(blob, mime)}
            loading={loading}
            placeholder={
              tab === "execute"
                ? "e.g. Meet Paul Tuesday 3pm, assign Wilson 4h on ERP scope…"
                : "e.g. Summarize all projects, how many days has Wilson worked, hours vs days on reports…"
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
              <ActionChips actions={result.proposedActions ?? []} />
            </div>
          ) : (
            <IntelligenceAnswer result={result} />
          )}
        </AdminPanel>
      ) : null}
    </div>
  );
}
