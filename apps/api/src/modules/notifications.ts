import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { tiersForAuth } from "./role-notifications";

export default function notificationsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get(
    "/",
    requireRoles([
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.ops,
      ROLE_KEYS.sales
    ]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const tiers = tiersForAuth(req.auth);
    const notifications = await prisma.notification.findMany({
      where: {
        orgId,
        tier: { in: tiers }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(notifications);
    }
  );

  return router;
}

