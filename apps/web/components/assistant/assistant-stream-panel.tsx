"use client";

import type { StreamPhase } from "../../hooks/use-assistant-stream";

const PHASE_LABEL: Record<StreamPhase, string> = {
  idle: "",
  queued: "Queued",
  analyzing: "Analyzing",
  ledger: "Reading ledger",
  knowledge: "Knowledge pool",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Error"
};

export function AssistantStreamPanel({
  phase,
  statusMessage,
  reply,
  loading,
  accentClass = "text-emerald-400"
}: {
  phase: StreamPhase;
  statusMessage: string;
  reply: string;
  loading: boolean;
  accentClass?: string;
}) {
  if (phase === "idle" && !reply) return null;

  return (
    <div className="space-y-3">
      {loading || (phase !== "idle" && phase !== "done") ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#0e1319] px-2.5 py-1 font-medium ${accentClass}`}
          >
            {loading ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            ) : null}
            {PHASE_LABEL[phase] || "Working"}
          </span>
          {statusMessage ? <span className="text-slate-500">{statusMessage}</span> : null}
        </div>
      ) : null}

      {reply ? (
        <div className="whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-[#0e1319] px-4 py-3 text-sm leading-relaxed text-slate-200">
          {reply}
          {loading && phase === "writing" ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400 align-middle" />
          ) : null}
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#0e1319]/60 px-4 py-6 text-sm text-slate-500">
          {statusMessage || "Analyzing your request…"}
        </div>
      ) : null}
    </div>
  );
}
