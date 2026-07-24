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

type Accent = {
  panel: string;
  panelInset: string;
  accent: string;
  chip: string;
  button: string;
  border: string;
};

const DEFAULT_ACCENT: Accent = {
  panel: "rounded-2xl border border-white/[0.08] bg-[#121820] p-4 sm:p-6",
  panelInset: "rounded-xl border border-white/[0.06] bg-[#0e1319] p-3",
  accent: "text-indigo-400",
  chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-indigo-500/40 hover:text-slate-100",
  button: "bg-gradient-to-br from-indigo-600 to-violet-700 text-white",
  border: "border-white/[0.08]"
};

export function OnboardingConsole({ accent = DEFAULT_ACCENT }: { accent?: Partial<Accent> }) {
  const theme: Accent = { ...DEFAULT_ACCENT, ...accent };
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
        setBootError(data.error ?? "Could not load onboarding");
        return;
      }
      setBoot(data);
      setSuggested(data.playbook.suggestedQuestions ?? []);
      setMessages([
        {
          role: "assistant",
          text:
            `Welcome to **${data.playbook.title}**.\n\n` +
            `${data.playbook.summary}\n\n` +
            `Ask me anything about what's expected of you, or who to go to when something happens. No meeting required — this is your self-serve onboarding.`
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className={theme.panel}>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${theme.accent}`}>
            Onboarding · Role AI
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">
            {boot?.playbook.title ?? "Role onboarding"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Ask how Cres Dynamics runs for your role. Answers use your role playbook plus the live
            knowledge pool — scoped so you only see what your role is allowed to see.
          </p>
          {bootError ? <p className="mt-3 text-sm text-rose-300">{bootError}</p> : null}
        </div>

        {boot ? (
          <div className={`${theme.panel} space-y-3`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.accent}`}>
              What&apos;s expected of you
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {boot.playbook.expectations.map((e) => (
                <li key={e} className={`${theme.panelInset} text-slate-300`}>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={`${theme.panel} flex min-h-[320px] flex-1 flex-col`}>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.accent}`}>
            Onboarding chat
          </p>
          <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`whitespace-pre-wrap rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-6 border border-indigo-500/20 bg-indigo-500/10 text-slate-100"
                    : `mr-6 ${theme.panelInset} text-slate-200`
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
                  accentClass={theme.accent}
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
                  className={`rounded-full border px-3 py-1.5 text-left text-[11px] ${theme.chip} disabled:opacity-50`}
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
              placeholder="Ask: what’s expected of me? Who do I go to when…?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              className={`w-full flex-1 resize-y rounded-xl border ${theme.border} bg-[#0e1319] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-60`}
            />
            <button
              type="button"
              disabled={loading || streamLoading || !input.trim()}
              onClick={() => void ask(input)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${theme.button} disabled:opacity-50`}
            >
              {loading || streamLoading ? "Thinking…" : "Ask"}
            </button>
          </div>
          {error || streamError ? (
            <p className="mt-2 text-sm text-rose-300">{error || streamError}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">⌘/Ctrl + Enter to send</p>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
        {boot ? (
          <div className={`${theme.panel} space-y-3`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.accent}`}>
              When this happens → go to
            </p>
            <ul className="space-y-2">
              {(boot.liveContacts?.length ? boot.liveContacts : boot.playbook.contactRules).map(
                (rule, idx) => {
                  const live = "people" in rule ? (rule as LiveContact) : null;
                  return (
                    <li key={live?.when ?? (rule as ContactRule).when + idx} className={theme.panelInset}>
                      <p className="text-xs font-medium text-slate-200">
                        When {live?.when ?? (rule as ContactRule).when}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        → {live?.goTo ?? (rule as ContactRule).goTo}
                      </p>
                      {live?.people?.length ? (
                        <p className="mt-1 text-[11px] text-slate-500">
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
          <div className={`${theme.panel} space-y-2`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.accent}`}>
              Daily rhythm
            </p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {boot.playbook.dailyRhythm.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {sessions.length > 0 ? (
          <div className={`${theme.panel} space-y-2`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.accent}`}>
              Recent asks
            </p>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-white/[0.06] bg-[#0e1319] px-2.5 py-2 text-left text-[11px] text-slate-400 hover:text-slate-200"
                    onClick={() => void ask(s.message)}
                  >
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
  );
}
