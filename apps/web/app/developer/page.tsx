"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import type { DeveloperProgressReminder } from "../../components/developer-dashboard";
import {
  DeveloperOverviewDashboard,
  type DevProjectRow,
  type DevQueueStats
} from "./developer-overview-dashboard";

const EMPTY_QUEUE: DevQueueStats = {
  assignedProjects: 0,
  overdueTasks: 0,
  blockedTasks: 0,
  avgProgress: 0,
  reportStreakDays: 0,
  workProgressPercent: 0,
  unreadNotifications: 0
};

type Attention = {
  notifications?: { readAt?: string | null }[];
  stats?: {
    developerReportStreakDays?: number;
    workProgressPercent?: number;
    tasksOverdue?: number;
    tasksDueSoon?: number;
    notificationsCount?: number;
    needsAttentionCount?: number;
  };
  reportReminderDue?: boolean;
  developerProgressReminders?: DeveloperProgressReminder[];
};

type AnalyticsPayload = {
  projects?: DevProjectRow[];
  totals?: {
    assigned?: number;
    overdue?: number;
    blocked?: number;
    avgProgress?: number;
  };
};

export default function DeveloperPage() {
  const { apiFetch, auth, hydrated } = useAuth();
  const [queue, setQueue] = useState<DevQueueStats>(EMPTY_QUEUE);
  const [projects, setProjects] = useState<DevProjectRow[]>([]);
  const [scheduleKpis, setScheduleKpis] = useState<ScheduleKpiStats | null>(null);
  const [reportReminderDue, setReportReminderDue] = useState(false);
  const [progressReminders, setProgressReminders] = useState<DeveloperProgressReminder[]>([]);
  const [pendingPayments, setPendingPayments] = useState<
    { id: string; amount: string | number; spentAt: string; description: string | null; currency?: string }[]
  >([]);
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [attnRes, analyticsRes, schedRes, payRes] = await Promise.all([
        apiFetch("/dashboard/attention"),
        apiFetch("/dashboard/developer-analytics"),
        apiFetch("/schedule?period=week&completed=all"),
        apiFetch("/finance/expenses/pending-my-acknowledgment")
      ]);

      let analytics: AnalyticsPayload | null = null;
      if (analyticsRes.ok) {
        const body = (await analyticsRes.json()) as { data?: AnalyticsPayload };
        analytics = body.data ?? null;
        setProjects(analytics?.projects ?? []);
      }

      let nextQueue = { ...EMPTY_QUEUE };

      if (attnRes.ok) {
        const attention = (await attnRes.json()) as Attention;
        const unread =
          attention.stats?.notificationsCount ??
          attention.notifications?.filter((n) => !n.readAt).length ??
          0;
        nextQueue = {
          assignedProjects: analytics?.totals?.assigned ?? analytics?.projects?.length ?? 0,
          overdueTasks: analytics?.totals?.overdue ?? attention.stats?.tasksOverdue ?? 0,
          blockedTasks: analytics?.totals?.blocked ?? 0,
          avgProgress: analytics?.totals?.avgProgress ?? 0,
          reportStreakDays: attention.stats?.developerReportStreakDays ?? 0,
          workProgressPercent: attention.stats?.workProgressPercent ?? 0,
          unreadNotifications: unread
        };
        setReportReminderDue(attention.reportReminderDue === true);
        setProgressReminders(attention.developerProgressReminders ?? []);
      } else if (analytics) {
        nextQueue = {
          assignedProjects: analytics.totals?.assigned ?? analytics.projects?.length ?? 0,
          overdueTasks: analytics.totals?.overdue ?? 0,
          blockedTasks: analytics.totals?.blocked ?? 0,
          avgProgress: analytics.totals?.avgProgress ?? 0,
          reportStreakDays: 0,
          workProgressPercent: 0,
          unreadNotifications: 0
        };
      }

      setQueue(nextQueue);

      if (schedRes.ok) {
        const body = (await schedRes.json()) as { stats?: ScheduleKpiStats };
        setScheduleKpis(body.stats ?? null);
      }

      if (payRes.ok) {
        const rows = (await payRes.json()) as typeof pendingPayments;
        setPendingPayments(Array.isArray(rows) ? rows : []);
      }

      if (!attnRes.ok && !analyticsRes.ok) {
        setLoadError("Could not load dashboard data. Try refresh or check your connection.");
      }
    } catch {
      setLoadError("Could not load dashboard data. Try refresh or check your connection.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, auth.accessToken]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    void load();
  }, [hydrated, auth.accessToken, load]);

  const acknowledgePayment = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/finance/expenses/${id}/developer-acknowledge`, { method: "POST" });
      if (res.ok) void load();
    },
    [apiFetch, load]
  );

  if (!hydrated || !auth.accessToken) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <p className="text-sm text-slate-400">Loading developer dashboard…</p>
      </div>
    );
  }

  return (
    <DeveloperOverviewDashboard
      queue={queue}
      projects={projects}
      scheduleKpis={scheduleKpis}
      reportReminderDue={reportReminderDue}
      progressReminders={progressReminders}
      pendingPayments={pendingPayments}
      loading={loading}
      loadError={loadError}
      onRefresh={() => void load()}
      onAckPayment={(id) => void acknowledgePayment(id)}
      onDismissReminder={(key) => setDismissedReminderKeys((s) => new Set(s).add(key))}
      dismissedReminderKeys={dismissedReminderKeys}
    />
  );
}
