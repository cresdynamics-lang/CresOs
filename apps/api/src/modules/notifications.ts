// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { tiersForAuth } from "./role-notifications";

export default function notificationsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  const ALL_APP_ROLES = [
    ROLE_KEYS.director,
    ROLE_KEYS.finance,
    ROLE_KEYS.developer,
    ROLE_KEYS.sales,
    ROLE_KEYS.admin,
    ROLE_KEYS.analyst,
    ROLE_KEYS.client
  ];

  // In-app notifications for current user
  router.get(
    "/me",
    requireRoles(ALL_APP_ROLES),
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

  // Unseen count for bell badge
  router.get(
    "/me/unseen-count",
    requireRoles(ALL_APP_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const count = await prisma.notification.count({
        where: {
          orgId,
          channel: "in_app",
          to: userId,
          readAt: null
        }
      });
      res.json({ count });
    }
  );

  // Mark a single notification as read
  router.patch(
    "/:id/read",
    requireRoles(ALL_APP_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const existing = await prisma.notification.findFirst({
        where: { id, orgId, channel: "in_app", to: userId }
      });
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() }
      });
      res.json({ ok: true });
    }
  );

  // Org-level notification feed filtered by tier (for dashboards, etc.)
  router.get(
    "/",
    requireRoles([
      ROLE_KEYS.director,
      ROLE_KEYS.finance,
      ROLE_KEYS.developer,
      ROLE_KEYS.sales,
      ROLE_KEYS.admin,
      ROLE_KEYS.analyst
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

