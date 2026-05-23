// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { notifyAdminsInApp } from "./director-notifications";

export default function directorReportsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Director: list own reports; Admin: all submitted director reports
  router.get(
    "/",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);

      const list = await prisma.directorReport.findMany({
        where: isAdmin
          ? { orgId, status: "submitted" }
          : { orgId, submittedById: userId },
        orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
        include: isAdmin
          ? { submittedBy: { select: { id: true, name: true, email: true } } }
          : undefined
      });
      res.json(list);
    }
  );

  router.post(
    "/",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { title, body } = req.body as { title?: string; body?: string };
      if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: "Title and body are required" });
        return;
      }
      const report = await prisma.directorReport.create({
        data: {
          orgId,
          submittedById: userId,
          title: title.trim(),
          body: body.trim(),
          status: "draft"
        }
      });
      res.status(201).json(report);
    }
  );

  router.get(
    "/:id",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const { id } = req.params;

      const report = await prisma.directorReport.findFirst({
        where: { id, orgId },
        include: { submittedBy: { select: { id: true, name: true, email: true } } }
      });
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      if (!isAdmin && report.submittedById !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      res.json(report);
    }
  );

  router.patch(
    "/:id",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { title, body } = req.body as { title?: string; body?: string };

      const existing = await prisma.directorReport.findFirst({
        where: { id, orgId, submittedById: userId, status: "draft" }
      });
      if (!existing) {
        res.status(404).json({ error: "Draft report not found" });
        return;
      }
      const updated = await prisma.directorReport.update({
        where: { id },
        data: {
          title: title?.trim() ?? existing.title,
          body: body?.trim() ?? existing.body
        }
      });
      res.json(updated);
    }
  );

  router.post(
    "/:id/submit",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;

      const existing = await prisma.directorReport.findFirst({
        where: { id, orgId, submittedById: userId, status: "draft" }
      });
      if (!existing) {
        res.status(404).json({ error: "Draft report not found" });
        return;
      }
      const updated = await prisma.directorReport.update({
        where: { id },
        data: {
          status: "submitted",
          submittedAt: new Date(),
          reviewStatus: "pending"
        }
      });

      await notifyAdminsInApp(
        prisma,
        orgId,
        "Director report submitted",
        `${existing.title} — awaiting admin review`,
        { type: "director.report.submitted", tier: "structural" }
      );

      res.json(updated);
    }
  );

  router.patch(
    "/:id/review",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;
      const { reviewStatus, remarks } = req.body as { reviewStatus?: string; remarks?: string };

      const report = await prisma.directorReport.findFirst({
        where: { id, orgId, status: "submitted" }
      });
      if (!report) {
        res.status(404).json({ error: "Submitted report not found" });
        return;
      }
      const allowed = ["viewed", "checked", "pending"];
      const status = allowed.includes(reviewStatus ?? "") ? reviewStatus! : "viewed";

      const updated = await prisma.directorReport.update({
        where: { id },
        data: {
          reviewStatus: status,
          reviewedAt: new Date(),
          reviewedById: adminId,
          remarks: remarks?.trim() || report.remarks
        }
      });
      res.json(updated);
    }
  );

  return router;
}
