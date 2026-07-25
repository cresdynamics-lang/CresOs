"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { AssistantStreamPanel } from "../assistant/assistant-stream-panel";
import { useAssistantStream } from "../../hooks/use-assistant-stream";

type ContactRule = { id?: string; when: string; goTo: string; roleHint?: string };
type LiveContact = {
  when: string;
  goTo: string;
  people: { id: string; name: string; email: string }[];
};

type Bootstrap = {
  audience: string;
  playbook: {
    title: string;
    summary: string;
    expectations: string[];
    contactRules: ContactRule[];
    suggestedQuestions: string[];
    dailyRhythm: string[];
  };
  liveContacts: LiveContact[];
};

type ChatMessage = { role: "user" | "assistant"; text: string };

type SessionRow = {
  id: string;
  message: string;
  reply: string | null;
  createdAt: string;
};

/** Light blue professional surface — Cres Dynamics Playbook. */
const LIGHT = {
  shell: "bg-[#F4F7F9] text-slate-800",
  panel: "rounded-2xl border border-[#E5E9EF] bg-white p-4 shadow-sm sm:p-6",
  panelInset: "rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] p-3",
  accent: "text-sky-700",
  chip: "border-[#E5E9EF] bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-900",
  button: "bg-sky-600 text-white hover:bg-sky-500 shadow-sm",
  border: "border-[#E5E9EF]",
  title: "text-slate-900",
  body: "text-slate-600",
  muted: "text-slate-500",
  userBubble: "ml-6 border border-[#E5E9EF] bg-sky-50 text-slate-800",
  assistantBubble: "mr-6 border border-[#E5E9EF] bg-[#F4F7F9] text-slate-800",
  input: "border-[#E5E9EF] bg-white text-slate-800 placeholder:text-slate-400",
  recentBtn:
    "w-full rounded-lg border border-[#E5E9EF] bg-white px-2.5 py-2 text-left text-[11px] text-slate-600 hover:border-sky-400 hover:text-sky-900",
  error: "text-rose-600"
};

