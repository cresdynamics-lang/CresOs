// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { notifyDirectors, getDirectorAndAdminUserIds } from "./director-notifications";
import { getDirectorReportSubmitterIds, isAdminRole, isDirectorOnly } from "../lib/user-capabilities";
import { queueAutoDirectorReplyForDeveloperReport } from "./director-ai-automation";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const MARKED_REVIEWED_LINE = "Marked reviewed. ✓";

const LEADERSHIP_APPEND_SEP =
  "\n\n────────────────────────\nDirector / Admin note\n────────────────────────\n\n";

function mergeAppendedRemarks(prev: string | null | undefined, addition: string): string {
  const p = (prev ?? "").trim();
  const a = addition.trim();
  if (!a) return p;
  return p ? `${p}${LEADERSHIP_APPEND_SEP}${a}` : a;
}

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
      const roleKeys = req.auth!.roleKeys;
      const isLeadership = roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));

      let where: { orgId: string; submittedById?: string | { in: string[] } } = { orgId, submittedById: userId };
      if (isAdminRole(roleKeys)) {
        where = { orgId };
      } else if (isDirectorOnly(roleKeys)) {
        const scoped = await getDirectorReportSubmitterIds(prisma, orgId, userId, ROLE_KEYS.developer);
        where = scoped ? { orgId, submittedById: { in: scoped } } : { orgId };
      }

      const leadershipIds = isLeadership ? await getDirectorAndAdminUserIds(prisma, orgId) : [];

      const list = await prisma.developerReport.findMany({
        where,
        orderBy: { reportDate: "desc" },
        include: isLeadership
          ? {
              submittedBy: { select: { id: true, name: true, email: true } },
              comments: {
                where: { parentId: null },
                select: { authorId: true, source: true, content: true, createdAt: true }
              }
            }
          : undefined
      });

      if (isLeadership) {
        const mapped = list.map((r) => {
          const { comments, ...rest } = r;
          const filedAtMs = r.createdAt ? new Date(r.createdAt).getTime() : 0;
          const hasAiLeadershipReply = (comments ?? []).some(
            (c) =>
              c.source === "ai_auto" ||
              (leadershipIds.includes(c.authorId) &&
                typeof c.content === "string" &&
                c.content.includes(MARKED_REVIEWED_LINE) &&
                filedAtMs > 0 &&
                new Date(c.createdAt).getTime() >= filedAtMs)
          );
          return { ...rest, hasAiLeadershipReply };
        });
        return res.json(mapped);
      }

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
      queueAutoDirectorReplyForDeveloperReport(prisma, report.id);
      res.status(201).json(report);
    }
  );

  // Developer: overdue unanswered questions (alarm) — must be before /:id
  router.get(
    "/alarms/overdue",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const roleKeys = req.auth!.roleKeys;

      let reportWhere: { orgId: string; submittedById?: string | { in: string[] } } = { orgId };
      if (isDirectorOnly(roleKeys)) {
        const scoped = await getDirectorReportSubmitterIds(prisma, orgId, userId, ROLE_KEYS.developer);
        if (scoped) reportWhere = { orgId, submittedById: { in: scoped } };
      } else if (!isAdminRole(roleKeys)) {
        reportWhere = { orgId, submittedById: userId };
      }

      const reports = await prisma.developerReport.findMany({
        where: reportWhere,
        select: { id: true, reportDate: true }
      });
      const reportIds = reports.map((r) => r.id);
      const reportDateById = new Map(reports.map((r) => [r.id, r.reportDate]));

      const questions = await prisma.developerReportComment.findMany({
        where: { reportId: { in: reportIds }, kind: "question", parentId: null },
        orderBy: { createdAt: "asc" }
      });

      const withReplies = await Promise.all(
        questions.map(async (q) => {
          const reply = await prisma.developerReportComment.findFirst({
            where: { parentId: q.id }
          });
          const askedAt = q.createdAt.getTime();
          const deadline = askedAt + TWENTY_FOUR_HOURS_MS;
          const now = Date.now();
          const overdue = !reply && now > deadline;
          const rd = reportDateById.get(q.reportId);
          const reportTitle = rd ? rd.toISOString().slice(0, 10) : "Developer report";
          return {
            id: q.id,
            reportId: q.reportId,
            reportTitle,
            content: q.content,
            askedAt: q.createdAt,
            deadline: new Date(deadline),
            answeredAt: reply?.createdAt ?? null,
            overdue
          };
        })
      );

      const overdueOnly = withReplies.filter((x) => x.overdue);
      res.json({ overdue: overdueOnly, all: withReplies });
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
        include: {
          submittedBy: { select: { id: true, name: true, email: true } },
          comments: {
            include: {
              author: { select: { id: true, email: true, name: true } },
              replies: { include: { author: { select: { id: true, email: true, name: true } } } }
            },
            orderBy: { createdAt: "asc" }
          }
        }
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
      const { reviewStatus, remarks, appendRemarks } = req.body as {
        reviewStatus?: string;
        remarks?: string;
        appendRemarks?: boolean;
      };

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

      const append = appendRemarks === true;
      let nextRemarks: string | null | undefined;
      if (append) {
        const inc = (remarks ?? "").trim();
        if (inc) nextRemarks = mergeAppendedRemarks(existing.remarks, inc);
      } else if (remarks !== undefined) {
        nextRemarks = (remarks ?? "").trim() || null;
      }

      const effectiveRemarks = ((nextRemarks !== undefined ? nextRemarks : existing.remarks) ?? "").trim();
      if (reviewStatus === "checked" && effectiveRemarks.length === 0) {
        const leadershipIds = await getDirectorAndAdminUserIds(prisma, orgId);
        const threadOk =
          (await prisma.developerReportComment.count({
            where: {
              reportId: id,
              parentId: null,
              authorId: { in: leadershipIds },
              createdAt: { gte: existing.createdAt }
            }
          })) > 0;
        if (!threadOk) {
          res.status(400).json({
            error:
              "Add remarks on the report, append a director note, or leave an existing leadership comment on this submission before marking checked."
          });
          return;
        }
      }

      const updated = await prisma.developerReport.update({
        where: { id },
        data: {
          reviewStatus,
          reviewedAt: new Date(),
          reviewedById: userId,
          ...(nextRemarks !== undefined && { remarks: nextRemarks })
        },
        include: { submittedBy: { select: { id: true, name: true, email: true } } }
      });
      res.json(updated);
    }
  );

  // Director: add comment or question. Developer: add response (body: { parentId, content })
  router.post(
    "/:id/comments",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { kind, content, parentId } = req.body as {
        kind?: string;
        content?: string;
        parentId?: string;
      };

      if (!content || !content.trim()) {
        res.status(400).json({ error: "Content is required" });
        return;
      }

      const report = await prisma.developerReport.findFirst({
        where: { id, orgId },
        include: { comments: true }
      });
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const isDirector = req.auth!.roleKeys.some((k) =>
        [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k)
      );

      if (parentId) {
        if (isDirector) {
          res.status(400).json({ error: "Director cannot add response to a question" });
          return;
        }
        const parent = await prisma.developerReportComment.findFirst({
          where: { id: parentId, reportId: id }
        });
        if (!parent || parent.kind !== "question") {
          res.status(400).json({ error: "Invalid question to respond to" });
          return;
        }
        if (report.submittedById !== userId) {
          res.status(403).json({ error: "Only report author can respond" });
          return;
        }
        const comment = await prisma.developerReportComment.create({
          data: {
            reportId: id,
            authorId: userId,
            kind: "response",
            parentId,
            content: content.trim()
          },
          include: { author: { select: { id: true, email: true, name: true } } }
        });
        const authorName = comment.author?.name || comment.author?.email || "Developer";
        const dayKey = report.reportDate.toISOString().slice(0, 10);
        await notifyDirectors(
          prisma,
          orgId,
          "Developer report response received",
          `Developer report for ${dayKey}: ${authorName} responded to a director question.`
        );
        res.status(201).json(comment);
        return;
      }

      if (isDirector) {
        const k = kind === "question" ? "question" : "comment";
        const comment = await prisma.developerReportComment.create({
          data: {
            reportId: id,
            authorId: userId,
            kind: k,
            content: content.trim()
          },
          include: { author: { select: { id: true, email: true, name: true } } }
        });
        res.status(201).json(comment);
        return;
      }

      res.status(403).json({ error: "Only director can add comments or questions" });
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
