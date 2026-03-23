import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

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

