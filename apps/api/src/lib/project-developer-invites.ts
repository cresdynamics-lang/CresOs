import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";

/** Invite developers to a project (pending accept). Skips invalid users; upserts pending rows. */
export async function inviteDevelopersToProject(
  prisma: PrismaClient,
  opts: {
    orgId: string;
    projectId: string;
    projectName: string;
    invitedById: string;
    userIds: string[];
  }
): Promise<{ invited: number }> {
  const { orgId, projectId, projectName, invitedById } = opts;
  const userIds = [...new Set(opts.userIds.map((x) => String(x).trim()).filter(Boolean))];
  if (userIds.length === 0) return { invited: 0 };

  const developerRole = await prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.developer } });
  if (!developerRole) return { invited: 0 };

  let invited = 0;
  for (const uid of userIds) {
    const hasDev = await prisma.userRole.findFirst({ where: { userId: uid, roleId: developerRole.id } });
    if (!hasDev) continue;
    const row = await prisma.projectDeveloperAssignment
      .upsert({
        where: { projectId_userId: { projectId, userId: uid } },
        create: {
          orgId,
          projectId,
          userId: uid,
          status: "pending",
          invitedById
        },
        update: { status: "pending", invitedById, respondedAt: null }
      })
      .catch(() => null);
    if (!row) continue;
    invited += 1;
    await prisma.notification.create({
      data: {
        orgId,
        channel: "in_app",
        to: uid,
        subject: "Project assignment",
        body: `You were invited to work on "${projectName}". Open Projects to accept or decline.`,
        status: "sent",
        type: "project.assignment",
        tier: "execution"
      }
    });
  }
  return { invited };
}

export async function userDisplayLabel(
  prisma: PrismaClient,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });
  if (!u) return null;
  return u.name?.trim() || u.email || null;
}
