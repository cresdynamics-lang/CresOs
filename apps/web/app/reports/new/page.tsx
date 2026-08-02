"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../auth-context";

const inputClass =
  "mt-1 w-full rounded-md border border-[#D1D1D1] bg-white px-2.5 py-2 text-[13px] font-medium text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20";

const labelClass = "block text-[11px] font-semibold text-[#605E5C]";

export default function NewReportPage() {
  const { apiFetch, auth, hydrated } = useAuth();
  const router = useRouter();
  const canCreate = auth.roleKeys.includes("sales");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [directorLabel, setDirectorLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canCreate) router.replace("/reports");
  }, [hydrated, auth.accessToken, canCreate, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/account/me");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          reportsToDirector?: { name: string | null; email: string } | null;
        };
        const d = data.reportsToDirector;
        if (d) setDirectorLabel(d.name?.trim() || d.email);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const handleCreate = async (andSubmit: boolean) => {
    if (!title.trim() || !body.trim()) {
      setError("Title and activities are required.");
      return;
    }
    if (andSubmit && body.trim().length < 40) {
      setError("Write at least 40 characters in Activities for a useful director record.");
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

  if (!hydrated || !canCreate) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-[13px] text-[#8A8886]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 bg-white pb-4 text-[#242424] antialiased">
      <header className="border-b border-[#E1DFDD] pb-3">
        <p className="text-[10px] font-semibold tracking-wide text-[#005CAB]">Sales reports</p>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">New report</h1>
        <p className="mt-0.5 max-w-xl text-[12px] font-medium leading-snug text-[#605E5C]">
          {directorLabel
            ? `Save a draft or submit to ${directorLabel} for review.`
            : "Save a draft or submit for director review. Submit time is recorded in Nairobi time."}
        </p>
      </header>

      <section className="mx-auto w-full max-w-2xl rounded-md border border-[#E1DFDD] bg-white p-3 sm:p-4">
        <div className="space-y-3">
          <label className={labelClass}>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Weekly client follow-ups"
            />
          </label>
          <label className={labelClass}>
            Activities done
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className={`${inputClass} min-h-[12rem] resize-y leading-relaxed`}
              placeholder="Describe what you did, who you contacted, and next steps…"
            />
            <span className="mt-1 block text-[10px] font-medium text-[#8A8886]">
              {body.trim().length} characters
              {body.trim().length > 0 && body.trim().length < 40
                ? " · need 40+ to submit"
                : ""}
            </span>
          </label>

          {error ? (
            <p className="rounded-md border border-[#E8A0A6] border-l-[3px] border-l-[#C50F1F] px-2.5 py-2 text-[12px] text-[#C50F1F]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleCreate(true)}
              className="rounded-md bg-[#005CAB] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save and submit"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleCreate(false)}
              className="rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-[12px] font-semibold text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB] disabled:opacity-50"
            >
              Save draft
            </button>
            <Link
              href="/reports"
              className="rounded-md px-3 py-2 text-[12px] font-semibold text-[#605E5C] hover:text-[#005CAB]"
            >
              Cancel
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
