import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";

export default function accountRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get("/me", async (req, res) => {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        notificationEmail: true,
        profileCompletedAt: true,
        status: true
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  router.patch("/me", async (req, res) => {
    const userId = req.auth!.userId;
    const body = req.body as {
      name?: string;
      phone?: string;
      notificationEmail?: string | null;
    };
    const data: { name?: string; phone?: string; notificationEmail?: string | null; profileCompletedAt?: Date } = {};
    if (body.name !== undefined) data.name = body.name?.trim() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.notificationEmail !== undefined) data.notificationEmail = body.notificationEmail?.trim() || null;
    data.profileCompletedAt = new Date();
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        notificationEmail: true,
        profileCompletedAt: true
      }
    });
    res.json(user);
  });

  return router;
}
