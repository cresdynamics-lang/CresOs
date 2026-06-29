"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import type { ScheduleKpiStats } from "../../components/schedule-kpi-strip";
import type { PmIntelligenceData } from "../../components/pm/pm-smart-brief";
import { sumDirectMessageUnread } from "../../lib/community-unread";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";
import { usePmWorkspaceCompanion } from "../../components/workspace/interactive-welcome-hero";
import {
  PmOverviewDashboard,
  type PmOverviewKpis,
  type PmProjectChartRow,
  type PmQueueStats
} from "./pm-overview-dashboard";

type Overview = {
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  overdueMilestones: number;
  pendingCheckIns: number;
  reportsToday: number;
};

type PmProjectApi = {
  id: string;
  name: string;
  status?: string;
  managementProgressPercent?: number;
  milestones?: { status?: string; dueDate?: string }[];
};

const EMPTY_QUEUE: PmQueueStats = {
  communityUnread: 0,
  unreadNotifications: 0,
  messagesToRespond: 0,
  dueToday: 0,
  visibleProjects: 0,
  workProgressPercent: 0,
  reportsToday: 0,
  openTasks: 0,
  atRiskCount: 0,
  criticalCount: 0
};

function milestoneOverdue(milestones: PmProjectApi["milestones"]): number {
  const now = Date.now();
  return (milestones ?? []).filter((m) => {
    if (!m.dueDate) return false;
    if (m.status === "completed" || m.status === "cancelled") return false;
    return new Date(m.dueDate).getTime() < now;
  }).length;
}

export default function PmPage() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [intel, setIntel] = useState<PmIntelligenceData | null>(null);
  const [queue, setQueue] = useState<PmQueueStats>(EMPTY_QUEUE);
  const [kpis, setKpis] = useState<PmOverviewKpis | null>(null);
  const [projects, setProjects] = useState<PmProjectChartRow[]>([]);
  const [scheduleKpis, setScheduleKpis] = useState<ScheduleKpiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [intelLoading, setIntelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchSending, setBatchSending] = useState(false);

  const { companion, loading: companionLoading } = usePmWorkspaceCompanion(apiFetch, canAccess);

  const load = useCallback(async () => {
    if (!canAccess) {
      setLoading(false);
      setIntelLoading(false);
      return;
    }
    setLoading(true);
    setIntelLoading(true);
    setError(null);
    try {
      const [ovRes, intelRes, projectsRes, schedRes, attentionRes, convRes] = await Promise.all([
        apiFetch("/pm/overview"),
        apiFetch("/pm/intelligence"),
        apiFetch("/pm/projects"),
        apiFetch("/schedule?period=week&completed=all"),
        apiFetch("/dashboard/attention"),
        apiFetch("/chat-community/conversations")
      ]);

      let ov: Overview | null = null;
      if (ovRes.ok) ov = (await ovRes.json()) as Overview;
      else throw new Error("Failed to load PM overview");
      setOverview(ov);

      let intelData: PmIntelligenceData | null = null;
      if (intelRes.ok) intelData = (await intelRes.json()) as PmIntelligenceData;
      setIntel(intelData);
      setIntelLoading(false);

      const healthByProject = new Map(
        (intelData?.priorities ?? []).map((p) => [p.projectId, p.healthScore])
      );

      let projectRows: PmProjectApi[] = [];
      if (projectsRes.ok) {
        const raw = await projectsRes.json();
        projectRows = Array.isArray(raw) ? raw : [];
      }

      const chartProjects: PmProjectChartRow[] = projectRows.map((p) => {
        const milestones = p.milestones ?? [];
        const completed = milestones.filter((m) => m.status === "completed").length;
        return {
          id: p.id,
          name: p.name,
          healthScore: healthByProject.get(p.id) ?? intelData?.orgSummary.averageHealth ?? 0,
          managementProgressPercent: p.managementProgressPercent ?? 0,
          status: p.status ?? "unknown",
          milestoneTotal: milestones.length,
          milestoneCompleted: completed,
          overdueMilestones: milestoneOverdue(milestones)
        };
      });
      setProjects(chartProjects);

      let communityUnread = 0;
      if (convRes.ok) {
        const j = (await convRes.json()) as {
          data?: { conversations?: { type?: string; unreadCount?: number }[] };
        };
        communityUnread = sumDirectMessageUnread(j.data?.conversations ?? []);
      }

      let unreadNotifications = 0;
      let workProgressPercent = intelData?.orgSummary.averageHealth ?? 0;
      if (attentionRes.ok) {
        const attention = (await attentionRes.json()) as {
          stats?: { notificationsCount?: number; workProgressPercent?: number };
          notifications?: { readAt?: string | null }[];
        };
        unreadNotifications =
          attention.stats?.notificationsCount ??
          attention.notifications?.filter((n) => !n.readAt).length ??
          0;
        if (typeof attention.stats?.workProgressPercent === "number" && attention.stats.workProgressPercent > 0) {
          workProgressPercent = attention.stats.workProgressPercent;
        }
      }

      const avgDelivery =
        chartProjects.length > 0
          ? Math.round(
              chartProjects.reduce((s, p) => s + p.managementProgressPercent, 0) / chartProjects.length
            )
          : 0;

      setQueue({
        communityUnread,
        unreadNotifications,
        messagesToRespond: ov.pendingCheckIns,
        dueToday: ov.overdueMilestones,
        visibleProjects: ov.totalProjects,
        workProgressPercent,
        reportsToday: ov.reportsToday,
        openTasks: ov.openTasks,
        atRiskCount: intelData?.orgSummary.atRiskCount ?? 0,
        criticalCount: intelData?.orgSummary.criticalCount ?? 0
      });

      setKpis({
        activeProjects: ov.activeProjects,
        totalProjects: ov.totalProjects,
        openTasks: ov.openTasks,
        overdueMilestones: ov.overdueMilestones,
        pendingCheckIns: ov.pendingCheckIns,
        reportsToday: ov.reportsToday,
        orgHealth: intelData?.orgSummary.averageHealth ?? 0,
        avgDelivery,
        silentDevelopers: intelData?.orgSummary.silentDevelopers ?? 0
      });

      if (schedRes.ok) {
        const sched = (await schedRes.json()) as { stats?: ScheduleKpiStats };
        setScheduleKpis(sched.stats ?? null);
      } else {
        setScheduleKpis(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PM data");
      setIntelLoading(false);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, canAccess]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const sendDailyBatch = async () => {
    setBatchSending(true);
    try {
      const res = await apiFetch("/pm/check-ins/daily-batch", { method: "POST" });
      if (!res.ok) throw new Error("Batch send failed");
      await load();
    } catch {
      setError("Could not send daily check-ins");
    } finally {
      setBatchSending(false);
    }
  };

  if (!canAccess) return null;

  return (
    <PmOverviewDashboard
      overview={overview}
      intel={intel}
      queue={queue}
      kpis={kpis}
      projects={projects}
      scheduleKpis={scheduleKpis}
      loading={loading}
      intelLoading={intelLoading}
      error={error}
      batchSending={batchSending}
      onRefresh={() => void load()}
      onSendDailyBatch={() => void sendDailyBatch()}
      companion={companion}
      companionLoading={companionLoading}
    />
  );
}
