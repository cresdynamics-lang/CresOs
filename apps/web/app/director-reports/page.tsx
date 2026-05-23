"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { WorkspaceDashboardIntro } from "../../components/workspace-dashboard-intro";

type DirectorReport = {
  id: string;
  title: string;
  body: string;
  status: string;
  reviewStatus: string;
  submittedAt: string | null;
  createdAt: string;
  submittedBy?: { id: string; name: string | null; email: string };
};

export default function DirectorReportsPage() {
  const { auth, apiFetch } = useAuth();
  const isAdmin = auth.roleKeys.includes("admin");
  const isDirector = auth.roleKeys.includes("director_admin");
  const [list, setList] = useState<DirectorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/director-reports");
      if (res.ok) setList((await res.json()) as DirectorReport[]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDraft = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch("/director-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      });
      if (!res.ok) return;
      const draft = (await res.json()) as DirectorReport;
      const sub = await apiFetch(`/director-reports/${draft.id}/submit`, { method: "POST" });
      if (sub.ok) {
        setTitle("");
        setBody("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const review = async (id: string, reviewStatus: string) => {
    const res = await apiFetch(`/director-reports/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus })
    });
    if (res.ok) await load();
  };

  if (!isAdmin && !isDirector) {
    return (
      <div className="shell">
        <p className="text-slate-400">You do not have access to director reports.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceDashboardIntro
        title={isAdmin ? "Director reports to Admin" : "Reports to Admin"}
        description={
          isAdmin
            ? "Review leadership reports submitted by directors."
            : "Submit periodic reports to Admin. Your team's sales and developer reports are reviewed separately."
        }
        eyebrow={isAdmin ? "Admin" : "Director"}
        showWelcomeBanner={!isAdmin}
      />

      {isDirector && (
        <div className="shell border border-brand/25">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">New report to Admin</h2>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Report title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <textarea
              placeholder="Summary, team progress, risks, decisions needed…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={() => void createDraft()}
              className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit to Admin"}
            </button>
          </div>
        </div>
      )}

      <div className="shell">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">
          {isAdmin ? "Submitted reports" : "Your reports"}
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-400">No reports yet.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">{r.title}</p>
                    {r.submittedBy && (
                      <p className="text-xs text-slate-500">
                        {r.submittedBy.name ?? r.submittedBy.email}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {r.status} · {r.reviewStatus}
                      {r.submittedAt
                        ? ` · ${new Date(r.submittedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  {isAdmin && r.status === "submitted" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void review(r.id, "viewed")}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
                      >
                        Mark viewed
                      </button>
                      <button
                        type="button"
                        onClick={() => void review(r.id, "checked")}
                        className="rounded bg-emerald-600/80 px-2 py-1 text-xs text-white"
                      >
                        Checked
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300 line-clamp-6">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">
          <Link href="/reports" className="text-brand hover:underline">
            Sales team reports
          </Link>
          {" · "}
          <Link href="/developer-reports" className="text-brand hover:underline">
            Developer team reports
          </Link>
        </p>
      </div>
    </div>
  );
}
