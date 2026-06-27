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

  /** Live workspace analytics — finance / director / admin (charts + AI-style predictions). */
  router.get(
    "/live-insights",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const roleKeys = req.auth!.roleKeys ?? [];
      const isAdmin = roleKeys.includes(ROLE_KEYS.admin);
      const isDirector = roleKeys.includes(ROLE_KEYS.director);
      const isFinance = roleKeys.includes(ROLE_KEYS.finance);
      const view: "admin" | "director" | "finance" = isAdmin
        ? "admin"
        : isDirector
          ? "director"
          : "finance";

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * ONE_DAY_MS);

      const [
        invoices,
        payments8w,
        expenses8w,
        projects,
        taskGroups,
        overdueTasksList,
        clients,
        invoicePayments,
        salesReports90d,
        devReports90d,
        handoffs30d,
        users,
        taskCompletedEvents14d,
        tasksByAssigneeActive,
        chatMessages30d
      ] = await Promise.all([
        prisma.invoice.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, status: true, totalAmount: true, clientId: true, dueDate: true, issueDate: true }
        }),
        prisma.payment.findMany({
          where: { orgId, deletedAt: null, receivedAt: { gte: eightWeeksAgo } },
          select: { amount: true, receivedAt: true }
        }),
        prisma.expense.findMany({
          where: { orgId, deletedAt: null, spentAt: { gte: eightWeeksAgo }, status: { in: ["approved", "paid"] } },
          select: { amount: true, spentAt: true }
        }),
        prisma.project.findMany({
          where: { orgId, deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            endDate: true,
            price: true,
            amountReceived: true
          }
        }),
        prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { orgId, deletedAt: null },
          _count: { _all: true }
        }),
        prisma.task.findMany({
          where: {
            orgId,
            deletedAt: null,
            status: { not: "done" },
            dueDate: { lt: now }
          },
          select: { id: true, projectId: true, title: true, dueDate: true },
          take: 50
        }),
        prisma.client.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        }),
        prisma.payment.findMany({
          where: { orgId, deletedAt: null, invoiceId: { not: null } },
          select: { invoiceId: true, amount: true }
        }),
        prisma.salesReport.findMany({
          where: { orgId, status: "submitted", submittedAt: { gte: eightWeeksAgo } },
          select: { submittedAt: true }
        }),
        prisma.developerReport.findMany({
          where: { orgId, reportDate: { gte: eightWeeksAgo } },
          select: { reportDate: true }
        }),
        prisma.projectHandoffRequest.count({
          where: { orgId, status: "accepted", respondedAt: { gte: new Date(now.getTime() - 30 * ONE_DAY_MS) } }
        }),
        prisma.user.findMany({
          where: { orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        }),
        prisma.eventLog.findMany({
          where: { orgId, type: "task.completed", createdAt: { gte: new Date(now.getTime() - 14 * ONE_DAY_MS) } },
          select: { actorId: true }
        }),
        prisma.task.groupBy({
          by: ["assigneeId"],
          where: {
            orgId,
            deletedAt: null,
            status: { in: ["todo", "not_started", "in_progress", "waiting_response", "blocked"] }
          },
          _count: { _all: true }
        }),
        prisma.message.count({
          where: {
            deletedAt: null,
            createdAt: { gte: new Date(now.getTime() - 30 * ONE_DAY_MS) },
            conversation: { orgId }
          }
        })
      ]);

      const paidByInvoice = new Map<string, number>();
      for (const p of invoicePayments) {
        if (!p.invoiceId) continue;
        paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + Number(p.amount));
      }

      const invoiceStatusAmount: Record<string, number> = {};
      let totalOutstanding = 0;
      let overdueDebt = 0;
      const debtAlerts: {
        clientId: string;
        clientName: string;
        amountDue: number;
        overdueInvoices: number;
      }[] = [];

      const clientDebt = new Map<string, { amountDue: number; overdue: number }>();
      for (const inv of invoices) {
        const amt = Number(inv.totalAmount);
        invoiceStatusAmount[inv.status] = (invoiceStatusAmount[inv.status] ?? 0) + amt;
        const paid = paidByInvoice.get(inv.id) ?? 0;
        const remaining = Math.max(0, amt - paid);
        if (["sent", "partial", "overdue"].includes(inv.status)) {
          totalOutstanding += remaining;
          if (inv.clientId) {
            const cur = clientDebt.get(inv.clientId) ?? { amountDue: 0, overdue: 0 };
            cur.amountDue += remaining;
            if (inv.status === "overdue" || (inv.dueDate && inv.dueDate < now)) cur.overdue += 1;
            clientDebt.set(inv.clientId, cur);
          }
          if (inv.status === "overdue" || (inv.dueDate && inv.dueDate < now && remaining > 0)) {
            overdueDebt += remaining;
          }
        }
      }

      for (const c of clients) {
        const d = clientDebt.get(c.id);
        if (d && d.amountDue > 0) {
          debtAlerts.push({
            clientId: c.id,
            clientName: c.name,
            amountDue: Math.round(d.amountDue * 100) / 100,
            overdueInvoices: d.overdue
          });
        }
      }
      debtAlerts.sort((a, b) => b.amountDue - a.amountDue);

      const moneyPie = Object.entries(invoiceStatusAmount)
        .filter(([, v]) => v > 0)
        .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));

      const weekKeys = lastNWeekKeys(8);
      const cashFlowWeeks = weekKeys.map((week) => {
        const inn = payments8w
          .filter((p) => weekKey(p.receivedAt) === week)
          .reduce((s, p) => s + Number(p.amount), 0);
        const out = expenses8w
          .filter((e) => weekKey(e.spentAt) === week)
          .reduce((s, e) => s + Number(e.amount), 0);
        return { week, in: Math.round(inn * 100) / 100, out: Math.round(out * 100) / 100 };
      });

      const countsByProject: Record<string, { total: number; done: number; overdue: number }> = {};
      for (const p of projects) countsByProject[p.id] = { total: 0, done: 0, overdue: 0 };
      for (const row of taskGroups) {
        const pid = row.projectId as string;
        if (!countsByProject[pid]) countsByProject[pid] = { total: 0, done: 0, overdue: 0 };
        countsByProject[pid].total += row._count._all;
        if (String(row.status) === "done") countsByProject[pid].done += row._count._all;
      }
      for (const t of overdueTasksList) {
        if (countsByProject[t.projectId]) countsByProject[t.projectId].overdue += 1;
      }

      const projectsByStatus: Record<string, number> = {};
      for (const p of projects) {
        projectsByStatus[p.status ?? "unknown"] = (projectsByStatus[p.status] ?? 0) + 1;
      }

      const slowProjects = projects
        .filter((p) => ["active", "planned", "paused"].includes(p.status))
        .map((p) => {
          const c = countsByProject[p.id] ?? { total: 0, done: 0, overdue: 0 };
          const daysActive = Math.floor((now.getTime() - p.createdAt.getTime()) / ONE_DAY_MS);
          const completionRate = c.total > 0 ? c.done / c.total : 0;
          const pastEnd = p.endDate ? p.endDate < now : false;
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            daysActive,
            completionRate: Math.round(completionRate * 100),
            overdueTasks: c.overdue,
            pastEndDate: pastEnd
          };
        })
        .filter((p) => p.pastEndDate || p.overdueTasks > 0 || (p.daysActive > 45 && p.completionRate < 50))
        .sort((a, b) => b.overdueTasks - a.overdueTasks || b.daysActive - a.daysActive)
        .slice(0, 12);

      const activeWithTasks = projects.filter((p) => {
        const c = countsByProject[p.id];
        return c && c.total > 0;
      });
      const successCount = activeWithTasks.filter((p) => {
        const c = countsByProject[p.id]!;
        return c.done / c.total >= 0.8;
      }).length;
      const projectSuccessRate =
        activeWithTasks.length > 0 ? Math.round((successCount / activeWithTasks.length) * 100) : 0;

      const completionBuckets = { onTrack: 0, atRisk: 0, stalled: 0 };
      for (const p of activeWithTasks) {
        const c = countsByProject[p.id]!;
        const rate = c.done / c.total;
        if (rate >= 0.7) completionBuckets.onTrack += 1;
        else if (rate >= 0.35) completionBuckets.atRisk += 1;
        else completionBuckets.stalled += 1;
      }

      const revenueThisMonth = payments8w
        .filter((p) => p.receivedAt >= startOfMonth)
        .reduce((s, p) => s + Number(p.amount), 0);
      const last4In = cashFlowWeeks.slice(-4).reduce((s, w) => s + w.in, 0);
      const prev4In = cashFlowWeeks.slice(0, 4).reduce((s, w) => s + w.in, 0);
      const revenueTrend = prev4In > 0 ? (last4In - prev4In) / prev4In : 0;
      const projectedNextMonth = Math.round(revenueThisMonth * (1 + revenueTrend * 0.5));

      const aiPredictions: { label: string; detail: string; tone: "emerald" | "amber" | "rose" | "sky" }[] = [];
      if (revenueTrend > 0.08) {
        aiPredictions.push({
          label: "Revenue momentum",
          detail: `Inflows trending up (~${Math.round(revenueTrend * 100)}% vs prior 4 weeks). Projected next month ~KES ${projectedNextMonth.toLocaleString()}.`,
          tone: "emerald"
        });
      } else if (revenueTrend < -0.08) {
        aiPredictions.push({
          label: "Revenue softening",
          detail: `Collections slowed vs prior month. Focus on ${debtAlerts.length} client balance${debtAlerts.length === 1 ? "" : "s"} and overdue follow-up.`,
          tone: "rose"
        });
      }
      if (overdueDebt > 0) {
        aiPredictions.push({
          label: "Debt exposure",
          detail: `KES ${Math.round(overdueDebt).toLocaleString()} overdue or past due date across open invoices.`,
          tone: "rose"
        });
      }
      if (slowProjects.length > 0) {
        aiPredictions.push({
          label: "Delivery risk",
          detail: `${slowProjects.length} project${slowProjects.length === 1 ? "" : "s"} running long or behind — review milestones and overdue tasks.`,
          tone: "amber"
        });
      }
      if (projectSuccessRate >= 70) {
        aiPredictions.push({
          label: "Project success",
          detail: `${projectSuccessRate}% of active projects are ≥80% complete — delivery health is strong.`,
          tone: "emerald"
        });
      }

      let team: {
        engagement: { label: string; value: number }[];
        reportActivity: { week: string; sales: number; developer: number }[];
        velocity: { name: string; tasks14d: number; activeTasks: number }[];
        messages30d: number;
        handoffs30d: number;
      } | undefined;

      if (view === "director" || view === "admin") {
        const completedByDev: Record<string, number> = {};
        for (const e of taskCompletedEvents14d) {
          if (!e.actorId) continue;
          completedByDev[e.actorId] = (completedByDev[e.actorId] ?? 0) + 1;
        }
        const activeByAssignee: Record<string, number> = {};
        for (const row of tasksByAssigneeActive) {
          if (row.assigneeId) activeByAssignee[row.assigneeId] = row._count._all;
        }
        const velocity = users
          .map((u) => ({
            name: u.name?.trim() || u.email,
            tasks14d: completedByDev[u.id] ?? 0,
            activeTasks: activeByAssignee[u.id] ?? 0
          }))
          .sort((a, b) => b.tasks14d - a.tasks14d)
          .slice(0, 8);

        const salesByWeek = countByWeek(
          salesReports90d.filter((r) => r.submittedAt),
          (r) => r.submittedAt as Date
        );
        const devByWeek = countByWeek(devReports90d, (r) => r.reportDate);
        const reportActivity = weekKeys.map((week) => ({
          week,
          sales: salesByWeek.find((w) => w.week === week)?.count ?? 0,
          developer: devByWeek.find((w) => w.week === week)?.count ?? 0
        }));

        team = {
          engagement: [
            { label: "Sales reports (8w)", value: salesReports90d.length },
            { label: "Dev reports (8w)", value: devReports90d.length },
            { label: "Handoffs (30d)", value: handoffs30d },
            { label: "Chat messages (30d)", value: chatMessages30d }
          ],
          reportActivity,
          velocity,
          messages30d: chatMessages30d,
          handoffs30d
        };

        if (view === "director" || view === "admin") {
          const avgVelocity =
            velocity.length > 0 ? velocity.reduce((s, v) => s + v.tasks14d, 0) / velocity.length : 0;
          if (avgVelocity < 2 && velocity.some((v) => v.activeTasks > 5)) {
            aiPredictions.push({
              label: "Team engagement",
              detail: "Task throughput is low while active load is high — check blockers and report cadence.",
              tone: "amber"
            });
          } else if (salesReports90d.length + devReports90d.length >= 8) {
            aiPredictions.push({
              label: "Reporting cadence",
              detail: "Strong report activity this period — leadership visibility is healthy.",
              tone: "sky"
            });
          }
        }
      }

      res.json({
        generatedAt: now.toISOString(),
        view,
        money: {
          pie: moneyPie,
          cashFlowWeeks,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          overdueDebt: Math.round(overdueDebt * 100) / 100,
          debtAlerts: debtAlerts.slice(0, 10)
        },
        projects: {
          byStatus: Object.entries(projectsByStatus).map(([status, count]) => ({ status, count })),
          successRate: projectSuccessRate,
          completionPie: [
            { label: "On track", value: completionBuckets.onTrack },
            { label: "At risk", value: completionBuckets.atRisk },
            { label: "Stalled", value: completionBuckets.stalled }
          ].filter((x) => x.value > 0),
          slowProjects
        },
        team,
        aiPredictions: aiPredictions.slice(0, 5)
      });
    }
  );

  return router;
}

