// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { getDirectorAndAdminUserIds, notifyDirectors } from "./director-notifications";
import { queueAutoDirectorReplyForSalesReport } from "./director-ai-automation";

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

export default function reportsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Admin AI reports (directors/admin only)
  router.get(
    "/ai",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const list = await prisma.adminAiReport.findMany({
        where: { orgId },
        orderBy: { dateKey: "desc" }
      });
      res.json(list);
    }
  );

  router.get(
    "/ai/:id",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const report = await prisma.adminAiReport.findFirst({
        where: { id, orgId }
      });
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      res.json(report);
    }
  );

  // Sales: overdue unanswered questions (alarm) - must be before /:id
  router.get(
    "/alarms/overdue",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) =>
        [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k)
      );

      const reports = await prisma.salesReport.findMany({
        where: isDirector ? { orgId, status: "submitted" } : { orgId, submittedById: userId, status: "submitted" },
        select: { id: true }
      });
      const reportIds = reports.map((r) => r.id);

      const questions = await prisma.salesReportComment.findMany({
        where: { reportId: { in: reportIds }, kind: "question", parentId: null },
        include: { report: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" }
      });

      const withReplies = await Promise.all(
        questions.map(async (q) => {
          const reply = await prisma.salesReportComment.findFirst({
            where: { parentId: q.id }
          });
          const askedAt = q.createdAt.getTime();
          const deadline = askedAt + TWENTY_FOUR_HOURS_MS;
          const now = Date.now();
          const overdue = !reply && now > deadline;
          return {
            id: q.id,
            reportId: q.reportId,
            reportTitle: q.report.title,
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

  // Sales: list own reports (submitted = history read-only; also drafts). Director: list all submitted.
  router.get(
    "/",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) =>
        [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k)
      );

      if (isDirector) {
        const leadershipIds = await getDirectorAndAdminUserIds(prisma, orgId);
        const list = await prisma.salesReport.findMany({
          where: { orgId, status: "submitted" },
          orderBy: { submittedAt: "desc" },
          include: {
            submittedBy: { select: { id: true, email: true, name: true } },
            comments: {
              where: { parentId: null },
              select: { authorId: true, source: true, content: true, createdAt: true }
            }
          }
        });
        const mapped = list.map((r) => {
          const { comments, body, ...rest } = r;
          const submittedAtMs = r.submittedAt ? new Date(r.submittedAt).getTime() : 0;
          const hasAiLeadershipReply = (comments ?? []).some(
            (c) =>
              c.source === "ai_auto" ||
              (leadershipIds.includes(c.authorId) &&
                typeof c.content === "string" &&
                c.content.includes(MARKED_REVIEWED_LINE) &&
                submittedAtMs > 0 &&
                new Date(c.createdAt).getTime() >= submittedAtMs)
          );
          const flat = body.replace(/\s+/g, " ").trim();
          return {
            ...rest,
            body,
            bodyPreview: flat.length > 220 ? `${flat.slice(0, 220)}…` : flat,
            bodyCharCount: body.length,
            hasAiLeadershipReply
          };
        });
        return res.json(mapped);
      }

      const list = await prisma.salesReport.findMany({
        where: { orgId, submittedById: userId },
        orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }]
      });
      res.json(list);
    }
  );

  // Sales: create draft report
  router.post(
    "/",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { title, body } = req.body as { title?: string; body?: string };
      if (!title || !body) {
        res.status(400).json({ error: "Title and body are required" });
        return;
      }
      const report = await prisma.salesReport.create({
        data: {
          orgId,
          submittedById: userId,
          title,
          body,
          status: "draft"
        }
      });
      res.status(201).json(report);
    }
  );

  // Get one report (sales: own only; director: any submitted)
  router.get(
    "/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const id = req.params.id;
      const isDirector = req.auth!.roleKeys.some((k) =>
        [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k)
      );

      const report = await prisma.salesReport.findFirst({
        where: { id, orgId },
        include: {
          submittedBy: { select: { id: true, email: true, name: true } },
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
        return res.status(404).json({ error: "Report not found" });
      }
      if (!isDirector && report.submittedById !== userId) {
        return res.status(404).json({ error: "Report not found" });
      }
      if (!isDirector && report.status === "draft") {
        // sales can only view submitted reports as read-only history; drafts are for editing
      }
      res.json(report);
    }
  );

  // Director/Admin: mark report as viewed/checked and attach remarks.
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

      const existing = await prisma.salesReport.findFirst({
        where: { id, orgId, status: "submitted" }
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
          Boolean(existing.submittedAt) &&
          (await prisma.salesReportComment.count({
            where: {
              reportId: id,
              parentId: null,
              authorId: { in: leadershipIds },
              createdAt: { gte: existing.submittedAt! }
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

      const updated = await prisma.salesReport.update({
        where: { id },
        data: {
          reviewStatus,
          reviewedAt: new Date(),
          reviewedById: userId,
          ...(nextRemarks !== undefined && { remarks: nextRemarks })
        },
        include: {
          submittedBy: { select: { id: true, email: true, name: true } }
        }
      });
      res.json(updated);
    }
  );

  // Sales: update own draft
  router.patch(
    "/:id",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const id = req.params.id;
      const { title, body } = req.body as { title?: string; body?: string };

      const existing = await prisma.salesReport.findFirst({
        where: { id, orgId, submittedById: userId, status: "draft" }
      });
      if (!existing) {
        return res.status(404).json({ error: "Report not found or not editable" });
      }

      const report = await prisma.salesReport.update({
        where: { id },
        data: { ...(title != null && { title }), ...(body != null && { body }) }
      });
      res.json(report);
    }
  );

  // Sales: submit report (draft -> submitted)
  router.post(
    "/:id/submit",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const id = req.params.id;

      const existing = await prisma.salesReport.findFirst({
        where: { id, orgId, submittedById: userId, status: "draft" }
      });
      if (!existing) {
        return res.status(404).json({ error: "Report not found or already submitted" });
      }

      const trimmedTitle = existing.title.trim();
      const trimmedBody = existing.body.trim();
      if (trimmedTitle.length < 3) {
        return res.status(400).json({ error: "Title is too short to submit." });
      }
      if (trimmedBody.length < 40) {
        return res
          .status(400)
          .json({
            error:
              "Activities section must be at least 40 characters so the director gets a useful record."
          });
      }

      const submittedAt = new Date();
      const report = await prisma.salesReport.update({
        where: { id },
        data: { status: "submitted", submittedAt },
        include: { submittedBy: { select: { name: true, email: true } } }
      });
      const by = report.submittedBy?.name || report.submittedBy?.email || "Sales";
      const ts = submittedAt.toISOString();
      await notifyDirectors(
        prisma,
        orgId,
        "Sales report submitted",
        `Report "${report.title}" was submitted by ${by}.\n\nSubmitted at (server, UTC): ${ts}\nThis time is stored on the server and is visible in the app even if you were offline when it arrived.`,
        { type: "sales_report.submitted" }
      );
      queueAutoDirectorReplyForSalesReport(prisma, report.id);
      res.json(report);
    }
  );

  // Director: add comment or question. Sales: add response (body: { parentId, content })
  router.post(
    "/:id/comments",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const id = req.params.id;
      const { kind, content, parentId } = req.body as {
        kind?: string;
        content?: string;
        parentId?: string;
      };

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
      }

      const report = await prisma.salesReport.findFirst({
        where: { id, orgId },
        include: { comments: true }
      });
      if (!report) return res.status(404).json({ error: "Report not found" });
      if (report.status !== "submitted") {
        return res.status(400).json({ error: "Report is not submitted" });
      }

      const isDirector = req.auth!.roleKeys.some((k) =>
        [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k)
      );

      if (parentId) {
        // Response from sales to a director question
        if (isDirector) {
          return res.status(400).json({ error: "Director cannot add response to a question" });
        }
        const parent = await prisma.salesReportComment.findFirst({
          where: { id: parentId, reportId: id }
        });
        if (!parent || parent.kind !== "question") {
          return res.status(400).json({ error: "Invalid question to respond to" });
        }
        if (report.submittedById !== userId) {
          return res.status(403).json({ error: "Only report author can respond" });
        }
        const comment = await prisma.salesReportComment.create({
          data: {
            reportId: id,
            authorId: userId,
            kind: "response",
            parentId,
            content: content.trim()
          },
          include: { author: { select: { id: true, email: true, name: true } } }
        });
        const authorName = comment.author?.name || comment.author?.email || "Sales";
        await notifyDirectors(prisma, orgId, "Report response received", `Report "${report.title}": ${authorName} responded to a director question.`);
        return res.status(201).json(comment);
      }

      if (isDirector) {
        const k = kind === "question" ? "question" : "comment";
        const comment = await prisma.salesReportComment.create({
          data: {
            reportId: id,
            authorId: userId,
            kind: k,
            content: content.trim()
          },
          include: { author: { select: { id: true, email: true, name: true } } }
        });
        return res.status(201).json(comment);
      }

      return res.status(403).json({ error: "Only director can add comments or questions" });
    }
  );

  return router;
}
