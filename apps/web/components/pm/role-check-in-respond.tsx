"use client";

import { useMemo, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { checkInGlass } from "./check-in-glass-theme";
import { CheckInReplySlide } from "./check-in-reply-slide";

export type CheckInQuestion = {
  id: string;
  text: string;
  placeholder?: string;
};

export type RoleCheckInMetadata = {
  roleCheckIn?: boolean;
  pmCheckIn?: boolean;
  senderRole?: "project_manager" | "director_admin";
  checkInId?: string;
  intro?: string;
  questions?: CheckInQuestion[];
  projectName?: string;
};

const ROLE_LABELS: Record<string, { label: string; accent: string }> = {
  project_manager: { label: "Project Manager", accent: "text-teal-300" },
  director_admin: { label: "Director", accent: "text-sky-300" }
};

export function parseRoleCheckInMetadata(
  metadata?: Record<string, unknown> | null
): RoleCheckInMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  if (!metadata.roleCheckIn && !metadata.pmCheckIn) return null;
  const questions = Array.isArray(metadata.questions)
    ? (metadata.questions as CheckInQuestion[]).filter((q) => q?.id && q?.text)
    : [];
  return {
    roleCheckIn: Boolean(metadata.roleCheckIn ?? metadata.pmCheckIn),
    pmCheckIn: Boolean(metadata.pmCheckIn),
    senderRole: (metadata.senderRole as RoleCheckInMetadata["senderRole"]) ?? "project_manager",
    checkInId: typeof metadata.checkInId === "string" ? metadata.checkInId : undefined,
    intro: typeof metadata.intro === "string" ? metadata.intro : undefined,
    questions,
    projectName: typeof metadata.projectName === "string" ? metadata.projectName : undefined
  };
}

export function isRoleCheckInMessage(metadata?: Record<string, unknown> | null): boolean {
  return parseRoleCheckInMetadata(metadata) !== null;
}

type RoleCheckInRespondProps = {
  metadata?: Record<string, unknown> | null;
  messageId?: string;
  projectId?: string;
  onResponded?: () => void;
  /** Inline form vs slide-up panel (default slide for Community). */
  variant?: "slide" | "inline";
};

export function RoleCheckInRespond({
  metadata,
  messageId,
  projectId,
  onResponded,
  variant = "slide"
}: RoleCheckInRespondProps) {
  const { apiFetch, auth } = useAuth();
  const parsed = useMemo(() => parseRoleCheckInMetadata(metadata), [metadata]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  if (!auth.roleKeys.includes("developer") || !parsed) return null;
  if (done) {
    return (
      <p className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300 backdrop-blur-md">
        Thanks — your answers are in the thread. Keep the conversation going below.
      </p>
    );
  }

  const roleStyle = ROLE_LABELS[parsed.senderRole ?? "project_manager"] ?? ROLE_LABELS.project_manager;
  const questions =
    parsed.questions && parsed.questions.length > 0
      ? parsed.questions
      : [
          {
            id: "legacy",
            text: "Your update for this check-in:",
            placeholder: "Share progress and blockers…"
          }
        ];

  const submit = async () => {
    const payload: Record<string, string> = {};
    for (const q of questions) {
      const val = (answers[q.id] ?? "").trim();
      if (!val) {
        setError("Please answer every question.");
        return;
      }
      payload[q.id] = val;
    }
    setSending(true);
    setError(null);
    try {
      let checkInId = parsed.checkInId;
      if (!checkInId) {
        const inboxRes = await apiFetch("/pm/check-ins/inbox");
        if (!inboxRes.ok) throw new Error("Could not load check-ins");
        const rows = (await inboxRes.json()) as {
          id: string;
          messageId?: string | null;
          project?: { id: string };
          status: string;
        }[];
        const match =
          rows.find((r) => r.messageId === messageId && r.status === "pending") ??
          rows.find((r) => r.project?.id === projectId && r.status === "pending");
        if (!match) throw new Error("No pending check-in for this message");
        checkInId = match.id;
      }
      const res = await apiFetch(`/pm/check-ins/${checkInId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Reply failed");
      }
      setDone(true);
      setSlideOpen(false);
      onResponded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  };

  const form = (
    <div className={variant === "slide" ? "" : checkInGlass.panel}>
      {parsed.intro ? (
        <p className="mb-4 text-sm leading-relaxed text-slate-300">{parsed.intro}</p>
      ) : null}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <label key={q.id} className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Question {idx + 1}
            </span>
            <p className="mt-1 text-sm font-medium text-slate-100">{q.text}</p>
            <textarea
              className={`${checkInGlass.field} mt-2 min-h-[4.5rem]`}
              rows={3}
              placeholder={q.placeholder ?? "Type your answer…"}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={sending} className={checkInGlass.btnPrimary} onClick={() => void submit()}>
          {sending ? "Sending…" : "Send to thread"}
        </button>
        {variant === "slide" ? (
          <button type="button" className={checkInGlass.btnGhost} onClick={() => setSlideOpen(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="mt-3">
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${roleStyle.accent}`}>
          {roleStyle.label} check-in
        </p>
        {form}
      </div>
    );
  }

  return (
    <>
      <div className={`mt-3 rounded-xl border border-teal-500/20 bg-teal-950/15 px-3 py-2.5 backdrop-blur-md`}>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${roleStyle.accent}`}>
          {roleStyle.label} check-in
        </p>
        <p className="mt-1 text-xs text-slate-400">Answer in the thread — the conversation stays in Community.</p>
        <button
          type="button"
          className={`${checkInGlass.btnPrimary} mt-3 self-start`}
          onClick={() => setSlideOpen(true)}
        >
          Slide up to reply
        </button>
      </div>
      <CheckInReplySlide
        open={slideOpen}
        title={`Reply to ${roleStyle.label}`}
        subtitle={parsed.projectName ? `${parsed.projectName} · check-in` : "Structured check-in answers"}
        onClose={() => setSlideOpen(false)}
      >
        {form}
      </CheckInReplySlide>
    </>
  );
}

export const PmCheckInRespond = RoleCheckInRespond;
export const isPmCheckInMessage = isRoleCheckInMessage;
