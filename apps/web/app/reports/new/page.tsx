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
    if (andSubmit && body.trim().length < 40) {
      setError("Write at least 40 characters in Activities so the director gets a useful record (same rule on the server).");
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
      <div className="shell border-cres-border bg-cres-surface/70">
        <h2 className="mb-2 text-lg font-semibold text-cres-text">Create report</h2>
        <p className="text-sm text-cres-text-muted">
          Describe the activities you’ve done. You can save as draft or submit for director review. When you submit, the server records the exact time (UTC) — directors see it in-app and in email, even if they were offline when you sent it.
        </p>
      </div>

      <div className="shell flex flex-col gap-4 border-cres-border bg-cres-card/80">
        <label className="block">
          <span className="mb-1 block text-sm text-cres-text-muted">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2 text-cres-text outline-none focus:border-cres-accent"
            placeholder="e.g. Weekly client follow-ups"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-cres-text-muted">Activities done</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-cres-border bg-cres-surface px-3 py-2 text-cres-text outline-none focus:border-cres-accent"
            placeholder="Describe what you did..."
          />
        </label>
        {error && <p className="text-sm text-cres-accent">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleCreate(false)}
            className="rounded-lg border border-cres-border bg-cres-surface px-4 py-2 text-sm font-medium text-cres-text-muted hover:bg-cres-card disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleCreate(true)}
            className="rounded-lg bg-cres-accent px-4 py-2 text-sm font-medium text-cres-bg hover:bg-cres-accent-hover disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save and submit"}
          </button>
          <Link
            href="/reports"
            className="rounded-lg border border-cres-border px-4 py-2 text-sm font-medium text-cres-text-muted hover:bg-cres-surface"
          >
            Cancel
          </Link>
        </div>
      </div>
    </section>
  );
}
