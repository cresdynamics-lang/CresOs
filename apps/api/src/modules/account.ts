// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { sendWelcomeEmail } from "../lib/resend";
import { logAdminActivity, logEmailSent } from "./admin-activity";
import bcrypt from "bcryptjs";

export default function accountRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get("/me", async (req, res) => {
    const userId = req.auth!.userId;
    const orgId = req.auth!.orgId;
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
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true }
    });
    res.json({ ...user, org: org ?? { id: orgId, name: null, slug: null } });
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

    const toEmail = user.notificationEmail?.trim() || user.email;
    if (toEmail) {
      const result = await sendWelcomeEmail(toEmail, user.name);
      if (result.ok) {
        const member = await prisma.orgMember.findFirst({
          where: { userId: user.id },
          select: { orgId: true }
        });
        const body = `Thanks for updating your profile. We'll send reminders and updates to this email.`;
        if (member?.orgId) {
          await logEmailSent(prisma, {
            orgId: member.orgId,
            to: toEmail,
            subject: "You're all set — we'll send updates to this email",
            body,
            type: "welcome_profile",
            actorId: user.id
          });
        }
      }
    }

    res.json(user);
  });

  router.post("/change-password", async (req, res) => {
    const userId = req.auth!.userId;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: "Unable to change password" });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordLastChangedAt: new Date()
      }
    });

    const member = await prisma.orgMember.findFirst({
      where: { userId },
      select: { orgId: true }
    });
    if (member?.orgId) {
      await logAdminActivity(prisma, {
        orgId: member.orgId,
        type: "account.password_changed",
        summary: "User changed their password",
        actorId: userId,
        entityType: "user",
        entityId: userId
      });
    }

    res.status(204).send();
  });

  return router;
}
