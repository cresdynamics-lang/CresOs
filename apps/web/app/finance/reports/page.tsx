"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";
import { formatMoney } from "../../format-money";
import { financeNeu } from "../../../components/finance/finance-theme";
import { FinanceStatInline, FinanceStatRow } from "../../../components/finance/finance-ui";
import { DashboardSectionLabel } from "../../../components/dashboard-welcome-banner";
import { FINANCE_PAGE_TITLES } from "../finance-nav";
import {
  categoryLabel,
  FINANCE_FEATURE_MAP,
  REPORT_PRESETS,
  reportQueryString,
  type FinancialReportResponse,
  type ReportPreset
} from "../finance-reports-shared";

export default function FinanceReportsPage() {
  const router = useRouter();
  const { apiFetch, auth, hydrated } = useAuth();
  const canAccessFinance = auth.roleKeys.some((r) =>
    ["admin", "finance", "analyst", "director_admin"].includes(r)
  );
  const canSendToAdmin = auth.roleKeys.some((r) => ["admin", "finance"].includes(r));

  const [preset, setPreset] = useState<ReportPreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [note, setNote] = useState("");
  const [report, setReport] = useState<FinancialReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessFinance) router.replace("/dashboard");
  }, [hydrated, auth.accessToken, canAccessFinance, router]);

  const qs = reportQueryString(
    preset,
    preset === "custom" ? customFrom : undefined,
    preset === "custom" ? customTo : undefined
  );

  const loadReport = useCallback(async () => {
    if (!canAccessFinance) return;
    if (preset === "custom" && (!customFrom || !customTo)) {
      setError("Choose a start and end date for custom range.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(`/finance/report?${qs}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to load report");
        setReport(null);
        return;
      }
      setReport((await res.json()) as FinancialReportResponse);
    } catch {
      setError("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, canAccessFinance, qs, preset, customFrom, customTo]);

  const downloadReport = useCallback(
    async (format: "pdf" | "csv") => {
      if (preset === "custom" && (!customFrom || !customTo)) {
        setError("Choose a start and end date for custom range.");
        return;
      }
      setDownloading(format);
      setError(null);
      try {
        const res = await apiFetch(`/finance/report/download?${qs}&format=${format}`);
        if (!res.ok) {
          setError("Download failed");
          return;
        }
        const cd = res.headers.get("content-disposition") ?? "";
        const match = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)"?/i);
        const filename =
          (match?.[1] ? decodeURIComponent(match[1]) : `finance-report.${format}`) ||
          `finance-report.${format}`;
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setNotice(`Downloaded ${format.toUpperCase()} report.`);
      } catch {
        setError("Download failed");
      } finally {
        setDownloading(null);
      }
    },
    [apiFetch, qs, preset, customFrom, customTo]
  );

  const sendToAdmin = useCallback(async () => {
    if (!canSendToAdmin) return;
    if (preset === "custom" && (!customFrom || !customTo)) {
      setError("Choose a start and end date for custom range.");
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch("/finance/report/send-to-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: preset,
          from: preset === "custom" ? customFrom : undefined,
          to: preset === "custom" ? customTo : undefined,
          note: note.trim() || undefined
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        adminCount?: number;
        error?: string;
        reason?: string;
      };
      if (body.sent && body.adminCount) {
        setNotice(`Report emailed to ${body.adminCount} admin${body.adminCount === 1 ? "" : "s"} with PDF attached.`);
      } else if (body.reason === "no_admins") {
        setError("No admin users found to email.");
      } else {
        setError(body.error ?? "Failed to send report to admin.");
      }
    } catch {
      setError("Failed to send report to admin.");
    } finally {
      setSending(false);
    }
  }, [apiFetch, canSendToAdmin, preset, customFrom, customTo, note]);

  useEffect(() => {
    if (hydrated && auth.accessToken && canAccessFinance && preset !== "custom") {
      void loadReport();
    }
  }, [hydrated, auth.accessToken, canAccessFinance, preset]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated || !auth.accessToken) {
    return (
      <div className={`${financeNeu.workspace} flex h-full items-center justify-center text-sm text-slate-400`}>
        Loading…
      </div>
    );
  }

  if (!canAccessFinance) return null;

  const meta = FINANCE_PAGE_TITLES.reports;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <header>
        <DashboardSectionLabel>{meta.title}</DashboardSectionLabel>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{meta.description}</p>
      </header>

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className={`${financeNeu.panel} rounded-2xl border border-white/[0.06] p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-slate-200">Report period</h2>
        <p className="mt-1 text-xs text-slate-500">
          Weekly, monthly, 6 months, yearly, all time, or pick a custom date range.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {REPORT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors touch-manipulation",
                preset === p.value ? financeNeu.navActive : financeNeu.navIdle
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-xs text-slate-400">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={`${financeNeu.input} mt-1 block`}
              />
            </label>
            <label className="block text-xs text-slate-400">
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className={`${financeNeu.input} mt-1 block`}
              />
            </label>
            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Apply range"}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void downloadReport("pdf")}
            disabled={downloading !== null || !report}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {downloading === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={() => void downloadReport("csv")}
            disabled={downloading !== null || !report}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {downloading === "csv" ? "Downloading…" : "Download CSV"}
          </button>
        </div>
      </section>

      {canSendToAdmin && (
        <section className={`${financeNeu.panel} rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold text-sky-200">Send report to admin</h2>
          <p className="mt-1 text-xs text-slate-400">
            Emails all admins a summary with the PDF attached — for director review and records.
          </p>
          <label className="mt-3 block text-xs text-slate-400">
            Optional note for admins
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Monthly close — please review salaries vs payroll"
              className={`${financeNeu.input} mt-1 w-full max-w-xl`}
            />
          </label>
          <button
            type="button"
            onClick={() => void sendToAdmin()}
            disabled={sending || !report}
            className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Email report to admin"}
          </button>
        </section>
      )}

      {report && (
        <section className={`${financeNeu.panel} rounded-2xl border border-white/[0.06] p-4 sm:p-5`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              {report.period.label ?? "Report summary"}
            </h2>
            <p className="text-xs text-slate-500">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>

          <FinanceStatRow>
            <FinanceStatInline label="Payments in (period)" value={formatMoney(report.cashFlow.revenueThisMonth)} />
            <FinanceStatInline label="Expenses out (period)" value={formatMoney(report.cashFlow.expensesThisMonth)} />
            <FinanceStatInline
              label="Net (period)"
              value={formatMoney(report.cashFlow.netThisMonth)}
              tone={report.cashFlow.netThisMonth >= 0 ? "emerald" : "rose"}
            />
            <FinanceStatInline label="All-time net" value={formatMoney(report.derived?.netCashMovementAllTime ?? 0)} />
          </FinanceStatRow>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/90">Money in</p>
              <p className="mt-1 text-sm text-slate-200">Client payments: {formatMoney(report.revenue.thisMonth)}</p>
              <p className="text-xs text-slate-500">All time: {formatMoney(report.revenue.allTime)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">HR & payroll</p>
              <p className="mt-1 text-sm text-slate-200">
                Salaries: {formatMoney(report.salaries?.inPeriod ?? 0)}
              </p>
              <p className="text-xs text-slate-500">{report.salaries?.count ?? 0} salary expense(s) in period</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/90">Project ops</p>
              <p className="mt-1 text-sm text-slate-200">
                Developer payments: {formatMoney(report.developerPayments?.inPeriod ?? 0)}
              </p>
              <p className="text-xs text-slate-500">
                {report.developerPayments?.count ?? 0} developer payment(s) in period
              </p>
            </div>
          </div>

          {report.expensesByCategory && report.expensesByCategory.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Expense breakdown (period)
              </h3>
              <ul className="space-y-1 text-sm">
                {report.expensesByCategory.map((cat) => (
                  <li key={cat.category} className="flex justify-between gap-4 text-slate-300">
                    <span>{categoryLabel(cat.category)}</span>
                    <span className="tabular-nums text-slate-200">{formatMoney(cat.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-3 text-xs text-slate-400 sm:grid-cols-2">
            <p>Outstanding / AR: {formatMoney(report.invoices.outstandingAmount)}</p>
            <p>Overdue invoices: {report.invoices.overdueCount}</p>
            <p>Pending approvals: {report.pending?.total ?? 0}</p>
            <p>Pending payouts: {formatMoney(report.payouts.pendingAmount)}</p>
          </div>
        </section>
      )}

      <section className={`${financeNeu.panel} rounded-2xl border border-white/[0.06] p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-slate-200">Finance feature map</h2>
        <p className="mt-1 text-xs text-slate-500">
          How each workspace area maps to money in, money out, and admin workflows.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-4 font-medium">Area</th>
                <th className="pb-2 pr-4 font-medium">Flow</th>
                <th className="pb-2 pr-4 font-medium">Owner</th>
                <th className="pb-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {FINANCE_FEATURE_MAP.map((row) => (
                <tr key={row.area} className="border-b border-white/[0.04]">
                  <td className="py-2.5 pr-4">
                    <Link href={row.route} className="font-medium text-emerald-300/90 hover:text-emerald-200">
                      {row.area}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{row.direction}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{row.handledBy}</td>
                  <td className="py-2.5 text-slate-300">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
