"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../app/auth-context";
import { formatMoney } from "../../app/format-money";
import { DashboardSectionLabel } from "../dashboard-welcome-banner";
import { WorkspaceDashboardIntro } from "../workspace-dashboard-intro";
import {
  DeveloperDashboardSections,
  type DeveloperProgressReminder
} from "../developer-dashboard";
import { devGlass } from "./developer-glass-theme";

type Attention = {
  notifications?: {
    id: string;
    subject: string | null;
    body: string;
    readAt: string | null;
    createdAt: string;
  }[];
  stats?: { developerReportStreakDays?: number };
  overdueTasks?: { id: string; title: string; projectId: string; dueDate: string }[];
  developerProgressReminders?: DeveloperProgressReminder[];
};

export function DeveloperHome() {
  const { apiFetch, auth } = useAuth();
  const [attention, setAttention] = useState<Attention | null>(null);
  const [pendingDevPaymentAck, setPendingDevPaymentAck] = useState<
    { id: string; amount: string | number; spentAt: string; description: string | null; currency?: string }[]
  >([]);

  const load = useCallback(async () => {
    try {
      const [attnRes, payRes] = await Promise.all([
        apiFetch("/dashboard/attention"),
        apiFetch("/finance/expenses/pending-my-acknowledgment")
      ]);
      if (attnRes.ok) setAttention((await attnRes.json()) as Attention);
      if (payRes.ok) {
        const rows = (await payRes.json()) as typeof pendingDevPaymentAck;
        setPendingDevPaymentAck(Array.isArray(rows) ? rows : []);
      }
    } catch {
      /* optional */
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const acknowledgeDevPayment = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/finance/expenses/${id}/developer-acknowledge`, {
        method: "POST"
      });
      if (res.ok) void load();
    },
    [apiFetch, load]
  );

  const developerReportStreak = attention?.stats?.developerReportStreakDays ?? 0;
  const overdueTasks = attention?.overdueTasks ?? [];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-8">
      <WorkspaceDashboardIntro
        title="Developer"
        description="Delivery queue, reports, and team context in one workspace."
        eyebrow="Developer"
        welcomeChildren={
          <>
            <DashboardSectionLabel roleKeys={auth.roleKeys}>
              Today&apos;s priorities (your queue)
            </DashboardSectionLabel>
            <p className="font-body text-sm leading-relaxed text-slate-400">
              Use <span className="font-medium text-violet-300/90">Tasks</span> and{" "}
              <span className="font-medium text-violet-300/90">Reports</span> below for live delivery data.
            </p>
          </>
        }
      />

      {pendingDevPaymentAck.length > 0 && (
        <div className={devGlass.alertWarning}>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
            Confirm developer payments (finance)
          </p>
          <p className="mt-1 text-xs text-amber-100/90">
            Finance recorded a payment to you — confirm so the ledger stays aligned.
          </p>
          <ul className="mt-3 space-y-2">
            {pendingDevPaymentAck.map((row) => (
              <li key={row.id} className={`flex flex-wrap items-center justify-between gap-2 ${devGlass.listRow}`}>
                <span className="text-slate-100">
                  {formatMoney(Number(row.amount))}
                  {row.currency && row.currency !== "KES" ? ` ${row.currency}` : ""} ·{" "}
                  {row.description?.trim() || "Developer payment"} · {new Date(row.spentAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={() => void acknowledgeDevPayment(row.id)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                >
                  Confirm receipt
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DeveloperDashboardSections
        apiFetch={apiFetch}
        onRefreshAttention={() => void load()}
        developerReportStreak={developerReportStreak}
        overdueTasks={overdueTasks}
        notifications={attention?.notifications ?? []}
        progressReminders={attention?.developerProgressReminders ?? []}
      />
    </section>
  );
}
