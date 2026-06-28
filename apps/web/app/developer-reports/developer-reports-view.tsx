"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useMemo } from "react";
import { DashboardSectionLabel } from "../../components/dashboard-welcome-banner";
import { DevNeuPanel, DevStatInline, DevStatRow } from "../../components/developer/developer-ui";
import { DeveloperReportVoiceForm } from "../../components/reporting/developer-report-voice-form";
import { devNeu } from "../../components/developer/developer-theme";
import { formatNairobiDate, formatNairobiDateTime } from "../../lib/nairobi-datetime";
import { useAuth } from "../auth-context";

export type DeveloperReportRow = {
  id: string;
  reportDate: string;
  whatWorked: string | null;
  blockers: string | null;
  needsAttention: string | null;
  implemented: string | null;
  pending: string | null;
  nextPlan: string | null;
  createdAt: string;
  reviewStatus?: string;
  hasAiLeadershipReply?: boolean;
  pendingQuestionsCount?: number;
};

export type OverdueQuestion = {
  id: string;
  reportId: string;
  reportTitle: string;
};

export type ReportFieldKey =
  | "whatWorked"
  | "blockers"
  | "needsAttention"
  | "implemented"
  | "pending"
  | "nextPlan";

export type ReportField = { key: ReportFieldKey; label: string };

