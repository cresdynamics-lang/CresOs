// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { tiersForAuth } from "./role-notifications";
import { parseNotificationPreferences } from "../lib/notification-preferences";

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

  async function inAppWhereBase(
    orgId: string,
    userId: string
  ): Promise<Prisma.NotificationWhereInput | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true }
    });
    const prefs = parseNotificationPreferences(user?.notificationPreferences);
    if (prefs.muteAllInApp) {
      return null;
    }
    const where: Prisma.NotificationWhereInput = {
      orgId,
      channel: "in_app",
      to: userId
    };
    if (prefs.mutedTiers.length > 0) {
      where.tier = { notIn: prefs.mutedTiers };
    }
    return where;
  }

  // In-app notifications for current user (respects notification preferences)
  router.get(
    "/me",
    requireRoles(ALL_APP_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const where = await inAppWhereBase(orgId, userId);
      if (!where) {
        res.json([]);
        return;
      }
      const list = await prisma.notification.findMany({
        where,
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
      const where = await inAppWhereBase(orgId, userId);
      if (!where) {
        res.json({ count: 0 });
        return;
      }
      const count = await prisma.notification.count({
        where: {
          ...where,
          readAt: null
        }
      });
      res.json({ count });
    }
  );

  // Mark all visible in-app notifications as read (respects mute filters)
  router.patch(
    "/me/read-all",
    requireRoles(ALL_APP_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const where = await inAppWhereBase(orgId, userId);
      if (!where) {
        res.json({ updated: 0 });
        return;
      }
      const result = await prisma.notification.updateMany({
        where: {
          ...where,
          readAt: null
        },
        data: { readAt: new Date() }
      });
      res.json({ updated: result.count });
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
      const where = await inAppWhereBase(orgId, userId);
      if (!where) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const existing = await prisma.notification.findFirst({
        where: { id, ...where }
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
