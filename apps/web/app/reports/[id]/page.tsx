"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";

type Comment = {
  id: string;
  kind: string;
  content: string;
  createdAt: string;
  authorId: string;
  author: { id: string; name: string | null; email: string };
  parentId: string | null;
  /** When "ai_auto", CresOS added this thread reply after submit (same style as a director note). */
  source?: string | null;
  replies?: Comment[];
};

type Report = {
  id: string;
  title: string;
  body: string;
  status: string;
  reviewStatus?: string;
  remarks?: string | null;
  submittedAt: string | null;
  submittedBy: { id: string; name: string | null; email: string };
  comments: Comment[];
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isOverdue(askedAt: string): boolean {
  const deadline = new Date(askedAt).getTime() + TWENTY_FOUR_HOURS_MS;
  return Date.now() > deadline;
}

function deadlineFor(askedAt: string): Date {
  return new Date(new Date(askedAt).getTime() + TWENTY_FOUR_HOURS_MS);
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { apiFetch, auth } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [newComment, setNewComment] = useState("");
  const [newKind, setNewKind] = useState<"comment" | "question">("comment");
  const [responseByParent, setResponseByParent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  /** Appended to report remarks (does not remove existing text unless “Replace entire remarks” is checked). */
  const [directorNoteAppend, setDirectorNoteAppend] = useState("");
  const [replaceEntireRemarks, setReplaceEntireRemarks] = useState(false);

  const isDirector = auth.roleKeys.some((r) => ["director_admin", "director", "admin"].includes(r));
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
        const res = await apiFetch(`/reports/${id}`);
        if (res.ok) {
          const data = (await res.json()) as Report;
          setReport(data);
          setDirectorNoteAppend("");
          setReplaceEntireRemarks(false);
        } else if (res.status === 404) {
          router.replace("/reports");
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [id, apiFetch, router]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/reports/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ kind: newKind, content: newComment.trim() })
      });
      if (res.ok) {
        setNewComment("");
        const resReport = await apiFetch(`/reports/${id}`);
        if (resReport.ok) {
          const data = (await resReport.json()) as Report;
          setReport(data);
        }
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
      const res = await apiFetch(`/reports/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ parentId, content })
      });
      if (res.ok) {
        setResponseByParent((prev) => ({ ...prev, [parentId]: "" }));
        const resReport = await apiFetch(`/reports/${id}`);
        if (resReport.ok) {
          const data = (await resReport.json()) as Report;
          setReport(data);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return (
      <section className="shell border-cres-border bg-cres-surface/70">
        <p className="text-cres-muted">Loading…</p>
      </section>
    );
  }

  const topLevel = report.comments.filter((c) => !c.parentId);

  const setReview = async (reviewStatus: "viewed" | "checked") => {
    if (!report) return;
    const append = !replaceEntireRemarks;
    const payloadRemarks = append ? directorNoteAppend.trim() : (directorNoteAppend || report.remarks || "").trim();
    if (reviewStatus === "checked" && append && !payloadRemarks && !(report.remarks?.trim())) {
      const hasLeadershipThread = report.comments.some(
        (c) =>
          !c.parentId &&
          c.kind !== "response" &&
          (c.source === "ai_auto" || c.content.includes("Marked reviewed"))
      );
      if (!hasLeadershipThread) {
        alert("Add a director note on the report, append remarks, or ensure there is a leadership comment on this submission before marking checked.");
        return;
      }
    }
    if (reviewStatus === "checked" && !append && !payloadRemarks) {
      alert("Remarks are required when replacing the entire remarks field to mark checked.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/reports/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewStatus,
          remarks: payloadRemarks || undefined,
          appendRemarks: append && Boolean(directorNoteAppend.trim())
        })
      });
      if (res.ok) {
        const updated = (await res.json()) as Report;
        setReport(updated);
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

  return (
    <section className="flex flex-col gap-4 max-sm:gap-3">
      <div className="shell flex flex-wrap items-start justify-between gap-3 border-cres-border bg-cres-surface/70 sm:gap-4">
        <div>
          <Link href="/reports" className="text-xs text-cres-accent hover:underline sm:text-sm">
            ← Back to reports
          </Link>
          <h2 className="mt-2 text-base font-semibold text-cres-text sm:text-lg">{report.title}</h2>
          <p className="mt-1 text-[11px] text-cres-muted sm:text-xs">
            By {report.submittedBy.name ?? report.submittedBy.email}
            {report.submittedAt && (
              <> · Submitted {new Date(report.submittedAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <span
          className={
            report.status === "submitted"
              ? "rounded bg-cres-accent/20 px-2 py-0.5 text-xs text-cres-accent sm:px-3 sm:py-1 sm:text-sm"
              : "rounded bg-cres-border px-2 py-0.5 text-xs text-cres-text-muted sm:px-3 sm:py-1 sm:text-sm"
          }
        >
          {report.status}
        </span>
      </div>

      <div className="shell border-cres-border bg-cres-card/80">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-cres-text sm:text-sm sm:leading-normal">
          {report.body}
        </p>
      </div>

      {report.status === "submitted" && (
        <>
          {isDirector && (
            <div className="shell border-cres-border bg-cres-card/80">
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
                    Automated leadership replies appear in <strong>Comments</strong> below. Add a note here to append to
                    saved remarks without removing prior text, unless you choose replace.
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
                        : "Type an additional note for the sales submitter…"
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {!isDirector && isAuthor && (
            <div className="shell border-cres-border bg-cres-card/80">
              <p className="text-xs uppercase tracking-wide text-cres-muted">Director review</p>
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
                <span className="text-xs text-cres-muted">
                  {report.reviewStatus === "checked"
                    ? "Checked — see remarks below"
                    : report.reviewStatus === "viewed"
                      ? "Viewed"
                      : "Pending review"}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs text-cres-text-muted sm:text-sm">Remarks</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-cres-text sm:text-sm">
                  {report.remarks?.trim() ? report.remarks.trim() : "—"}
                </p>
              </div>
            </div>
          )}

          <div className="shell border-cres-border bg-cres-card/80">
            <h3 className="mb-3 text-xs font-semibold text-cres-text sm:text-sm">Comments & questions</h3>

            {topLevel.length === 0 && !isDirector && (
              <p className="text-xs text-cres-muted sm:text-sm">No comments yet from director.</p>
            )}
            {topLevel.length === 0 && isDirector && (
              <p className="text-xs text-cres-muted sm:text-sm">No comments yet. Add a comment or question below.</p>
            )}

            <ul className="space-y-4">
              {topLevel.map((c) => {
                const replies = report.comments.filter((r) => r.parentId === c.id);
                const questionOverdue = c.kind === "question" && replies.length === 0 && isOverdue(c.createdAt);
                const deadline = c.kind === "question" ? deadlineFor(c.createdAt) : null;
                return (
                  <li
                    key={c.id}
                    className={`rounded-lg border px-3 py-3 ${
                      c.kind === "question" ? "border-cres-accent/40 bg-cres-accent/10" : "border-cres-border bg-cres-surface/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-cres-muted">
                      <span className="font-medium text-cres-text-muted">
                        {c.author.name ?? c.author.email}
                      </span>
                      {c.source === "ai_auto" ? (
                        <span className="rounded bg-slate-600/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100">
                          Auto
                        </span>
                      ) : null}
                      <span>{c.kind === "question" ? "asked" : "commented"}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                      {deadline && (
                        <span className={questionOverdue ? "text-cres-accent" : "text-cres-muted"}>
                          {questionOverdue
                            ? "Overdue — answer required"
                            : `Due ${deadline.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-cres-text sm:text-sm">{c.content}</p>

                    {replies.map((r) => (
                      <div
                        key={r.id}
                        className="ml-4 mt-2 rounded border border-cres-border bg-cres-surface/60 px-3 py-2"
                      >
                        <p className="text-xs text-cres-muted">
                          {r.author.name ?? r.author.email} answered{" "}
                          {new Date(r.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-cres-text sm:text-sm">{r.content}</p>
                      </div>
                    ))}

                    {c.kind === "question" && replies.length === 0 && isAuthor && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={responseByParent[c.id] ?? ""}
                          onChange={(e) =>
                            setResponseByParent((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          placeholder="Your answer (required within 24h)"
                          className="flex-1 rounded border border-cres-border bg-cres-surface px-3 py-2 text-sm text-cres-text"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleAddResponse(c.id)}
                          className="rounded bg-cres-accent px-3 py-2 text-sm font-medium text-cres-bg hover:bg-cres-accent-hover disabled:opacity-60"
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
              <div className="mt-6 border-t border-cres-border pt-4">
                <label className="block">
                  <span className="mb-1 block text-sm text-cres-text-muted">Add comment or question</span>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2 text-cres-text"
                    placeholder="Comment or question for the sales person..."
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as "comment" | "question")}
                    className="rounded border border-cres-border bg-cres-surface px-3 py-2 text-sm text-cres-text"
                  >
                    <option value="comment">Comment</option>
                    <option value="question">Question (requires answer within 24h)</option>
                  </select>
                  <button
                    type="button"
                    disabled={loading || !newComment.trim()}
                    onClick={handleAddComment}
                    className="rounded-lg bg-cres-accent px-4 py-2 text-sm font-medium text-cres-bg hover:bg-cres-accent-hover disabled:opacity-60"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {report.status === "draft" && isAuthor && (
        <div className="shell flex flex-wrap items-center gap-4">
          <p className="text-sm text-slate-400">This report is a draft. Submit it to make it visible to the director.</p>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const res = await apiFetch(`/reports/${id}/submit`, { method: "POST" });
                if (res.ok) {
                  const resReport = await apiFetch(`/reports/${id}`);
                  if (resReport.ok) setReport((await resReport.json()) as Report);
                }
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            Submit report
          </button>
          <Link href="/reports" className="text-sm text-brand hover:underline">
            Back to reports
          </Link>
        </div>
      )}
    </section>
  );
}
