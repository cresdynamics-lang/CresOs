import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_KEYS } from "../modules/auth-middleware";
import { matchesClientPortalPassword } from "./client-portal-auth";

type LoginUser = Awaited<ReturnType<typeof loadUserWithRoles>>;

async function loadUserWithRoles(prisma: PrismaClient, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      memberships: { include: { org: true, role: true } },
      roles: { include: { role: true } }
    }
  });
}

/**
 * Authenticate a CRM client by email + password (FirstName + financeProjectSeq, e.g. Charles13).
 * Creates or updates the linked User account with the client role when valid.
 */
export async function resolveClientPortalLogin(
  prisma: PrismaClient,
  emailNorm: string,
  password: string
): Promise<LoginUser | null> {
  const clients = await prisma.client.findMany({
    where: {
      email: { equals: emailNorm, mode: "insensitive" },
      deletedAt: null
    },
    include: {
      org: true,
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  for (const client of clients) {
    const project =
      client.projects.find((p) => p.financeProjectSeq != null) ?? client.projects[0];
    const seq = project?.financeProjectSeq;
    if (!project || seq == null) continue;
    if (!matchesClientPortalPassword(client.name, seq, password)) continue;

    const clientRole = await prisma.role.findFirst({
      where: { orgId: client.orgId, key: ROLE_KEYS.client }
    });
    if (!clientRole) continue;

    const passwordHash = await bcrypt.hash(password, 10);

    let user = await prisma.user.findFirst({
      where: {
        email: { equals: emailNorm, mode: "insensitive" },
        orgId: client.orgId,
        deletedAt: null
      }
    });

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: emailNorm,
            name: client.name,
            passwordHash,
            orgId: client.orgId
          }
        });
        await tx.orgMember.create({
          data: {
            orgId: client.orgId,
            userId: created.id,
            roleId: clientRole.id
          }
        });
        return created;
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, name: client.name || user.name }
      });
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: client.orgId, userId: user.id } }
      });
      if (!membership) {
        await prisma.orgMember.create({
          data: { orgId: client.orgId, userId: user.id, roleId: clientRole.id }
        });
      }
    }

    return loadUserWithRoles(prisma, user.id);
  }

  return null;
}
