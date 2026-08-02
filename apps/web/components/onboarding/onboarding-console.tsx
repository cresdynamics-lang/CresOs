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

/** Compact white Fluent surface — matches developer workspace. */
const UI = {
  shell: "bg-white text-[#242424]",
  panel:
    "rounded-md border border-[#E1DFDD] bg-white p-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
  panelInset: "rounded-md border border-[#E1DFDD] bg-[#FAFAFA] p-2.5",
  accent: "text-[#005CAB]",
  chip: "border-[#E1DFDD] bg-white text-[#605E5C] hover:border-[#005CAB]/50 hover:bg-white hover:text-[#005CAB]",
  button: "bg-[#005CAB] text-white hover:bg-[#004A8C]",
  title: "text-[#242424]",
  body: "text-[#605E5C]",
  muted: "text-[#8A8886]",
  userBubble: "ml-4 border border-[#B4CDE8] bg-[#F0F7FC] text-[#242424]",
  assistantBubble: "mr-4 border border-[#E1DFDD] bg-[#FAFAFA] text-[#242424]",
  input: "border-[#D1D1D1] bg-white text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20",
  recentBtn:
    "w-full rounded-md border border-[#E1DFDD] bg-white px-2 py-1.5 text-left text-[11px] text-[#605E5C] hover:border-[#005CAB]/50 hover:text-[#005CAB]",
  error: "text-[#C50F1F]",
  eyebrow: "text-[10px] font-semibold tracking-wide text-[#005CAB]",
  section: "text-[10px] font-semibold tracking-wide text-[#005CAB]"
};

