import type { PrismaClient } from "@prisma/client";
import type { AuthContext } from "./auth-middleware";

export async function ensurePermissions(
  prisma: PrismaClient,
  auth: AuthContext | undefined,
  requiredKeys: string[]
): Promise<void> {
  if (!auth) {
    throw new Error("Unauthorized");
  }

  if (requiredKeys.length === 0) {
    return;
  }

  const userId = auth.userId;

  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      orgId: auth.orgId,
      role: {
        users: {
          some: { userId }
        }
      }
    },
    include: {
      permission: true
    }
  });

  const granted = new Set(rolePermissions.map((rp) => rp.permission.key));

  const missing = requiredKeys.filter((key) => !granted.has(key));
  if (missing.length > 0) {
    const error = new Error("Forbidden: missing permissions");
    (error as any).code = "FORBIDDEN";
    throw error;
  }
}

