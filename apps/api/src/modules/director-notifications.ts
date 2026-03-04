import type { PrismaClient } from "@prisma/client";
import { logAdminActivity } from "./admin-activity";

const ROLE_KEYS_DIRECTOR = ["director_admin", "admin"];

/**
 * Get all users in the org who have director or admin role (for email notifications).
 */
export async function getDirectorUsers(
  prisma: PrismaClient,
  orgId: string
): Promise<{ id: string; email: string }[]> {
  const memberIds = (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
  const roles = await prisma.role.findMany({
    where: { orgId, key: { in: ROLE_KEYS_DIRECTOR } },
    select: { id: true }
  });
  if (roles.length === 0) return [];
  const roleIds = roles.map((r) => r.id);
  const directorUserIds = (await prisma.userRole.findMany({ where: { roleId: { in: roleIds } }, select: { userId: true } })).map((r) => r.userId);
  const ids = [...new Set(memberIds.filter((id) => directorUserIds.includes(id)))];
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, notificationEmail: true }
  });
  return users.map((u) => ({ id: u.id, email: u.notificationEmail?.trim() || u.email }));
}

const NOTIFICATION_TYPE = "director.activity";

/**
 * Notify all directors in the org by in-app notification and email (queued).
 * Each director receives one in_app and one email notification.
 */
export async function notifyDirectors(
  prisma: PrismaClient,
  orgId: string,
  subject: string,
  body: string,
  options?: { type?: string }
): Promise<void> {
  const directors = await getDirectorUsers(prisma, orgId);
  if (directors.length === 0) return;
  const type = options?.type ?? NOTIFICATION_TYPE;
  const emailSubject = `[CresOS] ${subject}`;
  await prisma.notification.createMany({
    data: directors.flatMap((d) => [
      {
        orgId,
        channel: "in_app",
        to: d.id,
        subject,
        body,
        status: "sent",
        type,
        tier: "governance"
      },
      {
        orgId,
        channel: "email",
        to: d.email,
        subject: emailSubject,
        body,
        status: "queued",
        type,
        tier: "governance"
      }
    ])
  });
  if (directors.length > 0) {
    await logAdminActivity(prisma, {
      orgId,
      type: "email_sent",
      summary: `Email to ${directors.length} director(s): ${subject}`,
      body: body.slice(0, 300) + (body.length > 300 ? "…" : ""),
      metadata: { type, recipientCount: directors.length }
    });
  }
}
