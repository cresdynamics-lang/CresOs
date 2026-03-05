import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";

const DEV_OVERDUE_DAYS = 3;
const DEV_OVERDUE_THRESHOLD = 5;
const DEV_BLOCKED_DAYS = 2;
const SALES_STALE_LEAD_DAYS = 5;
const SALES_STALE_LEAD_THRESHOLD = 5;

type RoleKeyArray = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS][];

async function getUserIdsForRoles(
  prisma: PrismaClient,
  orgId: string,
  roleKeys: RoleKeyArray
): Promise<string[]> {
  if (!roleKeys.length) return [];
  const roles = await prisma.role.findMany({
    where: { orgId, key: { in: roleKeys as string[] } },
    select: { id: true }
  });
  if (!roles.length) return [];
  const roleIds = roles.map((r) => r.id);
  const userRoles = await prisma.userRole.findMany({
    where: { roleId: { in: roleIds } },
    select: { userId: true }
  });
  const userIds = [...new Set(userRoles.map((ur) => ur.userId))];
  if (!userIds.length) return [];
  const members = await prisma.orgMember.findMany({
    where: { orgId, userId: { in: userIds } },
    select: { userId: true }
  });
  return [...new Set(members.map((m) => m.userId))];
}

export async function processNegligenceAlerts(
  prisma: PrismaClient,
  orgId: string
): Promise<void> {
  const now = new Date();

  // ---- Developer negligence: many overdue / long-blocked tasks ----
  const developerIds = await getUserIdsForRoles(prisma, orgId, [ROLE_KEYS.developer]);
  const devOverdueCutoff = new Date(now.getTime() - DEV_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
  const devBlockedCutoff = new Date(now.getTime() - DEV_BLOCKED_DAYS * 24 * 60 * 60 * 1000);

  for (const devId of developerIds) {
    const [overdueCount, longBlockedCount] = await Promise.all([
      prisma.task.count({
        where: {
          orgId,
          assigneeId: devId,
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: devOverdueCutoff }
        }
      }),
      prisma.task.count({
        where: {
          orgId,
          assigneeId: devId,
          deletedAt: null,
          status: "blocked",
          updatedAt: { lt: devBlockedCutoff }
        }
      })
    ]);

    if (overdueCount < DEV_OVERDUE_THRESHOLD && longBlockedCount === 0) {
      continue;
    }

    const severity =
      overdueCount >= DEV_OVERDUE_THRESHOLD * 2 || longBlockedCount > 3
        ? "critical"
        : "high";
    const description = `Developer has ${overdueCount} overdue tasks older than ${DEV_OVERDUE_DAYS} days and ${longBlockedCount} long-blocked tasks.`;

    const existingRisk = await prisma.risk.findFirst({
      where: {
        orgId,
        type: "operational",
        ownerUserId: devId,
        status: "open"
      }
    });

    if (!existingRisk) {
      await prisma.risk.create({
        data: {
          orgId,
          type: "operational",
          severity,
          description,
          ownerUserId: devId,
          status: "open",
          source: "automatic"
        }
      });
    }

    const [directorIds, adminIds, devUser] = await Promise.all([
      getUserIdsForRoles(prisma, orgId, [ROLE_KEYS.director]),
      getUserIdsForRoles(prisma, orgId, [ROLE_KEYS.admin]),
      prisma.user.findUnique({
        where: { id: devId },
        select: { name: true, email: true }
      })
    ]);

    const devName = devUser?.name ?? "Developer";

    const notifyTargets: { userIds: string[]; tier: string }[] = [
      { userIds: directorIds, tier: "governance" },
      { userIds: adminIds, tier: "structural" }
    ];

    for (const target of notifyTargets) {
      for (const userId of target.userIds) {
        await prisma.notification.create({
          data: {
            orgId,
            channel: "in_app",
            to: userId,
            subject: `Execution risk: ${devName} has overdue work`,
            body: `${devName} has ${overdueCount} overdue tasks older than ${DEV_OVERDUE_DAYS} days and ${longBlockedCount} tasks blocked for more than ${DEV_BLOCKED_DAYS} days. Review workload, unblock or reassign as needed.`,
            status: "sent",
            type: "negligence_alert.developer",
            tier: target.tier
          }
        });
      }
    }

    await prisma.adminAlert.create({
      data: {
        orgId,
        type: "developer_negligence",
        severity: severity === "critical" ? "critical" : "warning",
        details: {
          developerId: devId,
          overdueCount,
          longBlockedCount,
          detectedAt: now.toISOString()
        }
      }
    });
  }

  // ---- Sales negligence: many stale leads with no follow-up ----
  const salesIds = await getUserIdsForRoles(prisma, orgId, [ROLE_KEYS.sales]);
  const salesStaleCutoff = new Date(
    now.getTime() - SALES_STALE_LEAD_DAYS * 24 * 60 * 60 * 1000
  );

  for (const salesId of salesIds) {
    const leads = await prisma.lead.findMany({
      where: {
        orgId,
        ownerId: salesId,
        deletedAt: null,
        status: { in: ["new", "contacted", "qualified"] },
        createdAt: { lt: salesStaleCutoff }
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { occurredAt: true }
        }
      }
    });

    const staleLeads = leads.filter((lead) => {
      const lastActivity = lead.activities[0]?.occurredAt ?? lead.createdAt;
      return lastActivity < salesStaleCutoff;
    });

    const staleCount = staleLeads.length;
    if (staleCount < SALES_STALE_LEAD_THRESHOLD) continue;

    const severity = staleCount >= SALES_STALE_LEAD_THRESHOLD * 2 ? "high" : "medium";
    const description = `Sales rep has ${staleCount} leads without follow-up in the last ${SALES_STALE_LEAD_DAYS} days.`;

    const existingRisk = await prisma.risk.findFirst({
      where: {
        orgId,
        type: "sales",
        ownerUserId: salesId,
        status: "open"
      }
    });

    if (!existingRisk) {
      await prisma.risk.create({
        data: {
          orgId,
          type: "sales",
          severity,
          description,
          ownerUserId: salesId,
          status: "open",
          source: "automatic"
        }
      });
    }

    const [directorIds, adminIds, salesUser] = await Promise.all([
      getUserIdsForRoles(prisma, orgId, [ROLE_KEYS.director]),
      getUserIdsForRoles(prisma, orgId, [ROLE_KEYS.admin]),
      prisma.user.findUnique({
        where: { id: salesId },
        select: { name: true, email: true }
      })
    ]);

    const salesName = salesUser?.name ?? "Sales rep";

    const notifyTargets: { userIds: string[]; tier: string }[] = [
      { userIds: directorIds, tier: "governance" },
      { userIds: adminIds, tier: "structural" }
    ];

    for (const target of notifyTargets) {
      for (const userId of target.userIds) {
        await prisma.notification.create({
          data: {
            orgId,
            channel: "in_app",
            to: userId,
            subject: `Revenue risk: ${salesName} has stale leads`,
            body: `${salesName} has ${staleCount} leads without activity in the last ${SALES_STALE_LEAD_DAYS} days. Review pipeline discipline and follow-up patterns.`,
            status: "sent",
            type: "negligence_alert.sales",
            tier: target.tier
          }
        });
      }
    }

    await prisma.adminAlert.create({
      data: {
        orgId,
        type: "sales_negligence",
        severity: severity === "high" ? "critical" : "warning",
        details: {
          salesUserId: salesId,
          staleLeadCount: staleCount,
          detectedAt: now.toISOString()
        }
      }
    });
  }
}

