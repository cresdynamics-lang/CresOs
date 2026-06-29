"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { DashboardSectionLabel, resolveRoleTheme } from "../dashboard-welcome-banner";
import type { StatTone } from "../stat-card";
import { dashboardNeu } from "./dashboard-theme";
import {
  DashboardNeuKpiTile,
  DashboardQueueEmpty,
  DashboardQueueItem,
  DashboardQueueList
} from "./dashboard-neu-ui";
import {
  InteractiveWelcomeHero,
  type WorkspaceCompanionData
} from "../workspace/interactive-welcome-hero";

export type DashboardActionCard = {
  href: string;
  title: string;
  value: number;
  sub: string;
  tone: "sky" | "amber" | "rose" | "emerald";
};

type DashboardCommandHeroProps = {
  firstName: string;
  roleLabel: string;
  roleKeys: string[];
  welcomeItems: ReactElement[];
  description: string;
  actionCards: DashboardActionCard[];
  unreadCount: number;
  messagesCount: number;
  dueCount: number;
  workProgress: number;
  reportStreak: number;
  communityUnread: number;
  projectsCount: number;
  messageJumpHref: string;
  showReportStreak: boolean;
  canViewKpis: boolean;
  onRefreshAlerts: () => void;
  onRefreshProjects: () => void;
  onRefreshKpis?: () => void;
  companion: WorkspaceCompanionData | null;
  companionLoading?: boolean;
};

function toStatTone(tone: DashboardActionCard["tone"]): StatTone {
  if (tone === "rose") return "rose";
  if (tone === "amber") return "amber";
  if (tone === "emerald") return "emerald";
  return "sky";
}

export function DashboardCommandHero({
  firstName,
  roleLabel,
  roleKeys,
  welcomeItems,
  description,
  actionCards,
  unreadCount,
  messagesCount,
  dueCount,
  workProgress,
  reportStreak,
  communityUnread,
  projectsCount,
  messageJumpHref,
  showReportStreak,
  canViewKpis,
  onRefreshAlerts,
  onRefreshProjects,
  onRefreshKpis,
  companion,
  companionLoading = false
}: DashboardCommandHeroProps) {
  const theme = resolveRoleTheme(roleKeys);
  const roleSpecific = actionCards.filter((c) => !["Community", "Projects"].includes(c.title));

  const displayCompanion: WorkspaceCompanionData =
    companion ?? {
      firstName,
      sessionStartedAt: new Date().toISOString(),
      serverSessionMinutes: 0,
      work: {
        pendingCheckIns: messagesCount,
        criticalProjects: 0,
        atRiskProjects: 0,
        overdueMilestones: dueCount,
        reportsToday: 0,
        openTasks: 0,
        orgHealth: workProgress,
        activeProjects: projectsCount
      },
      companionLine: `Nice to have you in the workspace today, ${firstName}.`,
      nudges: [],
      aiLine: null,
      aiGenerated: false
    };

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <InteractiveWelcomeHero
        roleKeys={roleKeys}
        roleLabel={roleLabel}
        companion={displayCompanion}
        loading={companionLoading}
      >
        <DashboardSectionLabel roleKeys={roleKeys}>Today&apos;s priorities</DashboardSectionLabel>
        {welcomeItems.length > 0 ? (
          <DashboardQueueList>
            {welcomeItems.map((item, i) => (
              <DashboardQueueItem key={item.key ?? i}>{item}</DashboardQueueItem>
            ))}
          </DashboardQueueList>
        ) : (
          <DashboardQueueEmpty>
            Your automatic priority queue is clear. Use the command center below for live signals and quick actions.
          </DashboardQueueEmpty>
        )}
      </InteractiveWelcomeHero>

      <section className={dashboardNeu.panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={dashboardNeu.eyebrow}>Command center</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
              Dashboard
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              <span className={`font-medium ${theme.roleText}`}>Operating System for Growth</span>
              {" — "}
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" className={dashboardNeu.btnGhost} onClick={onRefreshAlerts}>
              Refresh alerts
            </button>
            <button type="button" className={dashboardNeu.btnGhost} onClick={onRefreshProjects}>
              Refresh projects
            </button>
            {canViewKpis && onRefreshKpis ? (
              <button type="button" className={dashboardNeu.btnGhost} onClick={onRefreshKpis}>
                Refresh KPIs
              </button>
            ) : null}
          </div>
        </div>

        <div className={`mt-5 ${dashboardNeu.kpiGrid}`}>
          <DashboardNeuKpiTile
            label="Community"
            value={communityUnread}
            hint="Unread notifs"
            tone={communityUnread > 0 ? "sky" : "brand"}
            href="/community"
            active={communityUnread > 0}
          />
          <DashboardNeuKpiTile
            label="Projects"
            value={projectsCount}
            hint="Visible"
            tone="emerald"
            href="/projects"
            active={projectsCount > 0}
          />
          <DashboardNeuKpiTile
            label="Notifications"
            value={unreadCount}
            hint="Unread"
            tone={unreadCount > 0 ? "rose" : "sky"}
            href="/community"
            active={unreadCount > 0}
          />
          <DashboardNeuKpiTile
            label="Messages"
            value={messagesCount}
            hint="To respond"
            tone={messagesCount > 0 ? "amber" : "sky"}
            href={messageJumpHref}
            active={messagesCount > 0}
          />
        </div>

        <div className={`mt-3 ${dashboardNeu.kpiGrid}`}>
          <DashboardNeuKpiTile
            label="Due today"
            value={dueCount}
            hint="Follow-ups"
            tone={dueCount > 0 ? "amber" : "sky"}
            href="/schedule"
            active={dueCount > 0}
          />
          <DashboardNeuKpiTile
            label="Work progress"
            value={workProgress}
            hint="Delivery"
            tone="violet"
            visual="bar"
            active={workProgress > 0}
          />
          {showReportStreak ? (
            <DashboardNeuKpiTile
              label="Report streak"
              value={reportStreak}
              hint="Days"
              tone="emerald"
              href="/reports"
              active={reportStreak > 0}
            />
          ) : null}
          {roleSpecific.slice(0, showReportStreak ? 1 : 2).map((c) => (
            <DashboardNeuKpiTile
              key={`${c.href}-${c.title}`}
              label={c.title}
              value={c.value}
              hint={c.sub}
              tone={toStatTone(c.tone)}
              href={c.href}
              active={c.value > 0}
            />
          ))}
        </div>

        <div className={`mt-4 ${dashboardNeu.tasksStrip}`}>
          <p className="text-sm text-slate-400">
            Backlog and reminders live in{" "}
            <span className="font-medium text-slate-200">Tasks</span> — plan your week and clear overdue work there.
          </p>
          <Link href="/schedule" className={`${dashboardNeu.btnPrimary} shrink-0 text-center`}>
            Open Tasks →
          </Link>
        </div>
      </section>
    </div>
  );
}
