import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekKey(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return toDateKey(x);
}

function lastNWeekKeys(n: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  for (let i = n - 1; i >= 0; i--) {
    const w = new Date(d);
    w.setDate(w.getDate() - i * 7);
    keys.push(toDateKey(w));
  }
  return keys;
}

function countByWeek<T>(rows: T[], getDate: (r: T) => Date, weeks = 8): { week: string; count: number }[] {
  const keys = lastNWeekKeys(weeks);
  const map = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const k = weekKey(getDate(r));
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return keys.map((week) => ({ week, count: map.get(week) ?? 0 }));
}

async function reportStreakDays(prisma: PrismaClient, userId: string, kind: "sales" | "developer"): Promise<number> {
  const todayKey = toDateKey(new Date());
  const dates =
    kind === "sales"
      ? new Set(
          (await prisma.salesReport.findMany({
            where: { submittedById: userId, status: "submitted", submittedAt: { not: null } },
            select: { submittedAt: true }
          })).map((r) => toDateKey(r.submittedAt!))
        )
      : new Set(
          (await prisma.developerReport.findMany({
            where: { submittedById: userId },
            select: { reportDate: true }
          })).map((r) => toDateKey(r.reportDate))
        );

  if (!dates.has(todayKey)) return 0;
  let streak = 0;
  let d = new Date();
  while (dates.has(toDateKey(d))) {
    streak++;
    d = new Date(d.getTime() - ONE_DAY_MS);
  }
  return streak;
}

