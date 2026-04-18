import type { PrismaClient } from "@prisma/client";
import { logAdminActivity } from "./admin-activity";
import { ROLE_KEYS } from "./auth-middleware";

/** Director role only — sales/dev-facing governance alerts go here. */
const ROLE_KEY_DIRECTOR = ROLE_KEYS.director;
/** Admin role only — full org visibility mirrors. */
const ROLE_KEY_ADMIN = ROLE_KEYS.admin;

async function getOrgUsersForRoleKeys(
  prisma: PrismaClient,
  orgId: string,
  roleKeys: string[]
): Promise<{ id: string; email: string }[]> {
  if (roleKeys.length === 0) return [];
  const memberIds = (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
  const roles = await prisma.role.findMany({
    where: { orgId, key: { in: roleKeys } },
    select: { id: true }
  });
  if (roles.length === 0) return [];
  const roleIds = roles.map((r) => r.id);
  const matchedUserIds = (await prisma.userRole.findMany({ where: { roleId: { in: roleIds } }, select: { userId: true } })).map(
    (r) => r.userId
  );
  const ids = [...new Set(memberIds.filter((id) => matchedUserIds.includes(id)))];
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, notificationEmail: true }
  });
  return users.map((u) => ({ id: u.id, email: u.notificationEmail?.trim() || u.email }));
}

/**
 * Users with the Director role only (not Admin).
 */
export async function getDirectorUsers(
  prisma: PrismaClient,
  orgId: string
): Promise<{ id: string; email: string }[]> {
  return getOrgUsersForRoleKeys(prisma, orgId, [ROLE_KEY_DIRECTOR]);
}

/**
 * Users with the Admin role only.
 */
export async function getAdminUsers(
  prisma: PrismaClient,
  orgId: string
): Promise<{ id: string; email: string }[]> {
  return getOrgUsersForRoleKeys(prisma, orgId, [ROLE_KEY_ADMIN]);
}

/** User ids with Director or Admin role in the org (for leadership-scoped report automation). */
export async function getDirectorAndAdminUserIds(prisma: PrismaClient, orgId: string): Promise<string[]> {
  const [dirs, admins] = await Promise.all([getDirectorUsers(prisma, orgId), getAdminUsers(prisma, orgId)]);
  return [...new Set([...dirs.map((d) => d.id), ...admins.map((a) => a.id)])];
}

const NOTIFICATION_TYPE = "director.activity";

const ADMIN_VISIBILITY_TYPE = "admin.visibility";

/**
 * In-app copy for Admin users (structural tier) — mirrors org-wide and per-user alerts.
 */
export async function notifyAdminsInApp(
  prisma: PrismaClient,
  orgId: string,
  subject: string,
  body: string,
  options?: { type?: string; tier?: string; excludeUserIds?: string[] }
): Promise<void> {
  const admins = await getAdminUsers(prisma, orgId);
  const skip = new Set(options?.excludeUserIds ?? []);
  const targets = admins.filter((a) => !skip.has(a.id));
  if (targets.length === 0) return;
  const type = options?.type ?? ADMIN_VISIBILITY_TYPE;
  const tier = options?.tier ?? "structural";
  await prisma.notification.createMany({
    data: targets.map((a) => ({
      orgId,
      channel: "in_app",
      to: a.id,
      subject,
      body,
      status: "sent",
      type,
      tier
    }))
  });
}

/**
 * Notify all directors (Director role) by in-app + email; mirror the same message to Admin in-app.
 * Admins receive structural-tier visibility without duplicate email (see notifyAdminsInApp).
 */
export async function notifyDirectors(
  prisma: PrismaClient,
  orgId: string,
  subject: string,
  body: string,
  options?: { type?: string }
): Promise<void> {
  const directors = await getDirectorUsers(prisma, orgId);
  const type = options?.type ?? NOTIFICATION_TYPE;
  const emailSubject = `[CresOS] ${subject}`;
  if (directors.length > 0) {
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
    await logAdminActivity(prisma, {
      orgId,
      type: "email_sent",
      summary: `Email to ${directors.length} director(s): ${subject}`,
      body: body.slice(0, 300) + (body.length > 300 ? "…" : ""),
      metadata: { type, recipientCount: directors.length }
    });
  }
  await notifyAdminsInApp(prisma, orgId, subject, body, {
    type,
    tier: "structural",
    excludeUserIds: directors.map((d) => d.id)
  });
}
