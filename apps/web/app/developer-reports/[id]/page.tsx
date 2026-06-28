"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { devNeu } from "../../../components/developer/developer-theme";
import { devGlass } from "../../../components/developer/developer-glass-theme";
import { formatNairobiDate, formatNairobiDateTime } from "../../../lib/nairobi-datetime";
import { isDeveloperOnly } from "../../../lib/resolve-workspace-for-user";

type Comment = {
  id: string;
  kind: string;
  content: string;
  createdAt: string;
  authorId: string;
  author: { id: string; name: string | null; email: string };
  parentId: string | null;
  source?: string | null;
  replies?: Comment[];
};

type DeveloperReport = {
  id: string;
  reportDate: string;
  whatWorked: string | null;
  blockers: string | null;
  needsAttention: string | null;
  implemented: string | null;
  pending: string | null;
  nextPlan: string | null;
  reviewStatus?: string;
  remarks?: string | null;
  createdAt: string;
  submittedBy: { id: string; name: string | null; email: string };
  comments: Comment[];
};

const FIELDS = [
  { key: "whatWorked", label: "What worked" },
  { key: "blockers", label: "Blockers" },
  { key: "needsAttention", label: "What needs attention" },
  { key: "implemented", label: "What's been implemented" },
  { key: "pending", label: "What's pending" },
  { key: "nextPlan", label: "Next plan / planned for next day" }
] as const;

function normalizeReport(
  next: Partial<DeveloperReport> | null | undefined,
  prev?: DeveloperReport | null
): DeveloperReport | null {
  if (!next && !prev) return null;
  const submittedBy =
    next?.submittedBy ??
    prev?.submittedBy ?? {
      id: "",
      name: null,
      email: ""
    };
  const commentsInput = Array.isArray(next?.comments)
    ? next?.comments
    : Array.isArray(prev?.comments)
      ? prev?.comments
      : [];
  const comments: Comment[] = commentsInput.map((c) => ({
    id: c?.id ?? "",
    kind: c?.kind ?? "comment",
    content: c?.content ?? "",
    createdAt: c?.createdAt ?? new Date(0).toISOString(),
    authorId: c?.authorId ?? "",
    author: c?.author ?? { id: "", name: null, email: "" },
    parentId: c?.parentId ?? null,
    source: c?.source ?? null,
    replies: Array.isArray(c?.replies) ? c.replies : []
  }));
  const base = next ?? prev!;
  return {
    id: base.id ?? prev?.id ?? "",
    reportDate: base.reportDate ?? prev?.reportDate ?? "",
    whatWorked: base.whatWorked ?? prev?.whatWorked ?? null,
    blockers: base.blockers ?? prev?.blockers ?? null,
    needsAttention: base.needsAttention ?? prev?.needsAttention ?? null,
    implemented: base.implemented ?? prev?.implemented ?? null,
    pending: base.pending ?? prev?.pending ?? null,
    nextPlan: base.nextPlan ?? prev?.nextPlan ?? null,
    reviewStatus: base.reviewStatus ?? prev?.reviewStatus,
    remarks: base.remarks ?? prev?.remarks ?? null,
    createdAt: base.createdAt ?? prev?.createdAt ?? "",
    submittedBy,
    comments
  };
}

const MARKED_REVIEWED = "Marked reviewed. ✓";

function hasLeadershipReply(comments: Comment[]): boolean {
  return comments.some(
    (c) =>
      !c.parentId &&
      (c.source === "ai_auto" || (c.kind === "comment" && c.content.includes(MARKED_REVIEWED)))
  );
}