export default function analyticsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Simple summary used by the main dashboard
  router.get(
    "/summary",
    requireRoles([
      ROLE_KEYS.admin,
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.analyst
    ]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [
      leadsThisWeek,
      dealsWon,
      revenueReceived,
      invoiceOutstanding,
      activeProjects,
      teamMembers
    ] = await Promise.all([
      prisma.lead.count({
        where: {
          orgId,
          createdAt: { gte: startOfWeek },
          deletedAt: null
        }
      }),
      prisma.deal.count({
        where: {
          orgId,
          stage: "won",
          deletedAt: null
        }
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          orgId,
          deletedAt: null
        }
      }),
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          orgId,
          deletedAt: null,
          OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
        }
      }),
      prisma.project.count({
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["planned", "active"] }
        }
      }),
      prisma.orgMember.count({ where: { orgId } })
    ]);

    res.json({
      leadsThisWeek,
      dealsWon,
      revenueReceived: revenueReceived._sum.amount?.toNumber() ?? 0,
      invoiceOutstanding: invoiceOutstanding._sum.totalAmount?.toNumber() ?? 0,
      activeProjects,
      teamMembers
    });
    }
  );

  // CEO-level dashboard: revenue, projects, lead conversion, workload
  router.get(
    "/ceo",
    requireRoles([
      ROLE_KEYS.admin,
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.analyst
    ]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueThisMonth,
      outstandingInvoices,
      overdueInvoices,
      expensesThisMonth,
      activeProjects,
      overdueTasks,
      blockedTasks,
      milestonesDone,
      milestonesPending,
      leadsThisMonth,
      dealsWon,
      dealsLost,
      wonDealsForCycle,
      taskWorkload,
      overdueTaskWorkload
    ] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          orgId,
          deletedAt: null,
          receivedAt: { gte: startOfMonth }
        }
      }),
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          orgId,
          deletedAt: null,
          OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
        }
      }),
      prisma.invoice.count({
        where: {
          orgId,
          deletedAt: null,
          status: "overdue"
        }
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["approved", "paid"] },
          spentAt: { gte: startOfMonth }
        }
      }),
      prisma.project.count({
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["planned", "active"] }
        }
      }),
      prisma.task.count({
        where: {
          orgId,
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: now }
        }
      }),
      prisma.task.count({
        where: {
          orgId,
          deletedAt: null,
          status: "blocked"
        }
      }),
      prisma.milestone.count({
        where: { orgId, deletedAt: null, status: "completed" }
      }),
      prisma.milestone.count({
        where: {
          orgId,
          deletedAt: null,
          status: { not: "completed" }
        }
      }),
      prisma.lead.count({
        where: {
          orgId,
          deletedAt: null,
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.deal.count({
        where: { orgId, deletedAt: null, stage: "won" }
      }),
      prisma.deal.count({
        where: { orgId, deletedAt: null, stage: "lost" }
      }),
      prisma.deal.findMany({
        where: {
          orgId,
          deletedAt: null,
          stage: "won",
          closeDate: { not: null }
        },
        select: { createdAt: true, closeDate: true }
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        _count: { _all: true },
        where: { orgId, deletedAt: null }
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        _count: { _all: true },
        where: {
          orgId,
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: now }
        }
      })
    ]);

    const totalClosed = dealsWon + dealsLost;
    const winRate = totalClosed > 0 ? dealsWon / totalClosed : 0;

    const avgTimeToCloseDays =
      wonDealsForCycle.length > 0
        ? wonDealsForCycle.reduce((sum, d) => {
            const close = d.closeDate as Date;
            const diffMs = close.getTime() - d.createdAt.getTime();
            return sum + diffMs / (1000 * 60 * 60 * 24);
          }, 0) / wonDealsForCycle.length
        : 0;

    const workloadByUser: Record<
      string,
      { tasks: number; overdueTasks: number }
    > = {};
    taskWorkload.forEach((row) => {
      workloadByUser[row.assigneeId ?? "unassigned"] = {
        tasks: row._count._all,
        overdueTasks: 0
      };
    });
    overdueTaskWorkload.forEach((row) => {
      const key = row.assigneeId ?? "unassigned";
      if (!workloadByUser[key]) {
        workloadByUser[key] = { tasks: 0, overdueTasks: 0 };
      }
      workloadByUser[key].overdueTasks = row._count._all;
    });

    res.json({
      revenueHealth: {
        revenueReceivedThisMonth:
          revenueThisMonth._sum.amount?.toNumber() ?? 0,
        outstandingInvoices:
          outstandingInvoices._sum.totalAmount?.toNumber() ?? 0,
        overdueInvoiceCount: overdueInvoices,
        expensesThisMonth: expensesThisMonth._sum.amount?.toNumber() ?? 0
      },
      projectHealth: {
        activeProjects,
        overdueTasks,
        blockedTasks,
        milestonesDone,
        milestonesPending
      },
      leadConversion: {
        leadsThisMonth,
        dealsWon,
        dealsLost,
        winRate,
        avgTimeToCloseDays
      },
      teamWorkload: workloadByUser
    });
  });

  // Director / analyst operational analytics (no finance metrics)
  router.get(
    "/director",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const fourteenDaysAgo = new Date(Date.now() - 14 * ONE_DAY_MS);
      const thirtyDaysAgo = new Date(Date.now() - 30 * ONE_DAY_MS);
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

      const [
        projects,
        taskGroups,
        tasks,
        leads,
        deals,
        salesReportsMonth,
        devReportsMonth,
        salesReports90d,
        devReports90d,
        users,
        taskCompletedEvents14d,
        tasksByAssigneeActive,
        handoffs30d,
        projectsStale72h,
        blockedTasksOld,
        stalledDeals,
        activeProjectsRecent
      ] = await Promise.all([
        prisma.project.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, type: true, status: true, approvalStatus: true, updatedAt: true, createdAt: true, endDate: true }
        }),
        prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { orgId, deletedAt: null },
          _count: { _all: true }
        }),
        prisma.task.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, status: true, dueDate: true, updatedAt: true, projectId: true }
        }),
        prisma.lead.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, status: true, approvalStatus: true, createdAt: true }
        }),
        prisma.deal.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, stage: true, createdAt: true, closeDate: true, updatedAt: true }
        }),
        prisma.salesReport.count({
          where: { orgId, status: "submitted", submittedAt: { gte: startOfMonth } }
        }),
        prisma.developerReport.count({
          where: { orgId, reportDate: { gte: startOfMonth } }
        }),
        prisma.salesReport.findMany({
          where: { orgId, status: "submitted", submittedAt: { gte: thirtyDaysAgo, not: null } },
          select: { submittedAt: true }
        }),
        prisma.developerReport.findMany({
          where: { orgId, reportDate: { gte: thirtyDaysAgo } },
          select: { reportDate: true }
        }),
        prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        }),
        prisma.eventLog.findMany({
          where: { orgId, type: "task.completed", createdAt: { gte: fourteenDaysAgo } },
          select: { actorId: true }
        }),
        prisma.task.groupBy({
          by: ["assigneeId"],
          where: { orgId, deletedAt: null, status: { in: ["todo", "not_started", "in_progress", "waiting_response", "blocked"] } },
          _count: { _all: true }
        }),
        prisma.projectHandoffRequest.count({
          where: { orgId, status: "accepted", respondedAt: { gte: thirtyDaysAgo } }
        }),
        prisma.project.findMany({
          where: { orgId, deletedAt: null, status: { in: ["active", "paused"] }, updatedAt: { lt: seventyTwoHoursAgo } },
          select: { id: true, name: true, updatedAt: true }
        }),
        prisma.task.findMany({
          where: { orgId, deletedAt: null, status: "blocked", updatedAt: { lt: seventyTwoHoursAgo } },
          select: { id: true, title: true, projectId: true }
        }),
        prisma.deal.findMany({
          where: { orgId, deletedAt: null, stage: { in: ["prospect", "proposal"] }, updatedAt: { lt: fourteenDaysAgo } },
          select: { id: true, title: true, stage: true }
        }),
        prisma.project.findMany({
          where: { orgId, deletedAt: null, status: { in: ["active", "planned"] } },
          orderBy: { updatedAt: "desc" },
          take: 12,
          select: { id: true, name: true, status: true, approvalStatus: true, updatedAt: true }
        })
      ]);

      const countsByProject: Record<string, { total: number; done: number }> = {};
      for (const p of projects) countsByProject[p.id] = { total: 0, done: 0 };
      for (const row of taskGroups) {
        const pid = row.projectId as string;
        if (!countsByProject[pid]) countsByProject[pid] = { total: 0, done: 0 };
        countsByProject[pid].total += row._count._all;
        if (String(row.status) === "done") countsByProject[pid].done += row._count._all;
      }

      const projectsByStatus: Record<string, number> = {};
      for (const p of projects) {
        const s = p.status ?? "unknown";
        projectsByStatus[s] = (projectsByStatus[s] ?? 0) + 1;
      }

      const completionTop = projects
        .map((p) => {
          const c = countsByProject[p.id] ?? { total: 0, done: 0 };
          return {
            projectId: p.id,
            name: p.name,
            status: p.status,
            completionRate: c.total > 0 ? c.done / c.total : 0,
            totalTasks: c.total,
            doneTasks: c.done
          };
        })
        .filter((p) => p.totalTasks > 0)
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 10);

      const projectsMoving = activeProjectsRecent.map((p) => {
        const c = countsByProject[p.id] ?? { total: 0, done: 0 };
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          approvalStatus: p.approvalStatus,
          completionRate: c.total > 0 ? c.done / c.total : 0,
          updatedAt: p.updatedAt.toISOString()
        };
      });

      const leadsByStatus: Record<string, number> = {};
      const leadsByApproval: Record<string, number> = {};
      for (const l of leads) {
        leadsByStatus[l.status ?? "unknown"] = (leadsByStatus[l.status] ?? 0) + 1;
        const a = l.approvalStatus ?? "unknown";
        leadsByApproval[a] = (leadsByApproval[a] ?? 0) + 1;
      }

      const dealsByStage: Record<string, number> = {};
      for (const d of deals) {
        dealsByStage[d.stage ?? "unknown"] = (dealsByStage[d.stage] ?? 0) + 1;
      }
      const dealsWon = deals.filter((d) => d.stage === "won").length;
      const dealsLost = deals.filter((d) => d.stage === "lost").length;
      const winRate = dealsWon + dealsLost > 0 ? dealsWon / (dealsWon + dealsLost) : 0;

      const completedByDev: Record<string, number> = {};
      for (const e of taskCompletedEvents14d) {
        if (!e.actorId) continue;
        completedByDev[e.actorId] = (completedByDev[e.actorId] ?? 0) + 1;
      }
      const developerVelocity = users
        .map((u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          tasksCompleted14d: completedByDev[u.id] ?? 0
        }))
        .sort((a, b) => b.tasksCompleted14d - a.tasksCompleted14d)
        .slice(0, 12);

      const activeByAssignee: Record<string, number> = {};
      for (const row of tasksByAssigneeActive) {
        const key = row.assigneeId ?? "unassigned";
        activeByAssignee[key] = row._count._all;
      }
      const developerLoad = users
        .map((u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          activeTasks: activeByAssignee[u.id] ?? 0
        }))
        .sort((a, b) => b.activeTasks - a.activeTasks)
        .slice(0, 12);

      const reportStreaks = await Promise.all(
        users.slice(0, 20).map(async (u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          salesReportStreakDays: await reportStreakDays(prisma, u.id, "sales"),
          developerReportStreakDays: await reportStreakDays(prisma, u.id, "developer")
        }))
      );

      const overdueTasks = tasks.filter(
        (t) => t.status !== "done" && t.dueDate && t.dueDate.getTime() < now.getTime()
      ).length;
      const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
      const leadsThisMonth = leads.filter((l) => l.createdAt >= startOfMonth).length;

      res.json({
        overview: {
          activeProjects: projects.filter((p) => ["active", "planned"].includes(p.status)).length,
          overdueTasks,
          blockedTasks,
          leadsThisMonth,
          dealsWon,
          dealsLost,
          winRate,
          salesReportsThisMonth: salesReportsMonth,
          developerReportsThisMonth: devReportsMonth,
          handoffs30d: handoffs30d
        },
        projects: {
          byStatus: Object.entries(projectsByStatus).map(([status, count]) => ({ status, count })),
          completionTop,
          createdByWeek: countByWeek(projects, (p) => p.createdAt),
          moving: projectsMoving
        },
        leads: {
          byStatus: Object.entries(leadsByStatus).map(([status, count]) => ({ status, count })),
          byApproval: Object.entries(leadsByApproval).map(([approvalStatus, count]) => ({ approvalStatus, count })),
          createdByWeek: countByWeek(leads, (l) => l.createdAt)
        },
        pipeline: {
          dealsByStage: Object.entries(dealsByStage).map(([stage, count]) => ({ stage, count })),
          wonLost: { won: dealsWon, lost: dealsLost }
        },
        team: {
          developerVelocity,
          developerLoad,
          reportStreaks: reportStreaks.sort(
            (a, b) =>
              b.salesReportStreakDays +
              b.developerReportStreakDays -
              (a.salesReportStreakDays + a.developerReportStreakDays)
          )
        },
        reports: {
          salesByWeek: countByWeek(
            salesReports90d.filter((r) => r.submittedAt),
            (r) => r.submittedAt as Date
          ),
          developerByWeek: countByWeek(devReports90d, (r) => r.reportDate)
        },
        risks: {
          staleProjects72h: projectsStale72h.length,
          blockedTasks72h: blockedTasksOld.length,
          stalledDeals14d: stalledDeals.length
        }
      });
    }
  );

  // Admin extended dashboard — operational analytics (aggregates + lists)
  router.get(
    "/admin-extended",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(Date.now() - 14 * ONE_DAY_MS);
      const thirtyDaysAgo = new Date(Date.now() - 30 * ONE_DAY_MS);
      const ninetyDaysAgo = new Date(Date.now() - 90 * ONE_DAY_MS);

      const [
        projects,
        taskGroups,
        closedDeals,
        developerUsers,
        tasksByAssigneeActive,
        taskCompletedEvents14d,
        handoffsAccepted30d,
        repeatHandoffs90d,
        projectsStale72h,
        blockedTasksOld,
        stalledDeals,
        salesAndDevUsers
      ] = await Promise.all([
        prisma.project.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, type: true, status: true, approvalStatus: true, updatedAt: true, endDate: true, createdAt: true }
        }),
        prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { orgId, deletedAt: null },
          _count: { _all: true }
        }),
        prisma.deal.findMany({
          where: {
            orgId,
            deletedAt: null,
            stage: { in: ["won", "lost"] },
            closeDate: { not: null }
          },
          select: { createdAt: true, closeDate: true, stage: true }
        }),
        prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        }),
        prisma.task.groupBy({
          by: ["assigneeId"],
          where: { orgId, deletedAt: null, status: { in: ["todo", "not_started", "in_progress", "waiting_response", "blocked"] } },
          _count: { _all: true }
        }),
        prisma.eventLog.findMany({
          where: { orgId, type: "task.completed", createdAt: { gte: fourteenDaysAgo } },
          select: { actorId: true, createdAt: true }
        }),
        prisma.projectHandoffRequest.count({
          where: { orgId, status: "accepted", respondedAt: { gte: thirtyDaysAgo } }
        }),
        prisma.projectHandoffRequest.findMany({
          where: { orgId, status: "accepted", respondedAt: { gte: ninetyDaysAgo } },
          select: { projectId: true }
        }),
        prisma.project.findMany({
          where: { orgId, deletedAt: null, status: { in: ["active", "paused"] }, updatedAt: { lt: seventyTwoHoursAgo } },
          select: { id: true, name: true, updatedAt: true, status: true }
        }),
        prisma.task.findMany({
          where: { orgId, deletedAt: null, status: "blocked", updatedAt: { lt: seventyTwoHoursAgo } },
          select: { id: true, title: true, projectId: true, updatedAt: true }
        }),
        prisma.deal.findMany({
          where: { orgId, deletedAt: null, stage: { in: ["prospect", "proposal"] }, updatedAt: { lt: fourteenDaysAgo } },
          select: { id: true, title: true, stage: true, updatedAt: true, value: true }
        }),
        prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        })
      ]);

      // Completion rates per project
      const countsByProject: Record<string, { total: number; done: number }> = {};
      for (const p of projects) countsByProject[p.id] = { total: 0, done: 0 };
      for (const row of taskGroups) {
        const pid = row.projectId as string;
        if (!countsByProject[pid]) countsByProject[pid] = { total: 0, done: 0 };
        const c = row._count._all;
        countsByProject[pid].total += c;
        if (String(row.status) === "done") countsByProject[pid].done += c;
      }
      const completionRates = projects
        .map((p) => {
          const c = countsByProject[p.id] ?? { total: 0, done: 0 };
          const rate = c.total > 0 ? c.done / c.total : 0;
          return { projectId: p.id, name: p.name, approvalStatus: p.approvalStatus, status: p.status, totalTasks: c.total, doneTasks: c.done, completionRate: rate };
        })
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 25);

      // Avg days to close
      const avgDaysToClose =
        closedDeals.length === 0
          ? 0
          : closedDeals.reduce((s, d) => s + (((d.closeDate as Date).getTime() - d.createdAt.getTime()) / ONE_DAY_MS), 0) / closedDeals.length;

      // Delay frequency by project type (past endDate & not completed)
      const delayedByType: Record<string, number> = {};
      for (const p of projects) {
        const type = p.type ?? "unknown";
        const isDelayed = !!(p.endDate && p.endDate.getTime() < now.getTime() && p.status !== "completed");
        if (isDelayed) delayedByType[type] = (delayedByType[type] ?? 0) + 1;
      }

      // Module velocity per developer (tasks completed events in last 14d)
      const completedByDev: Record<string, number> = {};
      for (const e of taskCompletedEvents14d) {
        if (!e.actorId) continue;
        completedByDev[e.actorId] = (completedByDev[e.actorId] ?? 0) + 1;
      }
      const moduleVelocityPerDeveloper = developerUsers
        .map((u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          tasksCompleted14d: completedByDev[u.id] ?? 0
        }))
        .sort((a, b) => b.tasksCompleted14d - a.tasksCompleted14d)
        .slice(0, 25);

      // Team analytics: active load and streaks
      const activeTasksByAssignee: Record<string, number> = {};
      for (const row of tasksByAssigneeActive) {
        const key = row.assigneeId ?? "unassigned";
        activeTasksByAssignee[key] = row._count._all;
      }
      const perUserLoad = salesAndDevUsers
        .map((u) => ({ userId: u.id, name: u.name, email: u.email, activeTasks: activeTasksByAssignee[u.id] ?? 0 }))
        .sort((a, b) => b.activeTasks - a.activeTasks);
      const loads = perUserLoad.map((u) => u.activeTasks).sort((a, b) => a - b);
      const median = loads.length ? loads[Math.floor(loads.length / 2)] : 0;
      const overload = perUserLoad.filter((u) => u.activeTasks >= Math.max(10, median * 2)).slice(0, 10);
      const underutilised = perUserLoad.filter((u) => u.activeTasks <= Math.floor(median / 3)).slice(0, 10);

      const reportStreaks = await Promise.all(
        salesAndDevUsers.slice(0, 30).map(async (u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          salesReportStreakDays: await reportStreakDays(prisma, u.id, "sales"),
          developerReportStreakDays: await reportStreakDays(prisma, u.id, "developer")
        }))
      );

      // Repeat swap patterns: projects with >=2 accepted handoffs in 90d
      const handoffCountByProject = new Map<string, number>();
      for (const h of repeatHandoffs90d) {
        handoffCountByProject.set(h.projectId, (handoffCountByProject.get(h.projectId) ?? 0) + 1);
      }
      const repeatSwapPatterns = Array.from(handoffCountByProject.entries())
        .filter(([, c]) => c >= 2)
        .map(([projectId, count]) => {
          const p = projects.find((x) => x.id === projectId);
          return { projectId, projectName: p?.name ?? projectId, count90d: count };
        })
        .sort((a, b) => b.count90d - a.count90d)
        .slice(0, 10);

      res.json({
        projectAnalytics: {
          completionRates,
          avgDaysToClose,
          moduleVelocityPerDeveloper,
          delayFrequencyByProjectType: delayedByType
        },
        teamAnalytics: {
          developerUtilisationSignals: perUserLoad.slice(0, 20),
          swapHandoffFrequency30d: handoffsAccepted30d,
          overloadPatterns: { medianActiveTasks: median, overloaded: overload, underutilised },
          reportStreakPerUser: reportStreaks.sort((a, b) => (b.salesReportStreakDays + b.developerReportStreakDays) - (a.salesReportStreakDays + a.developerReportStreakDays))
        },
        riskAnalytics: {
          projectsNoUpdate72h: projectsStale72h,
          blockedTasksAbove72h: blockedTasksOld,
          stalledDeals14d: stalledDeals,
          repeatSwapPatterns
        }
      });
    }
  );

  // Red flag view for Director-only alerts
  router.get(
    "/red-flags",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();

      const fourteenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 14
      );
      const sevenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );
      const previous14Start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 28
      );

      const [
        overdueInvoices,
        longBlockedTasks,
        recentExpenses,
        previousExpenses,
        paymentsThisPeriod,
        paymentsPreviousPeriod,
        overloadedAssignees
      ] = await Promise.all([
        // Invoice overdue > 14 days
        prisma.invoice.findMany({
          where: {
            orgId,
            deletedAt: null,
            status: "overdue",
            dueDate: { lt: fourteenDaysAgo }
          },
          select: { id: true, number: true, clientId: true, dueDate: true }
        }),
        // Tasks blocked > 7 days
        prisma.task.findMany({
          where: {
            orgId,
            deletedAt: null,
            status: "blocked",
            updatedAt: { lt: sevenDaysAgo }
          },
          select: { id: true, projectId: true, title: true, updatedAt: true }
        }),
        // Expenses last 14 days
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["approved", "paid"] },
            spentAt: { gte: fourteenDaysAgo }
          }
        }),
        // Expenses previous 14 days
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["approved", "paid"] },
            spentAt: { gte: previous14Start, lt: fourteenDaysAgo }
          }
        }),
        // Revenue this 30 days
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            receivedAt: { gte: fourteenDaysAgo }
          }
        }),
        // Revenue previous 30 days
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            orgId,
            deletedAt: null,
            receivedAt: { gte: previous14Start, lt: fourteenDaysAgo }
          }
        }),
        // Team overload: many active tasks
        prisma.task.groupBy({
          by: ["assigneeId"],
          _count: { _all: true },
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["todo", "in_progress", "blocked"] }
          }
        })
      ]);

      const expenseCurrent =
        recentExpenses._sum.amount?.toNumber() ?? 0;
      const expensePrev =
        previousExpenses._sum.amount?.toNumber() ?? 0;
      const expenseSpike =
        expensePrev > 0 && expenseCurrent > expensePrev * 1.5;

      const revenueCurrent =
        paymentsThisPeriod._sum.amount?.toNumber() ?? 0;
      const revenuePrev =
        paymentsPreviousPeriod._sum.amount?.toNumber() ?? 0;
      const revenueDrop =
        revenuePrev > 0 && revenueCurrent < revenuePrev * 0.8;

      const teamOverload = overloadedAssignees.filter(
        (row) => row._count._all > 20
      );

      res.json({
        invoiceOverdue: {
          hasIssue: overdueInvoices.length > 0,
          items: overdueInvoices
        },
        projectBlocked: {
          hasIssue: longBlockedTasks.length > 0,
          items: longBlockedTasks
        },
        expenseSpike: {
          hasIssue: expenseSpike,
          currentWindow: expenseCurrent,
          previousWindow: expensePrev
        },
        revenueDrop: {
          hasIssue: revenueDrop,
          currentWindow: revenueCurrent,
          previousWindow: revenuePrev
        },
        teamOverload: {
          hasIssue: teamOverload.length > 0,
          assignees: teamOverload
        }
      });
    }
  );

  return router;
}

