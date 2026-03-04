"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";

export default function NewReportPage() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleCreate = async (andSubmit: boolean) => {
    if (!title.trim() || !body.trim()) {
      setError("Title and activities are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/reports", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to create report");
        setLoading(false);
        return;
      }
      const report = (await res.json()) as { id: string };
      if (andSubmit) {
        const subRes = await apiFetch(`/reports/${report.id}/submit`, {
          method: "POST"
        });
        if (!subRes.ok) {
          setError("Created but failed to submit.");
          setLoading(false);
          return;
        }
      }
      router.push(`/reports/${report.id}`);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Create report</h2>
        <p className="text-sm text-slate-300">
          Describe the activities you’ve done. You can save as draft or submit for director review.
        </p>
      </div>

      <div className="shell flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-brand"
            placeholder="e.g. Weekly client follow-ups"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Activities done</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-brand"
            placeholder="Describe what you did..."
          />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleCreate(false)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleCreate(true)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save and submit"}
          </button>
          <Link
            href="/reports"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Link>
        </div>
      </div>
    </section>
  );
}
