import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";
import { notifyDirectors } from "./director-notifications";

function routeParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default function meetingRequestsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // List: sales/developer = own; director/admin = all org requests
  router.get(
    "/",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isDirector = req.auth!.roleKeys.some((k) => k === ROLE_KEYS.director || k === ROLE_KEYS.admin);

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

  // Create: sales & developer (request meeting with director)
  router.post(
    "/",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.sales]),
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

      const who = request.requestedBy.name ?? request.requestedBy.email ?? "A teammate";
      await notifyDirectors(
        prisma,
        orgId,
        "New meeting request with director",
        `${who} requested a meeting.\n\n${body.reason.trim().slice(0, 1200)}${body.reason.length > 1200 ? "…" : ""}`,
        { type: "meeting_request.created" }
      );

      res.status(201).json(request);
    }
  );

  // Respond: director/admin only (approve or reject) — register before PATCH /:id
  router.patch(
    "/:id/respond",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const id = routeParam(req.params.id);
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

  // Update notes / time after initial response (director & admin)
  router.patch(
    "/:id",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const id = routeParam(req.params.id);
      const body = req.body as { responseNote?: string; scheduledAt?: string | null; adminComment?: string };
      const existing = await prisma.meetingRequest.findFirst({
        where: { id, orgId },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          respondedBy: { select: { id: true, name: true, email: true } }
        }
      });
      if (!existing) {
        res.status(404).json({ error: "Meeting request not found" });
        return;
      }
      const data: {
        responseNote?: string | null;
        scheduledAt?: Date | null;
        adminComment?: string | null;
      } = {};
      if (body.responseNote !== undefined) data.responseNote = body.responseNote?.trim() || null;
      if (body.adminComment !== undefined) data.adminComment = body.adminComment?.trim() || null;
      if (body.scheduledAt !== undefined) {
        if (body.scheduledAt === null || body.scheduledAt === "") {
          data.scheduledAt = null;
        } else {
          const d = new Date(body.scheduledAt);
          if (isNaN(d.getTime())) {
            res.status(400).json({ error: "Invalid scheduledAt" });
            return;
          }
          data.scheduledAt = d;
        }
      }
      if (Object.keys(data).length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
      }
      const updated = await prisma.meetingRequest.update({
        where: { id },
        data,
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          respondedBy: { select: { id: true, name: true, email: true } }
        }
      });
      res.json(updated);
    }
  );

  return router;
}
