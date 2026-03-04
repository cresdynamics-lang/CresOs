import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { tiersForAuth } from "./role-notifications";

export default function notificationsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // My in-app notifications (for attention / dashboard)
  router.get(
    "/me",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.admin, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const list = await prisma.notification.findMany({
        where: { orgId, channel: "in_app", to: userId },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      res.json(list);
    }
  );

  router.patch(
    "/:id/read",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.admin, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const n = await prisma.notification.findFirst({
        where: { id, orgId, channel: "in_app", to: userId }
      });
      if (!n) return res.status(404).json({ error: "Not found" });
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() }
      });
      res.json({ ok: true });
    }
  );

  router.get(
    "/",
    requireRoles([
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.developer,
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

