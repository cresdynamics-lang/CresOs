"use client";

import { useEffect, useState } from "react";
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
  replies?: Comment[];
};

type Report = {
  id: string;
  title: string;
  body: string;
  status: string;
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

  const isDirector = auth.roleKeys.some((r) => ["director_admin", "admin"].includes(r));
  const isAuthor = report?.submittedBy?.id === auth.userId;

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/reports/${id}`);
        if (res.ok) {
          const data = (await res.json()) as Report;
          setReport(data);
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
      <section className="shell">
        <p className="text-slate-400">Loading…</p>
      </section>
    );
  }

  const topLevel = report.comments.filter((c) => !c.parentId);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/reports" className="text-sm text-brand hover:underline">
            ← Back to reports
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-slate-50">{report.title}</h2>
          <p className="mt-1 text-xs text-slate-400">
            By {report.submittedBy.name ?? report.submittedBy.email}
            {report.submittedAt && (
              <> · Submitted {new Date(report.submittedAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <span
          className={
            report.status === "submitted"
              ? "rounded bg-emerald-900/60 px-3 py-1 text-sm text-emerald-300"
              : "rounded bg-amber-900/60 px-3 py-1 text-sm text-amber-300"
          }
        >
          {report.status}
        </span>
      </div>

      <div className="shell">
        <p className="whitespace-pre-wrap text-sm text-slate-200">{report.body}</p>
      </div>

      {report.status === "submitted" && (
        <>
          <div className="shell">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Comments & questions</h3>

            {topLevel.length === 0 && !isDirector && (
              <p className="text-sm text-slate-400">No comments yet from director.</p>
            )}
            {topLevel.length === 0 && isDirector && (
              <p className="text-sm text-slate-400">No comments yet. Add a comment or question below.</p>
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
                      c.kind === "question" ? "border-amber-800/60 bg-amber-950/20" : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-300">
                        {c.author.name ?? c.author.email}
                      </span>
                      <span>{c.kind === "question" ? "asked" : "commented"}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                      {deadline && (
                        <span className={questionOverdue ? "text-rose-400" : "text-slate-500"}>
                          {questionOverdue
                            ? "Overdue — answer required"
                            : `Due ${deadline.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-200">{c.content}</p>

                    {replies.map((r) => (
                      <div
                        key={r.id}
                        className="ml-4 mt-2 rounded border border-slate-700 bg-slate-900/60 px-3 py-2"
                      >
                        <p className="text-xs text-slate-400">
                          {r.author.name ?? r.author.email} answered{" "}
                          {new Date(r.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-sm text-slate-200">{r.content}</p>
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
                          className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleAddResponse(c.id)}
                          className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
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
              <div className="mt-6 border-t border-slate-700 pt-4">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Add comment or question</span>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    placeholder="Comment or question for the sales person..."
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as "comment" | "question")}
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="comment">Comment</option>
                    <option value="question">Question (requires answer within 24h)</option>
                  </select>
                  <button
                    type="button"
                    disabled={loading || !newComment.trim()}
                    onClick={handleAddComment}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
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