/** Role Playbook console — direct answers, light professional blue UI. */
export function OnboardingConsole(_props?: { accent?: Record<string, string> }) {
  const { apiFetch } = useAuth();
  const {
    start: startStream,
    phase: streamPhase,
    statusMessage: streamStatus,
    reply: streamReply,
    loading: streamLoading,
    error: streamError
  } = useAssistantStream();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [streamingLive, setStreamingLive] = useState(false);

  const loadBootstrap = useCallback(async () => {
    setBootError(null);
    try {
      const res = await apiFetch("/onboarding/bootstrap");
      const data = (await res.json().catch(() => ({}))) as Bootstrap & { error?: string };
      if (!res.ok) {
        setBootError(data.error ?? "Could not load playbook");
        return;
      }
      setBoot(data);
      setSuggested(data.playbook.suggestedQuestions ?? []);
      setMessages([
        {
          role: "assistant",
          text: data.playbook.summary
        }
      ]);
    } catch {
      setBootError("Could not reach the server");
    }
  }, [apiFetch]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch("/onboarding/sessions?limit=8");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: SessionRow[] };
      setSessions(data.sessions ?? []);
    } catch {
      /* optional */
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadBootstrap();
    void loadSessions();
  }, [loadBootstrap, loadSessions]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || streamLoading) return;
      setLoading(true);
      setStreamingLive(true);
      setError(null);
      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setInput("");

      const out = await startStream("/onboarding/stream", { message: trimmed });
      setLoading(false);
      setStreamingLive(false);

      if (out.error && out.error !== "aborted") {
        setError(out.error);
        setMessages((prev) => [...prev, { role: "assistant", text: out.error ?? "Request failed." }]);
        return;
      }

      const payload = (out.donePayload ?? {}) as {
        reply?: string;
        suggestedQuestions?: string[];
      };
      const reply = out.reply || payload.reply || "…";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      if (payload.suggestedQuestions?.length) setSuggested(payload.suggestedQuestions);
      void loadSessions();
    },
    [loading, streamLoading, startStream, loadSessions]
  );

  const roleLabel = boot?.playbook.title?.replace(/\s*—\s*Cres Dynamics$/i, "") ?? "your role";

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${LIGHT.shell}`}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className={LIGHT.panel}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${LIGHT.accent}`}>
              Cres Dynamics · Playbook
            </p>
            <h1 className={`mt-1 text-xl font-semibold sm:text-2xl ${LIGHT.title}`}>
              {boot ? `${roleLabel} playbook` : "Playbook"}
            </h1>
            <p className={`mt-1 max-w-2xl text-sm ${LIGHT.body}`}>
              Expectations and who to go to — for your role.
            </p>
            {bootError ? <p className={`mt-3 text-sm ${LIGHT.error}`}>{bootError}</p> : null}
          </div>

          {boot ? (
            <div className={`${LIGHT.panel} space-y-3`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${LIGHT.accent}`}>
                What&apos;s expected
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                {boot.playbook.expectations.map((e) => (
                  <li key={e} className={`${LIGHT.panelInset}`}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={`${LIGHT.panel} flex min-h-[320px] flex-1 flex-col`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${LIGHT.accent}`}>Ask</p>
            <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`whitespace-pre-wrap rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? LIGHT.userBubble : LIGHT.assistantBubble
                  }`}
                >
                  {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                </div>
              ))}
              {streamingLive ? (
                <div className="mr-6">
                  <AssistantStreamPanel
                    phase={streamPhase}
                    statusMessage={streamStatus}
                    reply={streamReply}
                    loading={streamLoading}
                    accentClass={LIGHT.accent}
                    variant="light"
                  />
                </div>
              ) : null}
            </div>

            {suggested.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggested.slice(0, 5).map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={loading || streamLoading}
                    onClick={() => void ask(q)}
                    className={`rounded-full border px-3 py-1.5 text-left text-[11px] ${LIGHT.chip} disabled:opacity-50`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || streamLoading}
                placeholder="Ask directly — e.g. Who approves expenses?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void ask(input);
                  }
                }}
                className={`w-full flex-1 resize-y rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${LIGHT.input}`}
              />
              <button
                type="button"
                disabled={loading || streamLoading || !input.trim()}
                onClick={() => void ask(input)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${LIGHT.button} disabled:opacity-50`}
              >
                {loading || streamLoading ? "…" : "Ask"}
              </button>
            </div>
            {error || streamError ? (
              <p className={`mt-2 text-sm ${LIGHT.error}`}>{error || streamError}</p>
            ) : null}
            <p className={`mt-2 text-[11px] ${LIGHT.muted}`}>⌘/Ctrl + Enter</p>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
          {boot ? (
            <div className={`${LIGHT.panel} space-y-3`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${LIGHT.accent}`}>
                When → go to
              </p>
              <ul className="space-y-2">
                {(boot.liveContacts?.length ? boot.liveContacts : boot.playbook.contactRules).map(
                  (rule, idx) => {
                    const live = "people" in rule ? (rule as LiveContact) : null;
                    return (
                      <li
                        key={live?.when ?? (rule as ContactRule).when + idx}
                        className={LIGHT.panelInset}
                      >
                        <p className="text-xs font-medium text-slate-800">
                          When {live?.when ?? (rule as ContactRule).when}
                        </p>
                        <p className="mt-1 text-xs text-sky-800">
                          → {live?.goTo ?? (rule as ContactRule).goTo}
                        </p>
                        {live?.people?.length ? (
                          <p className={`mt-1 text-[11px] ${LIGHT.muted}`}>
                            {live.people.map((p) => p.name).join(", ")}
                          </p>
                        ) : null}
                      </li>
                    );
                  }
                )}
              </ul>
            </div>
          ) : null}

          {boot?.playbook.dailyRhythm?.length ? (
            <div className={`${LIGHT.panel} space-y-2`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${LIGHT.accent}`}>
                Daily rhythm
              </p>
              <ul className={`space-y-1.5 text-xs ${LIGHT.body}`}>
                {boot.playbook.dailyRhythm.map((d) => (
                  <li key={d}>• {d}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sessions.length > 0 ? (
            <div className={`${LIGHT.panel} space-y-2`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${LIGHT.accent}`}>
                Recent
              </p>
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={LIGHT.recentBtn} onClick={() => void ask(s.message)}>
                      {s.message.slice(0, 90)}
                      {s.message.length > 90 ? "…" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
