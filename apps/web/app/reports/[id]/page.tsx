"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { formatNairobiDateTime } from "../../../lib/nairobi-datetime";

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

function normalizeReport(next: Partial<Report> | null | undefined, prev?: Report | null): Report | null {
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
    title: base.title ?? prev?.title ?? "",
    body: base.body ?? prev?.body ?? "",
    status: base.status ?? prev?.status ?? "draft",
    reviewStatus: base.reviewStatus ?? prev?.reviewStatus,
    remarks: base.remarks ?? prev?.remarks ?? null,
    submittedAt: base.submittedAt ?? prev?.submittedAt ?? null,
    submittedBy,
    comments
  };
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isOverdue(askedAt: string): boolean {
  return Date.now() > new Date(askedAt).getTime() + TWENTY_FOUR_HOURS_MS;
}

function deadlineFor(askedAt: string): Date {
  return new Date(new Date(askedAt).getTime() + TWENTY_FOUR_HOURS_MS);
}

function reviewChip(review: string | undefined): string {
  if (review === "checked") return "bg-[#E8F5E9] text-[#0B6A0B]";
  if (review === "viewed") return "bg-[#E8F1F8] text-[#005CAB]";
  return "bg-[#FFF8E1] text-[#8A7000]";
}

const inputClass =
  "w-full rounded-md border border-[#D1D1D1] bg-white px-2.5 py-2 text-[13px] font-medium text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20";

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
  const [directorNoteAppend, setDirectorNoteAppend] = useState("");
  const [replaceEntireRemarks, setReplaceEntireRemarks] = useState(false);

  const isDirector = auth.roleKeys.some((r) =>
    ["director_admin", "director", "admin"].includes(r)
  );
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
          const data = (await res.json()) as Partial<Report>;
          setReport(normalizeReport(data));
          setDirectorNoteAppend("");
          setReplaceEntireRemarks(false);
        } else if (res.status === 404) {
          router.replace("/reports");
        }
      } catch {
        // ignore
      }
    }
    void load();
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
          const data = (await resReport.json()) as Partial<Report>;
          setReport((prev) => normalizeReport(data, prev));
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
          const data = (await resReport.json()) as Partial<Report>;
          setReport((prev) => normalizeReport(data, prev));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const setReview = async (reviewStatus: "viewed" | "checked") => {
    if (!report) return;
    const append = !replaceEntireRemarks;
    const payloadRemarks = append
      ? directorNoteAppend.trim()
      : (directorNoteAppend || report.remarks || "").trim();
    if (reviewStatus === "checked" && append && !payloadRemarks && !report.remarks?.trim()) {
      const comments = report.comments ?? [];
      const hasLeadershipThread = comments.some(
        (c) =>
          !c.parentId &&
          c.kind !== "response" &&
          (c.source === "ai_auto" || c.content.includes("Marked reviewed"))
      );
      if (!hasLeadershipThread) {
        alert(
          "Add a director note, append remarks, or ensure there is a leadership comment before marking checked."
        );
        return;
      }
    }
    if (reviewStatus === "checked" && !append && !payloadRemarks) {
      alert("Remarks are required when replacing the entire remarks field.");
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
        const updated = (await res.json()) as Partial<Report>;
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

  if (!report) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-[13px] text-[#8A8886]">
        Loading report…
      </div>
    );
  }

  const comments = report.comments ?? [];
  const topLevel = comments.filter((c) => !c.parentId);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 bg-white pb-4 text-[#242424] antialiased">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E1DFDD] pb-3">
        <div className="min-w-0">
          <Link
            href="/reports"
            className="text-[11px] font-semibold text-[#005CAB] hover:underline"
          >
            ← Reports
          </Link>
          <h1 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{report.title}</h1>
          <p className="mt-0.5 text-[12px] text-[#605E5C]">
            By {report.submittedBy?.name ?? report.submittedBy?.email ?? "Unknown"}
            {report.submittedAt ? (
              <> · Submitted {formatNairobiDateTime(report.submittedAt)}</>
            ) : null}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            report.status === "submitted"
              ? "bg-[#E8F5E9] text-[#0B6A0B]"
              : "bg-[#F5F5F5] text-[#605E5C]"
          }`}
        >
          {report.status}
        </span>
      </header>

      <section className="rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
        <p className="text-[10px] font-semibold tracking-wide text-[#005CAB]">Activities</p>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#242424]">
          {report.body}
        </p>
      </section>

      {report.status === "submitted" ? (
        <>
          {isDirector ? (
            <section className="rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#8A8886]">Review</p>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reviewChip(report.reviewStatus)}`}
                  >
                    {report.reviewStatus ?? "pending"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void setReview("viewed")}
                    className="rounded-md border border-[#D1D1D1] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#242424] hover:border-[#005CAB]/40 disabled:opacity-50"
                  >
                    Mark viewed
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void setReview("checked")}
                    className="rounded-md bg-[#005CAB] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50"
                  >
                    Mark checked
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2.5">
                <div>
                  <p className="text-[11px] font-semibold text-[#605E5C]">Saved remarks</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border border-[#E1DFDD] bg-[#FAFAFA] px-2.5 py-2 text-[12px] text-[#242424]">
                    {report.remarks?.trim() ? report.remarks.trim() : "— None yet —"}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#605E5C]">
                  <input
                    type="checkbox"
                    checked={replaceEntireRemarks}
                    onChange={(e) => setReplaceEntireRemarks(e.target.checked)}
                    className="rounded border-[#D1D1D1]"
                  />
                  Replace entire remarks
                </label>
                <label className="block text-[11px] font-semibold text-[#605E5C]">
                  {replaceEntireRemarks ? "Full remarks" : "Add note (appended)"}
                  <textarea
                    value={directorNoteAppend}
                    onChange={(e) => setDirectorNoteAppend(e.target.value)}
                    rows={3}
                    className={`${inputClass} mt-1 resize-y`}
                    placeholder={
                      replaceEntireRemarks
                        ? "Edit the complete remarks text…"
                        : "Additional note for the salesperson…"
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          {!isDirector && isAuthor ? (
            <section className="rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
              <p className="text-[10px] font-semibold tracking-wide text-[#8A8886]">
                Director review
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reviewChip(report.reviewStatus)}`}
                >
                  {report.reviewStatus ?? "pending"}
                </span>
                <span className="text-[12px] text-[#605E5C]">
                  {report.reviewStatus === "checked"
                    ? "Checked"
                    : report.reviewStatus === "viewed"
                      ? "Viewed"
                      : "Pending review"}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#605E5C]">Remarks</p>
              <p className="mt-1 whitespace-pre-wrap text-[12px] text-[#242424]">
                {report.remarks?.trim() ? report.remarks.trim() : "—"}
              </p>
            </section>
          ) : null}

          <section className="rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
            <h2 className="text-[13px] font-semibold text-[#242424]">Comments & questions</h2>

            {topLevel.length === 0 ? (
              <p className="mt-2 text-[12px] text-[#8A8886]">
                {isDirector
                  ? "No comments yet. Add one below."
                  : "No comments yet from leadership."}
              </p>
            ) : null}

            <ul className="mt-3 space-y-2">
              {topLevel.map((c) => {
                const replies = comments.filter((r) => r.parentId === c.id);
                const questionOverdue =
                  c.kind === "question" && replies.length === 0 && isOverdue(c.createdAt);
                const deadline = c.kind === "question" ? deadlineFor(c.createdAt) : null;
                return (
                  <li
                    key={c.id}
                    className={`rounded-md border px-2.5 py-2 ${
                      c.kind === "question"
                        ? "border-[#B4CDE8] border-l-[3px] border-l-[#005CAB] bg-[#F8FBFD]"
                        : "border-[#E1DFDD] bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8A8886]">
                      <span className="font-semibold text-[#242424]">
                        {c.author?.name ?? c.author?.email ?? "User"}
                      </span>
                      <span>{c.kind === "question" ? "asked" : "commented"}</span>
                      <span>{formatNairobiDateTime(c.createdAt)}</span>
                      {deadline ? (
                        <span
                          className={
                            questionOverdue
                              ? "font-semibold text-[#C50F1F]"
                              : "text-[#C19C00]"
                          }
                        >
                          {questionOverdue
                            ? "Overdue"
                            : `Due ${formatNairobiDateTime(deadline)}`}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-[#242424]">{c.content}</p>

                    {replies.map((r) => (
                      <div
                        key={r.id}
                        className="mt-2 ml-3 rounded-md border border-[#E1DFDD] bg-[#FAFAFA] px-2.5 py-1.5"
                      >
                        <p className="text-[10px] text-[#8A8886]">
                          {r.author?.name ?? r.author?.email ?? "User"} ·{" "}
                          {formatNairobiDateTime(r.createdAt)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#242424]">{r.content}</p>
                      </div>
                    ))}

                    {c.kind === "question" && replies.length === 0 && isAuthor ? (
                      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                        <input
                          type="text"
                          value={responseByParent[c.id] ?? ""}
                          onChange={(e) =>
                            setResponseByParent((prev) => ({
                              ...prev,
                              [c.id]: e.target.value
                            }))
                          }
                          placeholder="Your answer"
                          className={`${inputClass} flex-1`}
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void handleAddResponse(c.id)}
                          className="rounded-md bg-[#005CAB] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50"
                        >
                          Submit answer
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {isDirector ? (
              <div className="mt-4 border-t border-[#E1DFDD] pt-3">
                <p className="text-[11px] font-semibold text-[#605E5C]">Add comment or question</p>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1 resize-y`}
                  placeholder="Note for the salesperson…"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as "comment" | "question")}
                    className="rounded-md border border-[#D1D1D1] bg-white px-2.5 py-1.5 text-[12px] text-[#242424] focus:border-[#005CAB] focus:outline-none"
                  >
                    <option value="comment">Comment</option>
                    <option value="question">Question</option>
                  </select>
                  <button
                    type="button"
                    disabled={loading || !newComment.trim()}
                    onClick={() => void handleAddComment()}
                    className="rounded-md bg-[#005CAB] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {report.status === "draft" && isAuthor ? (
        <section className="flex flex-wrap items-center gap-2 rounded-md border border-[#B4CDE8] border-l-[3px] border-l-[#005CAB] bg-[#F8FBFD] px-3 py-2.5">
          <p className="flex-1 text-[12px] text-[#605E5C]">
            Draft — submit to make it visible to your director.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const res = await apiFetch(`/reports/${id}/submit`, { method: "POST" });
                if (res.ok) {
                  const resReport = await apiFetch(`/reports/${id}`);
                  if (resReport.ok) {
                    const data = (await resReport.json()) as Partial<Report>;
                    setReport((prev) => normalizeReport(data, prev));
                  }
                }
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-md bg-[#005CAB] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50"
          >
            {loading ? "…" : "Submit report"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
