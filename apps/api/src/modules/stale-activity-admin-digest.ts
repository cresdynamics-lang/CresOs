import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";
import { notifyAdminsInApp } from "./director-notifications";

/** Rolling window for “recent” activity (reports + current focus). */
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const DIGEST_TYPE = "admin_stale_activity_digest";

function isWithinWindow(d: Date | null | undefined): boolean {
  if (!d) return false;
  return Date.now() - d.getTime() < TWELVE_HOURS_MS;
}

async function userIdsWithRoleInOrg(prisma: PrismaClient, orgId: string, roleKey: string): Promise<string[]> {
  const memberIds = (
    await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })
  ).map((m) => m.userId);
  if (memberIds.length === 0) return [];
  const role = await prisma.role.findFirst({
    where: { orgId, key: roleKey },
    select: { id: true }
  });
  if (!role) return [];
  const allowed = new Set(memberIds);
  const withRole = await prisma.userRole.findMany({
    where: { roleId: role.id },
    select: { userId: true }
  });
  return [...new Set(withRole.map((u) => u.userId).filter((id) => allowed.has(id)))];
}

/**
 * If any sales or developer in the org has neither updated current focus nor filed the relevant report
 * within the last 12 hours (server time), notify all admins once per 12h per org (deduped).
 */
export async function processStaleActivityAdminDigest(prisma: PrismaClient, orgId: string): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: {
      orgId,
      type: DIGEST_TYPE,
      createdAt: { gte: new Date(Date.now() - TWELVE_HOURS_MS) }
    }
  });
  if (recent) return;

  const [salesIds, devIds] = await Promise.all([
    userIdsWithRoleInOrg(prisma, orgId, ROLE_KEYS.sales),
    userIdsWithRoleInOrg(prisma, orgId, ROLE_KEYS.developer)
  ]);
  const tracked = [...new Set([...salesIds, ...devIds])];
  if (tracked.length === 0) return;

  const staleLines: string[] = [];

  for (const uid of tracked) {
    const isSales = salesIds.includes(uid);
    const isDev = devIds.includes(uid);

    const user = await prisma.user.findFirst({
      where: { id: uid, deletedAt: null },
      select: { id: true, name: true, email: true, currentFocusUpdatedAt: true }
    });
    if (!user) continue;

    const focusOk = isWithinWindow(user.currentFocusUpdatedAt);

    const lastSales = isSales
      ? await prisma.salesReport.findFirst({
          where: { orgId, submittedById: uid, status: "submitted", submittedAt: { not: null } },
          orderBy: { submittedAt: "desc" },
          select: { submittedAt: true }
        })
      : null;
    const salesOk = lastSales?.submittedAt ? isWithinWindow(lastSales.submittedAt) : false;

    const lastDev = isDev
      ? await prisma.developerReport.findFirst({
          where: { orgId, submittedById: uid },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true }
        })
      : null;
    const devOk = lastDev?.createdAt ? isWithinWindow(lastDev.createdAt) : false;

    const label = user.name?.trim() || user.email;
    const issues: string[] = [];
    if (isSales && !focusOk && !salesOk) {
      issues.push("no sales report submitted in the last 12 hours and no current-focus update in that window");
    }
    if (isDev && !focusOk && !devOk) {
      issues.push("no developer report filed in the last 12 hours and no current-focus update in that window");
    }
    if (issues.length > 0) {
      staleLines.push(`${label}: ${issues.join("; ")}`);
    }
  }

  if (staleLines.length === 0) return;

  await notifyAdminsInApp(
    prisma,
    orgId,
    "Team activity — 12-hour check",
    `Based on server time, the following people have not updated current focus nor filed a required report in the last 12 hours:\n\n${staleLines
      .map((l) => `• ${l}`)
      .join("\n")}\n\nA current-focus update or a submitted report within the window satisfies the check.`,
    { type: DIGEST_TYPE, tier: "structural" }
  );
}
