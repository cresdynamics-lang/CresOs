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
      <div className="admin-reports-neu p-4">
        <p className="text-sm text-[#605E5C]">You do not have access to director reports.</p>
      </div>
    );
  }

  return (
    <div className="admin-reports-neu flex flex-col gap-4 bg-white px-3 py-4 sm:px-6 sm:py-5">
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
        <div className="rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]">
          <h2 className="mb-3 text-sm font-semibold text-[#242424]">New report to Admin</h2>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Report title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424]"
            />
            <textarea
              placeholder="Summary, team progress, risks, decisions needed…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm text-[#242424]"
            />
            <button
              type="button"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={() => void createDraft()}
              className="w-fit rounded-md bg-[#005CAB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit to Admin"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]">
        <h2 className="mb-3 text-sm font-semibold text-[#242424]">
          {isAdmin ? "Submitted reports" : "Your reports"}
        </h2>
        {loading ? (
          <p className="text-sm text-[#8A8886]">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-[#8A8886]">No reports yet.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-[#E1DFDD] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#242424]">{r.title}</p>
                    {r.submittedBy && (
                      <p className="text-xs text-[#8A8886]">
                        {r.submittedBy.name ?? r.submittedBy.email}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[#8A8886]">
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
                        className="rounded-md border border-[#D1D1D1] px-2 py-1 text-xs font-semibold text-[#605E5C]"
                      >
                        Mark viewed
                      </button>
                      <button
                        type="button"
                        onClick={() => void review(r.id, "checked")}
                        className="rounded-md bg-[#0B6A0B] px-2 py-1 text-xs font-semibold text-white"
                      >
                        Checked
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm text-[#605E5C]">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-[#8A8886]">
          <Link
            href={isAdmin ? "/admin/reports?tab=sales" : "/reports"}
            className="font-semibold text-[#005CAB] hover:underline"
          >
            Sales team reports
          </Link>
          {" · "}
          <Link
            href={isAdmin ? "/admin/reports?tab=developers" : "/developer-reports"}
            className="font-semibold text-[#005CAB] hover:underline"
          >
            Developer team reports
          </Link>
        </p>
      </div>
    </div>
  );
}
