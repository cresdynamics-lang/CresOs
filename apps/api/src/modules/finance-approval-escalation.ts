/**
 * Pending finance approvals (expense/payout) older than 24h → in-app escalation to Admin.
 * Idempotent: at most one escalation notification per approval per admin per 24h window.
 */
import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

async function getAdminUserIds(prisma: PrismaClient, orgId: string): Promise<string[]> {
  const role = await prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.admin } });
  if (!role) return [];
  const withRole = (await prisma.userRole.findMany({ where: { roleId: role.id }, select: { userId: true } })).map(
    (r) => r.userId
  );
  const members = (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
  return [...new Set(withRole.filter((id) => members.includes(id)))];
}

export async function processFinanceApprovalEscalations(prisma: PrismaClient, orgId: string): Promise<void> {
  const cutoff = new Date(Date.now() - TWENTY_FOUR_H_MS);
  const stale = await prisma.approval.findMany({
    where: {
      orgId,
      status: "pending",
      entityType: { in: ["expense", "payout"] },
      createdAt: { lt: cutoff }
    },
    include: {
      requester: { select: { name: true, email: true } }
    }
  });

  if (stale.length === 0) return;

  const adminUserIds = await getAdminUserIds(prisma, orgId);
  if (adminUserIds.length === 0) return;

  const since = new Date(Date.now() - TWENTY_FOUR_H_MS);

  for (const approval of stale) {
    const ageHours = Math.floor((Date.now() - approval.createdAt.getTime()) / (60 * 60 * 1000));
    const subjectKey = `esc:${approval.id}`;

    for (const userId of adminUserIds) {
      const already = await prisma.notification.findFirst({
        where: {
          orgId,
          channel: "in_app",
          to: userId,
          type: "finance_approval_escalation",
          subject: subjectKey,
          createdAt: { gte: since }
        }
      });
      if (already) continue;

      await prisma.notification.create({
        data: {
          orgId,
          channel: "in_app",
          to: userId,
          subject: subjectKey,
          body: `Escalation: Finance ${approval.entityType} approval pending ${ageHours}+ hours. Review in Approvals — ${approval.reason ?? "no note"}.`,
          status: "sent",
          type: "finance_approval_escalation",
          tier: "governance"
        }
      });
    }
  }
}
