"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { formatNairobiDateTime } from "../../lib/nairobi-datetime";

type Report = {
  id: string;
  title: string;
  body: string;
  status: string;
  reviewStatus?: string;
  remarks?: string | null;
  submittedAt: string | null;
  createdAt: string;
  submittedBy?: { id: string; name: string | null; email: string };
  bodyPreview?: string;
  bodyCharCount?: number;
  hasAiLeadershipReply?: boolean;
};

type OverdueItem = {
  id: string;
  reportId: string;
  reportTitle: string;
  content: string;
  askedAt: string;
  deadline: string;
  overdue: boolean;
};

function statusChip(status: string): string {
  if (status === "submitted") return "bg-[#E8F5E9] text-[#0B6A0B]";
  return "bg-[#F5F5F5] text-[#605E5C]";
}

function reviewChip(review: string | undefined): string {
  if (review === "checked") return "bg-[#E8F5E9] text-[#0B6A0B]";
  if (review === "viewed") return "bg-[#E8F1F8] text-[#005CAB]";
  return "bg-[#FFF8E1] text-[#8A7000]";
}

export default function ReportsPage() {
  const { apiFetch, auth } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isLeadership = auth.roleKeys.some((r) =>
    ["director_admin", "director", "admin"].includes(r)
  );
  const canCreateSalesReport = auth.roleKeys.includes("sales");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [listRes, alarmRes] = await Promise.all([
        apiFetch("/reports"),
        apiFetch("/reports/alarms/overdue")
      ]);
      if (listRes.ok) {
        setReports((await listRes.json()) as Report[]);
      } else {
        const err = (await listRes.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setLoadError(err.message ?? err.error ?? `Could not load reports (${listRes.status})`);
        setReports([]);
      }
      if (alarmRes.ok) {
        const data = (await alarmRes.json()) as { overdue: OverdueItem[] };
        setOverdue(data.overdue ?? []);
      }
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = isLeadership ? "Submitted reports" : "My reports";
  const description = isLeadership
    ? "Sales activity reports for review."
    : "Submit daily activity reports. Submitted entries are read-only.";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 bg-white pb-4 text-[#242424] antialiased">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E1DFDD] pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-wide text-[#005CAB]">Sales reports</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
          <p className="mt-0.5 max-w-xl text-[12px] font-medium leading-snug text-[#605E5C]">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border border-[#D1D1D1] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB] disabled:opacity-50"
          >
            {loading ? "…" : "Refresh"}
          </button>
          {isLeadership && (
            <Link
              href={auth.roleKeys.includes("admin") ? "/admin/reports?tab=ai" : "/reports/ai"}
              className="rounded-md border border-[#C5B0DF] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#5C2D91] hover:bg-[#F5F0FA]"
            >
              AI reports
            </Link>
          )}
          {canCreateSalesReport && !isLeadership && (
            <Link
              href="/reports/new"
              className="rounded-md bg-[#005CAB] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#004A8C]"
            >
              + New report
            </Link>
          )}
        </div>
      </header>

      {loadError ? (
        <div className="rounded-md border border-[#E8A0A6] border-l-[3px] border-l-[#C50F1F] px-2.5 py-2 text-[12px] text-[#C50F1F]">
          {loadError}
        </div>
      ) : null}

      {!isLeadership && overdue.length > 0 ? (
        <div className="rounded-md border border-[#E8D48A] border-l-[3px] border-l-[#C19C00] px-2.5 py-2">
          <p className="text-[12px] font-semibold text-[#8A7000]">
            {overdue.length} open question{overdue.length === 1 ? "" : "s"} past deadline
          </p>
          <ul className="mt-1.5 space-y-1">
            {overdue.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link
                  href={`/reports/${o.reportId}`}
                  className="text-[12px] font-medium text-[#005CAB] hover:underline"
                >
                  {o.reportTitle}
                </Link>
              </li>
            ))}
            {overdue.length > 5 ? (
              <li className="text-[11px] text-[#8A8886]">…and {overdue.length - 5} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <section className="rounded-md border border-[#E1DFDD] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1DFDD] px-3 py-2">
          <h2 className="text-[13px] font-semibold text-[#242424]">
            {isLeadership ? "Submissions" : "Your reports"}
          </h2>
          <p className="text-[11px] text-[#8A8886]">
            {loading ? "Loading…" : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading && reports.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[#8A8886]">Loading reports…</p>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-[13px] font-semibold text-[#605E5C]">
              {isLeadership ? "No submitted reports yet" : "No reports yet"}
            </p>
            <p className="max-w-sm text-[12px] text-[#8A8886]">
              {isLeadership
                ? "Reports appear when sales submits activity."
                : "Create a draft, then submit for director review."}
            </p>
            {canCreateSalesReport && !isLeadership ? (
              <Link
                href="/reports/new"
                className="mt-1 rounded-md bg-[#005CAB] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#004A8C]"
              >
                + New report
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#E1DFDD] bg-[#FAFAFA] text-[10px] font-semibold tracking-wide text-[#8A8886]">
                  <th className="px-3 py-2 font-semibold">Title</th>
                  {isLeadership ? <th className="px-3 py-2 font-semibold">By</th> : null}
                  {isLeadership ? <th className="hidden px-3 py-2 font-semibold lg:table-cell">Preview</th> : null}
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Review</th>
                  <th className="hidden px-3 py-2 font-semibold sm:table-cell">Submitted</th>
                  <th className="px-3 py-2 text-right font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const preview =
                    r.bodyPreview?.trim() ||
                    (r.body
                      ? (() => {
                          const flat = r.body.replace(/\s+/g, " ").trim();
                          return flat.length > 100 ? `${flat.slice(0, 100)}…` : flat;
                        })()
                      : "—");
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[#E1DFDD] align-top last:border-0 hover:bg-[#F8FBFD]"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/reports/${r.id}`}
                          className="font-semibold text-[#005CAB] hover:underline"
                        >
                          {r.title}
                        </Link>
                        {r.remarks?.trim() ? (
                          <p className="mt-0.5 max-w-[14rem] truncate text-[11px] text-[#8A8886]">
                            Note: {r.remarks.trim()}
                          </p>
                        ) : null}
                      </td>
                      {isLeadership ? (
                        <td className="px-3 py-2.5 text-[#605E5C]">
                          {r.submittedBy ? r.submittedBy.name ?? r.submittedBy.email : "—"}
                        </td>
                      ) : null}
                      {isLeadership ? (
                        <td
                          className="hidden max-w-[12rem] px-3 py-2.5 text-[#605E5C] lg:table-cell"
                          title={preview}
                        >
                          {preview}
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChip(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reviewChip(r.reviewStatus)}`}
                        >
                          {r.reviewStatus ?? "pending"}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-[#8A8886] sm:table-cell">
                        {r.submittedAt ? formatNairobiDateTime(r.submittedAt) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/reports/${r.id}`}
                          className="font-semibold text-[#005CAB] hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
