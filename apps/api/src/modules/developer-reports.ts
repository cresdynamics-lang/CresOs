// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { notifyDirectors } from "./director-notifications";

function totalDeveloperReportContent(body: {
  whatWorked?: string;
  blockers?: string;
  needsAttention?: string;
  implemented?: string;
  pending?: string;
  nextPlan?: string;
}): number {
  const parts = [
    body.whatWorked,
    body.blockers,
    body.needsAttention,
    body.implemented,
    body.pending,
    body.nextPlan
  ];
  return parts.reduce((sum, p) => sum + (p?.trim().length ?? 0), 0);
}

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
        res.status(400).json({
          error:
            "You already have a report for this date. Filed reports are read-only — contact an admin if a correction is needed."
        });
        return;
      }

      const fields = {
        whatWorked: body.whatWorked?.trim() || null,
        blockers: body.blockers?.trim() || null,
        needsAttention: body.needsAttention?.trim() || null,
        implemented: body.implemented?.trim() || null,
        pending: body.pending?.trim() || null,
        nextPlan: body.nextPlan?.trim() || null
      };
      if (totalDeveloperReportContent(fields) < 60) {
        res.status(400).json({
          error:
            "Please add enough detail for leadership: at least 60 characters total across the sections (what worked, blockers, needs attention, etc.)."
        });
        return;
      }

      const report = await prisma.developerReport.create({
        data: {
          orgId,
          submittedById: userId,
          reportDate,
          ...fields
        },
        include: { submittedBy: { select: { name: true, email: true } } }
      });
      const devName = report.submittedBy?.name || report.submittedBy?.email || "Developer";
      const dayKey = reportDate.toISOString().slice(0, 10);
      const recordedAt = report.createdAt.toISOString();
      await notifyDirectors(
        prisma,
        orgId,
        `Developer daily report: ${dayKey}`,
        `${devName} filed a daily report for ${dayKey}.\n\nRecorded at (server, UTC): ${recordedAt}\nReport ID: ${report.id}\n\nDirector and admin can open Developer reports in the app; this timestamp is stored even if you were offline when it was filed.`,
        { type: "developer_report.submitted" }
      );
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

  // Director/Admin: mark developer report as viewed/checked and attach remarks.
  router.patch(
    "/:id/review",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { reviewStatus, remarks } = req.body as { reviewStatus?: string; remarks?: string };

      if (!reviewStatus || !["pending", "viewed", "checked"].includes(reviewStatus)) {
        res.status(400).json({ error: "reviewStatus must be one of: pending, viewed, checked" });
        return;
      }

      const existing = await prisma.developerReport.findFirst({
        where: { id, orgId }
      });
      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const note = (remarks ?? "").trim();
      if (reviewStatus === "checked" && note.length === 0) {
        res.status(400).json({ error: "Remarks are required to mark a report as checked." });
        return;
      }

      const updated = await prisma.developerReport.update({
        where: { id },
        data: {
          reviewStatus,
          reviewedAt: new Date(),
          reviewedById: userId,
          ...(remarks !== undefined && { remarks: note || null })
        },
        include: { submittedBy: { select: { id: true, name: true, email: true } } }
      });
      res.json(updated);
    }
  );

  // Update — leadership only (developers cannot edit filed history)
  router.patch(
    "/:id",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
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
        where: { id, orgId }
      });
      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const merged = {
        whatWorked:
          body.whatWorked !== undefined ? body.whatWorked?.trim() || null : existing.whatWorked,
        blockers: body.blockers !== undefined ? body.blockers?.trim() || null : existing.blockers,
        needsAttention:
          body.needsAttention !== undefined ? body.needsAttention?.trim() || null : existing.needsAttention,
        implemented:
          body.implemented !== undefined ? body.implemented?.trim() || null : existing.implemented,
        pending: body.pending !== undefined ? body.pending?.trim() || null : existing.pending,
        nextPlan: body.nextPlan !== undefined ? body.nextPlan?.trim() || null : existing.nextPlan
      };
      if (totalDeveloperReportContent(merged) < 60) {
        res.status(400).json({
          error:
            "After this edit, the report would be too thin for leadership (under 60 characters total). Add more detail."
        });
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

  // Delete — leadership only (developers cannot delete filed history)
  router.delete(
    "/:id",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;

      const existing = await prisma.developerReport.findFirst({
        where: { id, orgId }
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
