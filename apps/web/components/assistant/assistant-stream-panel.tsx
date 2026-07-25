"use client";

import type { StreamPhase } from "../../hooks/use-assistant-stream";

const PHASE_LABEL: Record<StreamPhase, string> = {
  idle: "",
  queued: "Queued",
  analyzing: "Analyzing",
  ledger: "Ledger",
  knowledge: "Knowledge",
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
  accentClass = "text-emerald-400",
  variant = "dark"
}: {
  phase: StreamPhase;
  statusMessage: string;
  reply: string;
  loading: boolean;
  accentClass?: string;
  variant?: "dark" | "light";
}) {
  if (phase === "idle" && !reply) return null;

  const light = variant === "light";
  const chipBg = light
    ? "border-[#E5E9EF] bg-white"
    : "border-white/[0.08] bg-[#0e1319]";
  const statusMuted = light ? "text-slate-500" : "text-slate-500";
  const replyBox = light
    ? "border-[#E5E9EF] bg-[#F4F7F9] text-slate-800"
    : "border-white/[0.06] bg-[#0e1319] text-slate-200";
  const pendingBox = light
    ? "border-[#E5E9EF] bg-sky-50/80 text-slate-500"
    : "border-white/[0.08] bg-[#0e1319]/60 text-slate-500";
  const caret = light ? "bg-sky-600" : "bg-slate-400";

  return (
    <div className="space-y-3">
      {loading || (phase !== "idle" && phase !== "done") ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${chipBg} ${accentClass}`}
          >
            {loading ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            ) : null}
            {PHASE_LABEL[phase] || "Working"}
          </span>
          {statusMessage ? <span className={statusMuted}>{statusMessage}</span> : null}
        </div>
      ) : null}

      {reply ? (
        <div className={`whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-relaxed ${replyBox}`}>
          {reply}
          {loading && phase === "writing" ? (
            <span className={`ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle ${caret}`} />
          ) : null}
        </div>
      ) : loading ? (
        <div className={`rounded-xl border border-dashed px-4 py-6 text-sm ${pendingBox}`}>
          {statusMessage || "Analyzing…"}
        </div>
      ) : null}
    </div>
  );
}