function pendingQuestionCount(comments: Comment[]): number {
  return comments.filter((c) => !c.parentId && c.kind === "question").filter((q) => {
    const replies = comments.filter((r) => r.parentId === q.id);
    return replies.length === 0;
  }).length;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isOverdue(askedAt: string): boolean {
  const deadline = new Date(askedAt).getTime() + TWENTY_FOUR_HOURS_MS;
  return Date.now() > deadline;
}

function deadlineFor(askedAt: string): Date {
  return new Date(new Date(askedAt).getTime() + TWENTY_FOUR_HOURS_MS);
}

export default function DeveloperReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { apiFetch, auth, hydrated } = useAuth();
  const [report, setReport] = useState<DeveloperReport | null>(null);
  const [newComment, setNewComment] = useState("");
  const [newKind, setNewKind] = useState<"comment" | "question">("comment");
  const [responseByParent, setResponseByParent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [directorNoteAppend, setDirectorNoteAppend] = useState("");
  const [replaceEntireRemarks, setReplaceEntireRemarks] = useState(false);
  const [waitingForAi, setWaitingForAi] = useState(false);

  const isDirector = auth.roleKeys.some((r) => ["director_admin", "director", "admin"].includes(r));
  const useNeu = isDeveloperOnly(auth.roleKeys);
  const remarkReplacePrefilledRef = useRef(false);

  useEffect(() => {
    if (!replaceEntireRemarks) {
      remarkReplacePrefilledRef.current = false;
      return;
    }
    if (!report) return;
    if (!remarkReplacePrefilledRef.current) {
      setDirectorNoteAppend(report.remarks ?? "");
      remarkReplacePrefilledRef.current = true;
    }
  }, [replaceEntireRemarks, report]);

  const isAuthor = report?.submittedBy?.id === auth.userId;

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/developer-reports/${id}`);
        if (res.ok) {
          const data = (await res.json()) as Partial<DeveloperReport>;
          setReport(normalizeReport(data));
          setDirectorNoteAppend("");
          setReplaceEntireRemarks(false);
        } else if (res.status === 404) {
          router.replace("/developer-reports");
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [id, apiFetch, router]);

  useEffect(() => {
    if (!report || !isAuthor || isDirector) return;
    if (hasLeadershipReply(report.comments ?? [])) {
      setWaitingForAi(false);
      return;
    }
    if ((report.reviewStatus ?? "pending") !== "pending" && report.remarks?.trim()) {
      setWaitingForAi(false);
      return;
    }
    setWaitingForAi(true);
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled || attempts >= 24) {
        setWaitingForAi(false);
        return;
      }
      attempts += 1;
      const res = await apiFetch(`/developer-reports/${id}`);
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as Partial<DeveloperReport>;
        const normalized = normalizeReport(data);
        if (normalized) {
          setReport(normalized);
          if (hasLeadershipReply(normalized.comments ?? [])) {
            setWaitingForAi(false);
            return;
          }
        }
      }
      window.setTimeout(tick, 2500);
    };
    window.setTimeout(tick, 2500);
    return () => {
      cancelled = true;
    };
  }, [report?.id, report?.reviewStatus, isAuthor, isDirector, id, apiFetch]);

  const reloadReport = async () => {
    const resReport = await apiFetch(`/developer-reports/${id}`);
    if (resReport.ok) {
      const data = (await resReport.json()) as Partial<DeveloperReport>;
      setReport((prev) => normalizeReport(data, prev));
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/developer-reports/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ kind: newKind, content: newComment.trim() })
      });
      if (res.ok) {
        setNewComment("");
        await reloadReport();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddResponse = async (parentId: string) => {
    const content = responseByParent[parentId]?.trim();
    if (!content) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/developer-reports/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ parentId, content })
      });
      if (res.ok) {
        setResponseByParent((prev) => ({ ...prev, [parentId]: "" }));
        await reloadReport();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated || !report) {
    return (
      <div className="flex min-h-[12rem] flex-1 items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  const comments = report.comments ?? [];
  const topLevel = comments.filter((c) => !c.parentId);
  const openQuestions = pendingQuestionCount(comments);
  const leadershipReplied = hasLeadershipReply(comments);

  const setReview = async (reviewStatus: "viewed" | "checked") => {
    if (!report) return;
    const append = !replaceEntireRemarks;
    const payloadRemarks = append ? directorNoteAppend.trim() : (directorNoteAppend || report.remarks || "").trim();
    if (reviewStatus === "checked" && append && !payloadRemarks && !(report.remarks?.trim())) {
      const hasLeadershipThread = comments.some(
        (c) =>
          !c.parentId &&
          c.kind !== "response" &&
          (c.source === "ai_auto" || c.content.includes("Marked reviewed"))
      );
      if (!hasLeadershipThread) {
        alert(
          "Add a director note on the report, append remarks, or ensure there is a leadership comment on this submission before marking checked."
        );
        return;
      }
    }
    if (reviewStatus === "checked" && !append && !payloadRemarks) {
      alert("Remarks are required when replacing the entire remarks field to mark checked.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/developer-reports/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewStatus,
          remarks: payloadRemarks || undefined,
          appendRemarks: append && Boolean(directorNoteAppend.trim())
        })
      });
      if (res.ok) {
        const updated = (await res.json()) as Partial<DeveloperReport>;
        setReport((prev) => normalizeReport(updated, prev));
        setDirectorNoteAppend("");
        setReplaceEntireRemarks(false);
        remarkReplacePrefilledRef.current = false;
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Failed to update review status");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const panel = useNeu ? devNeu.panel : "shell border-cres-border bg-cres-card/80";
  const headerPanel = useNeu ? devNeu.panel : "shell flex flex-wrap items-start justify-between gap-3 border-cres-border bg-cres-surface/70 sm:gap-4";
  const textMain = useNeu ? "text-slate-100" : "text-cres-text";
  const textMuted = useNeu ? "text-slate-500" : "text-cres-muted";
  const textMutedSm = useNeu ? "text-slate-400" : "text-cres-text-muted";
  const linkBack = useNeu ? "text-xs text-violet-300 hover:underline sm:text-sm" : "text-xs text-cres-accent hover:underline sm:text-sm";
  const inputClass = useNeu
    ? "w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm text-slate-100"
    : "w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2 text-cres-text";
  const btnPrimary = useNeu
    ? devNeu.btnPrimary
    : "rounded-lg bg-cres-accent px-4 py-2 text-sm font-medium text-cres-bg hover:bg-cres-accent-hover disabled:opacity-60";
  const commentBorder = useNeu ? "border-white/[0.06] bg-[#0e1319]" : "border-cres-border bg-cres-surface/50";
  const questionBorder = useNeu ? "border-violet-500/30 bg-violet-950/20" : "border-cres-accent/40 bg-cres-accent/10";

  return (
    <section className={`flex w-full min-w-0 flex-col gap-4 ${useNeu ? "pb-8" : "px-3 py-4 max-sm:gap-3 sm:px-6 sm:py-5"}`}>
      <div className={headerPanel}>
        <div>
          <Link href="/developer-reports" className={linkBack}>
            ← Back to reports
          </Link>
          <h2 className={`mt-2 text-base font-semibold sm:text-lg ${useNeu ? "font-display text-xl text-slate-100" : textMain}`}>
            {formatNairobiDate(report.reportDate)}
          </h2>
          <p className={`mt-1 text-[11px] sm:text-xs ${textMuted}`}>
            Filed {formatNairobiDateTime(report.createdAt)}
          </p>
        </div>
        <span
          className={
            report.reviewStatus === "checked"
              ? "rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 sm:px-3 sm:py-1 sm:text-sm"
              : report.reviewStatus === "viewed"
                ? "rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300 sm:px-3 sm:py-1 sm:text-sm"
                : "rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200 sm:px-3 sm:py-1 sm:text-sm"
          }
        >
          {report.reviewStatus ?? "pending"}
        </span>
      </div>

      <div className={panel}>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <p className={`text-[10px] uppercase tracking-wide sm:text-xs ${textMuted}`}>{label}</p>
              <p className={`mt-1 whitespace-pre-wrap text-xs sm:text-sm ${textMain}`}>
                {(report[key] ?? "").trim() ? (report[key] as string).trim() : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {!isDirector && isAuthor && waitingForAi && (
        <div className={`rounded-2xl px-4 py-3 sm:px-5 ${useNeu ? devNeu.alertInfo : devGlass.alertInfo}`}>
          <p className="text-sm text-sky-200">
            Leadership is reviewing your report. Automated feedback and questions usually appear within a minute.
          </p>
        </div>
      )}

      {!isDirector && isAuthor && leadershipReplied && openQuestions > 0 && (
        <div className={`rounded-2xl px-4 py-3 sm:px-5 ${useNeu ? devNeu.alertWarning : devGlass.alertWarning}`}>
          <p className="font-medium text-amber-200">
            {openQuestions} open question{openQuestions === 1 ? "" : "s"} waiting for your answer
          </p>
          <p className="mt-1 text-sm text-slate-300">Scroll to Comments & questions below to respond.</p>
        </div>
      )}

      {isDirector && (
        <div className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cres-muted sm:text-xs">Review status</p>
              <p className="mt-1 text-xs text-cres-text sm:text-sm">{report.reviewStatus ?? "pending"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void setReview("viewed")}
                className="rounded border border-cres-border px-2.5 py-1.5 text-xs text-cres-text hover:bg-cres-surface disabled:opacity-60 sm:px-3 sm:py-2 sm:text-sm"
              >
                Mark viewed
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void setReview("checked")}
                className="rounded bg-cres-accent px-2.5 py-1.5 text-xs font-medium text-cres-bg hover:bg-cres-accent-hover disabled:opacity-60 sm:px-3 sm:py-2 sm:text-sm"
              >
                Mark checked
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-cres-muted sm:text-xs">Saved remarks (on report)</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-cres-border/60 bg-cres-surface/40 px-2 py-2 text-xs text-cres-text sm:text-sm">
                {report.remarks?.trim() ? report.remarks.trim() : "— None yet —"}
              </p>
              <p className="mt-1 text-[11px] text-cres-muted sm:text-xs">
                Leadership replies appear in <strong>Comments</strong> below. Add a note here to append to saved remarks.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-cres-text sm:text-sm">
              <input
                type="checkbox"
                checked={replaceEntireRemarks}
                onChange={(e) => setReplaceEntireRemarks(e.target.checked)}
                className="rounded border-cres-border"
              />
              Replace entire remarks (overwrites saved remarks; use when correcting the full note)
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-cres-text-muted sm:text-sm">
                {replaceEntireRemarks
                  ? "Full remarks (saved on report)"
                  : "Add director / admin note (appended to saved remarks)"}
              </span>
              <textarea
                value={directorNoteAppend}
                onChange={(e) => setDirectorNoteAppend(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-cres-border bg-cres-surface px-2 py-1.5 text-xs text-cres-text sm:px-3 sm:py-2 sm:text-sm"
                placeholder={
                  replaceEntireRemarks
                    ? "Edit the complete remarks text…"
                    : "Type an additional note for the developer…"
                }
              />
            </label>
          </div>
        </div>
      )}

      {!isDirector && isAuthor && (
        <div className={panel}>
          <p className={`text-xs uppercase tracking-wide ${textMuted}`}>Director review</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={
                report.reviewStatus === "checked"
                  ? "rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                  : report.reviewStatus === "viewed"
                    ? "rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300"
                    : "rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200"
              }
            >
              {report.reviewStatus ?? "pending"}
            </span>
            <span className={`text-xs ${textMuted}`}>
              {report.reviewStatus === "checked"
                ? "Checked — see comments below"
                : report.reviewStatus === "viewed"
                  ? "Viewed"
                  : "Pending review"}
            </span>
          </div>
          {report.remarks?.trim() && (
            <div className="mt-3">
              <p className={`text-xs sm:text-sm ${textMutedSm}`}>Remarks</p>
              <p className={`mt-1 whitespace-pre-wrap text-xs sm:text-sm ${textMain}`}>{report.remarks.trim()}</p>
            </div>
          )}
        </div>
      )}

      <div className={panel}>
        <h3 className={`mb-3 text-xs font-semibold sm:text-sm ${textMain}`}>Comments & questions</h3>

        {topLevel.length === 0 && !isDirector && (
          <p className={`text-xs sm:text-sm ${textMuted}`}>
            {waitingForAi
              ? "Waiting for leadership review…"
              : "No comments yet from director."}
          </p>
        )}
        {topLevel.length === 0 && isDirector && (
          <p className={`text-xs sm:text-sm ${textMuted}`}>No comments yet. Add a comment or question below.</p>
        )}

        <ul className="space-y-4">
          {topLevel.map((c) => {
            const replies = comments.filter((r) => r.parentId === c.id);
            const questionOverdue = c.kind === "question" && replies.length === 0 && isOverdue(c.createdAt);
            const deadline = c.kind === "question" ? deadlineFor(c.createdAt) : null;
            return (
              <li
                key={c.id}
                className={`rounded-lg border px-3 py-3 ${
                  c.kind === "question" ? questionBorder : commentBorder
                }`}
              >
                <div className={`flex flex-wrap items-center gap-2 text-xs ${textMuted}`}>
                  <span className={`font-medium ${textMutedSm}`}>
                    {c.author?.name ?? c.author?.email ?? "User"}
                  </span>
                  <span>{c.kind === "question" ? "asked" : "commented"}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                  {deadline && (
                    <span className={questionOverdue ? (useNeu ? "text-amber-300" : "text-cres-accent") : textMuted}>
                      {questionOverdue ? "Overdue — answer required" : `Due ${deadline.toLocaleString()}`}
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-xs sm:text-sm ${textMain}`}>{c.content}</p>

                {replies.map((r) => (
                  <div
                    key={r.id}
                    className={`ml-4 mt-2 rounded border px-3 py-2 ${useNeu ? "border-white/[0.06] bg-[#121820]" : "border-cres-border bg-cres-surface/60"}`}
                  >
                    <p className={`text-xs ${textMuted}`}>
                      {r.author?.name ?? r.author?.email ?? "User"} answered {new Date(r.createdAt).toLocaleString()}
                    </p>
                    <p className={`mt-1 text-xs sm:text-sm ${textMain}`}>{r.content}</p>
                  </div>
                ))}

                {c.kind === "question" && replies.length === 0 && isAuthor && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={responseByParent[c.id] ?? ""}
                      onChange={(e) => setResponseByParent((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Your answer"
                      className={useNeu ? `${devNeu.navIdle} flex-1 rounded-lg px-3 py-2 text-sm text-slate-100` : "flex-1 rounded border border-cres-border bg-cres-surface px-3 py-2 text-sm text-cres-text"}
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAddResponse(c.id)}
                      className={`${btnPrimary} px-3 py-2 text-sm disabled:opacity-60`}
                    >
                      Submit answer
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {isDirector && (
          <div className={`mt-6 border-t pt-4 ${useNeu ? "border-white/[0.06]" : "border-cres-border"}`}>
            <label className="block">
              <span className={`mb-1 block text-sm ${textMutedSm}`}>Add comment or question</span>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Comment or question for the developer..."
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as "comment" | "question")}
                className={useNeu ? `${devNeu.navIdle} rounded-lg px-3 py-2 text-sm text-slate-100` : "rounded border border-cres-border bg-cres-surface px-3 py-2 text-sm text-cres-text"}
              >
                <option value="comment">Comment</option>
                <option value="question">Question</option>
              </select>
              <button
                type="button"
                disabled={loading || !newComment.trim()}
                onClick={handleAddComment}
                className={`${btnPrimary} disabled:opacity-60`}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
