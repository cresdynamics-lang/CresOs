import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function developerReportsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // List: developer = own reports; director/admin = all in org
  router.get(
    "/",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));

      const list = await prisma.developerReport.findMany({
        where: isDirector ? { orgId } : { orgId, submittedById: userId },
        orderBy: { reportDate: "desc" },
        include: isDirector
          ? { submittedBy: { select: { id: true, name: true, email: true } } }
          : undefined
      });
      res.json(list);
    }
  );

  // Create daily report (developer only)
  router.post(
    "/",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const body = req.body as {
        reportDate: string;
        whatWorked?: string;
        blockers?: string;
        needsAttention?: string;
        implemented?: string;
        pending?: string;
        nextPlan?: string;
      };
      const reportDate = body.reportDate ? new Date(body.reportDate) : new Date();
      if (isNaN(reportDate.getTime())) {
        res.status(400).json({ error: "Valid reportDate required" });
        return;
      }
      // Normalize to date only (no time)
      reportDate.setHours(0, 0, 0, 0);

      const existing = await prisma.developerReport.findFirst({
        where: { orgId, submittedById: userId, reportDate }
      });
      if (existing) {
        res.status(400).json({ error: "You already have a report for this date. Update it instead." });
        return;
      }

      const report = await prisma.developerReport.create({
        data: {
          orgId,
          submittedById: userId,
          reportDate,
          whatWorked: body.whatWorked?.trim() || null,
          blockers: body.blockers?.trim() || null,
          needsAttention: body.needsAttention?.trim() || null,
          implemented: body.implemented?.trim() || null,
          pending: body.pending?.trim() || null,
          nextPlan: body.nextPlan?.trim() || null
        }
      });
      res.status(201).json(report);
    }
  );

  // Get one (developer: own; director: any)
  router.get(
    "/:id",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));
      const { id } = req.params;

      const report = await prisma.developerReport.findFirst({
        where: isDirector ? { id, orgId } : { id, orgId, submittedById: userId },
        include: { submittedBy: { select: { id: true, name: true, email: true } } }
      });
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      res.json(report);
    }
  );

  // Update (developer: own only)
  router.patch(
    "/:id",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const body = req.body as {
        whatWorked?: string;
        blockers?: string;
        needsAttention?: string;
        implemented?: string;
        pending?: string;
        nextPlan?: string;
      };

      const existing = await prisma.developerReport.findFirst({
        where: { id, orgId, submittedById: userId }
      });
      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const updated = await prisma.developerReport.update({
        where: { id },
        data: {
          ...(body.whatWorked !== undefined && { whatWorked: body.whatWorked?.trim() || null }),
          ...(body.blockers !== undefined && { blockers: body.blockers?.trim() || null }),
          ...(body.needsAttention !== undefined && { needsAttention: body.needsAttention?.trim() || null }),
          ...(body.implemented !== undefined && { implemented: body.implemented?.trim() || null }),
          ...(body.pending !== undefined && { pending: body.pending?.trim() || null }),
          ...(body.nextPlan !== undefined && { nextPlan: body.nextPlan?.trim() || null })
        }
      });
      res.json(updated);
    }
  );

  // Delete (developer: own; director: any)
  router.delete(
    "/:id",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));
      const { id } = req.params;

      const existing = await prisma.developerReport.findFirst({
        where: isDirector ? { id, orgId } : { id, orgId, submittedById: userId }
      });
      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      await prisma.developerReport.delete({ where: { id } });
      res.status(204).send();
    }
  );

  return router;
}