function PlaybookRail({
  boot,
  sessions,
  onAsk
}: {
  boot: Bootstrap | null;
  sessions: SessionRow[];
  onAsk: (message: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {boot ? (
        <div className={`${UI.panel} space-y-2`}>
          <p className={UI.section}>When → go to</p>
          <ul className="space-y-1.5">
            {(boot.liveContacts?.length ? boot.liveContacts : boot.playbook.contactRules).map(
              (rule, idx) => {
                const live = "people" in rule ? (rule as LiveContact) : null;
                return (
                  <li
                    key={live?.when ?? (rule as ContactRule).when + idx}
                    className={UI.panelInset}
                  >
                    <p className="text-[12px] font-medium text-[#242424]">
                      When {live?.when ?? (rule as ContactRule).when}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${UI.accent}`}>
                      → {live?.goTo ?? (rule as ContactRule).goTo}
                    </p>
                    {live?.people?.length ? (
                      <p className={`mt-0.5 text-[10px] ${UI.muted}`}>
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
        <div className={`${UI.panel} space-y-1.5`}>
          <p className={UI.section}>Daily rhythm</p>
          <ul className={`space-y-1 text-[11px] ${UI.body}`}>
            {boot.playbook.dailyRhythm.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <div className={`${UI.panel} space-y-1.5`}>
          <p className={UI.section}>Recent</p>
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" className={UI.recentBtn} onClick={() => onAsk(s.message)}>
                  {s.message.slice(0, 90)}
                  {s.message.length > 90 ? "…" : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Role Playbook console — expectations, contacts, and Q&A. */
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
  const [railOpen, setRailOpen] = useState(false);

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

  useEffect(() => {
    if (!railOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [railOpen]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || streamLoading) return;
      setLoading(true);
      setStreamingLive(true);
      setError(null);
      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setInput("");
      setRailOpen(false);

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
  const hasRail =
    Boolean(boot?.playbook.contactRules?.length) ||
    Boolean(boot?.liveContacts?.length) ||
    Boolean(boot?.playbook.dailyRhythm?.length) ||
    sessions.length > 0;

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${UI.shell}`}>
      {/* Mobile hamburger drawer for guide rail */}
      {railOpen ? (
        <button
          type="button"
          aria-label="Close playbook menu"
          className="fixed inset-0 z-40 bg-[#242424]/35 lg:hidden"
          onClick={() => setRailOpen(false)}
        />
      ) : null}

      {railOpen ? (
        <aside
          className="fixed inset-y-0 right-0 z-50 flex w-[min(18rem,88vw)] max-h-[100dvh] flex-col border-l border-[#E1DFDD] bg-white shadow-xl lg:hidden"
          aria-label="Playbook guide"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E1DFDD] px-3 py-2.5">
            <p className="text-[13px] font-semibold text-[#242424]">Playbook guide</p>
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E1DFDD] text-[#242424] hover:bg-[#F5F5F5]"
              aria-label="Close menu"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <PlaybookRail boot={boot} sessions={sessions} onAsk={(m) => void ask(m)} />
          </div>
        </aside>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className={UI.panel}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={UI.eyebrow}>Cres Dynamics · Playbook</p>
                <h1 className={`mt-0.5 text-lg font-semibold tracking-tight sm:text-xl ${UI.title}`}>
                  {boot ? `${roleLabel} playbook` : "Playbook"}
                </h1>
                <p className={`mt-0.5 text-[12px] leading-snug ${UI.body}`}>
                  Expectations and who to go to — for your role.
                </p>
              </div>
              {hasRail ? (
                <button
                  type="button"
                  onClick={() => setRailOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E1DFDD] bg-white text-[#242424] hover:bg-[#F5F5F5] lg:hidden"
                  aria-label="Open playbook guide"
                  aria-expanded={railOpen}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              ) : null}
            </div>
            {bootError ? <p className={`mt-2 text-[12px] ${UI.error}`}>{bootError}</p> : null}
          </div>

          {boot ? (
            <div className={`${UI.panel} space-y-2`}>
              <p className={UI.section}>What&apos;s expected</p>
              <ul className="space-y-1.5">
                {boot.playbook.expectations.map((e) => (
                  <li key={e} className={`${UI.panelInset} text-[12px] leading-snug text-[#242424]`}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={`${UI.panel} flex min-h-[280px] flex-1 flex-col`}>
            <p className={UI.section}>Ask</p>
            <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`whitespace-pre-wrap rounded-md px-2.5 py-2 text-[12px] leading-relaxed ${
                    m.role === "user" ? UI.userBubble : UI.assistantBubble
                  }`}
                >
                  {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                </div>
              ))}
              {streamingLive ? (
                <div className="mr-4">
                  <AssistantStreamPanel
                    phase={streamPhase}
                    statusMessage={streamStatus}
                    reply={streamReply}
                    loading={streamLoading}
                    accentClass={UI.accent}
                    variant="light"
                  />
                </div>
              ) : null}
            </div>

            {suggested.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggested.slice(0, 5).map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={loading || streamLoading}
                    onClick={() => void ask(q)}
                    className={`rounded-md border px-2 py-1 text-left text-[11px] ${UI.chip} disabled:opacity-50`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
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
                className={`w-full flex-1 resize-y rounded-md border px-2.5 py-1.5 text-[13px] disabled:opacity-60 ${UI.input}`}
              />
              <button
                type="button"
                disabled={loading || streamLoading || !input.trim()}
                onClick={() => void ask(input)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${UI.button} disabled:opacity-50`}
              >
                {loading || streamLoading ? "…" : "Ask"}
              </button>
            </div>
            {error || streamError ? (
              <p className={`mt-1.5 text-[12px] ${UI.error}`}>{error || streamError}</p>
            ) : null}
            <p className={`mt-1 text-[10px] ${UI.muted}`}>⌘/Ctrl + Enter</p>
          </div>
        </div>

        {/* Desktop right rail */}
        <aside className="hidden w-72 shrink-0 flex-col gap-3 lg:flex">
          <PlaybookRail boot={boot} sessions={sessions} onAsk={(m) => void ask(m)} />
        </aside>
      </div>
    </div>
  );
}