function reportPreview(report: DeveloperReportRow): string {
  const parts = [report.whatWorked, report.blockers, report.needsAttention, report.implemented]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  const flat = parts.join(" · ");
  if (!flat) return "No summary yet";
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

function reviewBadge(status: string) {
  if (status === "checked") return { label: "Checked", tone: "emerald" as const };
  if (status === "viewed") return { label: "Viewed", tone: "sky" as const };
  return { label: "Pending", tone: "amber" as const };
}

type DeveloperReportsViewProps = {
  reports: DeveloperReportRow[];
  overdue: OverdueQuestion[];
  directorLabel: string | null;
  loading: boolean;
  loadError: string | null;
  aiPollActive: boolean;
  onRefresh: () => void;
  onNewReport: () => void;
  showForm: boolean;
  onCloseForm: () => void;
  form: Record<ReportFieldKey, string> & { reportDate: string };
  onFormChange: (patch: Partial<DeveloperReportsViewProps["form"]>) => void;
  fields: readonly ReportField[];
  fieldPlaceholders: Record<ReportFieldKey, string>;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  totalFormChars: number;
};

export function DeveloperReportsView({
  reports,
  overdue,
  directorLabel,
  loading,
  loadError,
  aiPollActive,
  onRefresh,
  onNewReport,
  showForm,
  onCloseForm,
  form,
  onFormChange,
  fields,
  fieldPlaceholders,
  onSubmit,
  submitting,
  totalFormChars
}: DeveloperReportsViewProps) {
  const { auth } = useAuth();

  const stats = useMemo(() => {
    const pendingReview = reports.filter((r) => (r.reviewStatus ?? "pending") === "pending").length;
    const openQuestions = reports.reduce((s, r) => s + (r.pendingQuestionsCount ?? 0), 0);
    const reviewed = reports.filter((r) => r.hasAiLeadershipReply).length;
    return { total: reports.length, pendingReview, openQuestions, reviewed };
  }, [reports]);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-5">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/90">
            Developer reports
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            My reports
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            {directorLabel
              ? `Submit one daily report to ${directorLabel}. Filed entries are read-only — leadership reviews and may ask follow-up questions.`
              : "File one daily report per calendar day. Submitted entries are read-only."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${devNeu.navIdle} rounded-lg px-3 py-2 text-xs font-medium text-slate-200 disabled:opacity-50`}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={onNewReport} className={devNeu.btnPrimary}>
            + New report
          </button>
        </div>
      </header>

      {loadError ? (
        <div className={`${devNeu.alertDanger} px-4 py-3 text-sm text-rose-200 sm:px-5`}>{loadError}</div>
      ) : null}

      {aiPollActive ? (
        <div className={`${devNeu.alertInfo} px-4 py-3 text-sm text-violet-200 sm:px-5`}>
          Leadership is reviewing your latest report — check back for comments and questions.
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <div className={`${devNeu.alertWarning} px-4 py-3 sm:px-5`}>
          <p className="font-semibold text-amber-200">
            {overdue.length} open question{overdue.length === 1 ? "" : "s"} past the answer deadline
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {overdue.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/developer-reports/${o.reportId}`} className="text-amber-300 hover:underline">
                  Report {o.reportTitle}
                </Link>
                <span className="text-slate-500"> — answer required</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section aria-label="Report snapshot" className="w-full">
        <DashboardSectionLabel roleKeys={auth.roleKeys}>Report rhythm</DashboardSectionLabel>
        <div className={`mt-3 ${devNeu.kpiStrip}`}>
          <DevStatRow>
            <DevStatInline label="Filed" value={loading ? "…" : stats.total} hint="Total reports" tone="violet" />
            <DevStatInline
              label="Awaiting review"
              value={loading ? "…" : stats.pendingReview}
              hint="Pending leadership"
              tone="amber"
            />
            <DevStatInline
              label="Open questions"
              value={loading ? "…" : stats.openQuestions}
              hint="Need your answer"
              tone={stats.openQuestions > 0 ? "rose" : "sky"}
            />
            <DevStatInline label="Reviewed" value={loading ? "…" : stats.reviewed} hint="Leadership replied" tone="emerald" />
          </DevStatRow>
        </div>
      </section>

      <section aria-label="Report history" className="w-full flex-1">
        <div className="mb-3 flex items-end justify-between gap-2">
          <DashboardSectionLabel roleKeys={auth.roleKeys}>My report history</DashboardSectionLabel>
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {reports.length === 0 && !loading ? (
          <DevNeuPanel inset className="flex min-h-[14rem] flex-col items-center justify-center gap-3 text-center">
            <p className="font-display text-lg font-semibold text-slate-200">No reports yet</p>
            <p className="max-w-sm text-sm text-slate-500">
              Submit your first daily report to keep delivery visible to leadership.
            </p>
            <button type="button" onClick={onNewReport} className={devNeu.btnPrimary}>
              New report
            </button>
          </DevNeuPanel>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reports.map((report) => {
              const status = report.reviewStatus ?? "pending";
              const badge = reviewBadge(status);
              const badgeClass =
                badge.tone === "emerald"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : badge.tone === "sky"
                    ? "border-sky-500/25 bg-sky-500/10 text-sky-300"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-200";
              return (
                <li key={report.id} className={devNeu.panel}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/developer-reports/${report.id}`}
                          className="font-display text-lg font-semibold text-violet-200 hover:text-violet-100 hover:underline"
                        >
                          {formatNairobiDate(report.reportDate)}
                        </Link>
                        <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}>
                          {badge.label}
                        </span>
                        {report.hasAiLeadershipReply ? (
                          <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                            Leadership replied
                          </span>
                        ) : null}
                        {(report.pendingQuestionsCount ?? 0) > 0 ? (
                          <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                            {report.pendingQuestionsCount} open Q
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{reportPreview(report)}</p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        Filed {formatNairobiDateTime(report.createdAt)}
                      </p>
                    </div>
                    <Link
                      href={`/developer-reports/${report.id}`}
                      className={`${devNeu.btnPrimary} inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold`}
                    >
                      Open report →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-report-form-title"
        >
          <div className={`${devNeu.panel} max-h-[90vh] w-full max-w-2xl overflow-y-auto`}>
            <h3 id="dev-report-form-title" className="font-display text-xl font-bold text-violet-200">
              Submit developer report
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Voice filing walks section by section — start with What worked. At least 60 characters total (
              {totalFormChars}/60).
            </p>
            <DeveloperReportVoiceForm
              form={form}
              onFormChange={onFormChange}
              fields={fields}
              fieldPlaceholders={fieldPlaceholders}
              onSubmit={onSubmit}
              onCancel={onCloseForm}
              submitting={submitting}
              totalFormChars={totalFormChars}
              variant="developer"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
