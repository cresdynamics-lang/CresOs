import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";

export default function meetingRequestsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // List: developer = own; director = all (pending first)
  router.get(
    "/",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));

      const list = await prisma.meetingRequest.findMany({
        where: isDirector ? { orgId } : { orgId, requestedById: userId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          respondedBy: { select: { id: true, name: true, email: true } }
        }
      });
      res.json(list);
    }
  );

  // Create: developer only (request meeting with director)
  router.post(
    "/",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const body = req.body as { reason: string; scheduledAt?: string };
      if (!body.reason?.trim()) {
        res.status(400).json({ error: "Reason for meeting is required" });
        return;
      }
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (body.scheduledAt && scheduledAt && isNaN(scheduledAt.getTime())) {
        res.status(400).json({ error: "Invalid scheduledAt" });
        return;
      }

      const request = await prisma.meetingRequest.create({
        data: {
          orgId,
          requestedById: userId,
          reason: body.reason.trim(),
          scheduledAt,
          status: "pending"
        },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } }
        }
      });

      await logAdminActivity(prisma, {
        orgId,
        type: "meeting_request",
        summary: `Meeting requested by ${request.requestedBy.name ?? request.requestedBy.email}: ${body.reason.trim().slice(0, 80)}${body.reason.length > 80 ? "…" : ""}`,
        body: body.reason.trim(),
        actorId: userId,
        entityType: "MeetingRequest",
        entityId: request.id,
        metadata: { scheduledAt: scheduledAt?.toISOString() ?? null }
      });

      res.status(201).json(request);
    }
  );

  // Respond: director/admin only (approve or reject)
  router.patch(
    "/:id/respond",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const body = req.body as { status: "approved" | "rejected"; responseNote?: string; scheduledAt?: string };
      if (!body.status || !["approved", "rejected"].includes(body.status)) {
        res.status(400).json({ error: "status must be approved or rejected" });
        return;
      }

      const existing = await prisma.meetingRequest.findFirst({
        where: { id, orgId },
        include: { requestedBy: { select: { name: true, email: true } } }
      });
      if (!existing) {
        res.status(404).json({ error: "Meeting request not found" });
        return;
      }
      if (existing.status !== "pending") {
        res.status(400).json({ error: "Request already responded" });
        return;
      }

      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : existing.scheduledAt;
      if (body.scheduledAt && scheduledAt && isNaN(scheduledAt.getTime())) {
        res.status(400).json({ error: "Invalid scheduledAt" });
        return;
      }

      const updated = await prisma.meetingRequest.update({
        where: { id },
        data: {
          status: body.status,
          respondedById: userId,
          respondedAt: new Date(),
          responseNote: body.responseNote?.trim() || null,
          scheduledAt: body.status === "approved" ? (scheduledAt ?? existing.scheduledAt) : null
        },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          respondedBy: { select: { id: true, name: true, email: true } }
        }
      });

      await logAdminActivity(prisma, {
        orgId,
        type: "meeting_responded",
        summary: `Meeting request ${body.status}: ${existing.requestedBy.name ?? existing.requestedBy.email} — ${body.responseNote?.trim().slice(0, 60) ?? body.status}`,
        body: body.responseNote?.trim() || null,
        actorId: userId,
        entityType: "MeetingRequest",
        entityId: id,
        metadata: { status: body.status, scheduledAt: updated.scheduledAt?.toISOString() ?? null }
      });

      res.json(updated);
    }
  );

  return router;
}
