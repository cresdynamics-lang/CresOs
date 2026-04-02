// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { generateClientProjectMessage } from "./ai-reminders";
import { notifyDirectors } from "./director-notifications";
import { notifyProjectExecutionStakeholders } from "./project-stakeholder-notifications";

export default function projectsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // List users that can be assigned as developer (developer role in org)
  router.get(
    "/assignable-developers",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.developer]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const memberIds = (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
      const developerRole = await prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.developer } });
      if (!developerRole) return res.json([]);
      const devUserIds = (await prisma.userRole.findMany({ where: { roleId: developerRole.id }, select: { userId: true } })).map((r) => r.userId);
      const ids = memberIds.filter((id) => devUserIds.includes(id));
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
      res.json(users);
    }
  );

  // Projects list (role-based: sales=created by me, developer=approved+assigned to me, finance=approved, director=all)
  router.get(
    "/",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.sales, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const roleKeys = req.auth!.roleKeys;
      const isDirector = roleKeys.includes(ROLE_KEYS.director) || roleKeys.includes(ROLE_KEYS.admin);
      const isDeveloper = roleKeys.includes(ROLE_KEYS.developer);
      const isFinance = roleKeys.includes(ROLE_KEYS.finance);
      const isSales = roleKeys.includes(ROLE_KEYS.sales);

      let where: { orgId: string; deletedAt: null; createdByUserId?: string; approvalStatus?: string; assignedDeveloperId?: string } = { orgId, deletedAt: null };
      if (isDirector || roleKeys.includes(ROLE_KEYS.admin) || roleKeys.includes(ROLE_KEYS.analyst)) {
        // director/admin/analyst: all
      } else if (isDeveloper && !isDirector) {
        where.approvalStatus = "approved";
        where.assignedDeveloperId = userId;
      } else if (isFinance) {
        where.approvalStatus = "approved";
      } else if (isSales) {
        where.createdByUserId = userId;
      } else {
        where = { orgId, deletedAt: null, id: { in: [] } };
      }

      const projects = await prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedDeveloper: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } }
        }
      });

      // Strip price/phone/email for developer view
      const stripSensitive = isDeveloper && !isDirector;
      const out = projects.map((p) => {
        const row = {
          ...p,
          price: p.price != null ? Number(p.price) : null,
          amountReceived: p.amountReceived != null ? Number(p.amountReceived) : 0,
          managementMonthlyAmount: p.managementMonthlyAmount != null ? Number(p.managementMonthlyAmount) : null,
          managementMonths: p.managementMonths
        };
        if (stripSensitive) {
          delete (row as any).phone;
          delete (row as any).email;
          delete (row as any).price;
          delete (row as any).clientOrOwnerName;
          delete (row as any).amountReceived;
        }
        return row;
      });
      res.json(out);
    }
  );

  // Create project: sales (with approval flow) or developer (legacy, auto-approved)
  router.post(
    "/",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const body = (req.body || {}) as {
        name: string;
        clientId?: string;
        dealId?: string;
        type?: string;
        clientOrOwnerName?: string;
        phone?: string;
        email?: string;
        price?: string | number;
        projectDetails?: string;
        status?: string;
        assignedDeveloperId?: string;
        timeline?: { date?: string; title?: string }[];
        startDate?: string;
        endDate?: string;
      };
      if (!body.name?.trim()) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      const isSalesCreate = body.type != null && ["demo", "project"].includes(body.type);
      const price = body.price != null && body.price !== "" ? new Prisma.Decimal(Number(body.price)) : undefined;
      if (isSalesCreate && body.type === "project" && (price === undefined || Number(price) < 0)) {
        // price optional for demo
        if (body.type === "project") {
          // allow null/omit for draft; require for full project if you want
        }
      }
      const project = await prisma.project.create({
        data: {
          orgId,
          name: body.name.trim(),
          status: body.status?.trim() || "planned",
          clientId: body.clientId,
          dealId: body.dealId,
          ownerUserId: userId,
          createdByUserId: userId,
          startDate: body.startDate ? new Date(body.startDate) : new Date(),
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          type: isSalesCreate ? body.type : null,
          clientOrOwnerName: body.clientOrOwnerName?.trim() || null,
          phone: body.phone?.trim() || null,
          email: body.email?.trim() || null,
          price: price ?? null,
          projectDetails: body.projectDetails?.trim() || null,
          approvalStatus: isSalesCreate ? "pending_approval" : "approved",
          assignedDeveloperId: body.assignedDeveloperId || null,
          timeline: body.timeline ?? null
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedDeveloper: { select: { id: true, name: true, email: true } }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "project.created",
          entityType: "project",
          entityId: project.id,
          metadata: { name: project.name, approvalStatus: project.approvalStatus }
        }
      });
      const actorName = project.createdBy?.name || project.createdBy?.email || "A user";
      await notifyDirectors(prisma, orgId, "New project created", `Project "${project.name}" was created by ${actorName}. Status: ${project.approvalStatus}.`);
      res.status(201).json(project);
    }
  );

  // Director: approve or reject project (makes it visible to developer + finance)
  router.patch(
    "/:projectId/approve",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const body = req.body as { approvalStatus: "approved" | "rejected" };
      if (body.approvalStatus !== "approved" && body.approvalStatus !== "rejected") {
        res.status(400).json({ error: "approvalStatus must be approved or rejected" });
        return;
      }
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
          approvalStatus: body.approvalStatus,
          approvedById: userId,
          approvedAt: new Date()
        },
        include: { approvedBy: { select: { id: true, name: true } }, assignedDeveloper: { select: { id: true, name: true, email: true } } }
      });
      await prisma.eventLog.create({
        data: { orgId, actorId: userId, type: "project.approved", entityType: "project", entityId: projectId, metadata: { approvalStatus: body.approvalStatus } }
      });
      await notifyDirectors(prisma, orgId, "Project approval updated", `Project "${project.name}" was ${body.approvalStatus}.`);
      res.json(updated);
    }
  );

  // Update project: sales (pending only), finance (contact/price), anyone (clientLink)
  router.patch(
    "/:projectId",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.sales, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const body = req.body as {
        clientLink?: string | null;
        clientOrOwnerName?: string | null;
        phone?: string | null;
        email?: string | null;
        price?: string | number | null;
        projectDetails?: string | null;
        status?: string;
        assignedDeveloperId?: string | null;
        timeline?: { date?: string; title?: string }[] | null;
        managementMonthlyAmount?: string | number | null;
        managementMonths?: string | number | null;
      };
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const isFinance = req.auth!.roleKeys.includes(ROLE_KEYS.finance);
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      const canEditSales = isSales && project.createdByUserId === userId && project.approvalStatus === "pending_approval";
      const canEditFinance = isFinance && project.approvalStatus === "approved";

      const data: Record<string, unknown> = {};
      if (body.clientLink !== undefined) data.clientLink = body.clientLink && String(body.clientLink).trim() ? String(body.clientLink).trim() : null;
      if (isDirector) {
        if (body.clientOrOwnerName !== undefined) data.clientOrOwnerName = body.clientOrOwnerName && String(body.clientOrOwnerName).trim() ? String(body.clientOrOwnerName).trim() : null;
        if (body.phone !== undefined) data.phone = body.phone && String(body.phone).trim() ? String(body.phone).trim() : null;
        if (body.email !== undefined) data.email = body.email && String(body.email).trim() ? String(body.email).trim() : null;
        if (body.price !== undefined) data.price = body.price != null && body.price !== "" ? new Prisma.Decimal(Number(body.price)) : null;
        if (body.projectDetails !== undefined) data.projectDetails = body.projectDetails && String(body.projectDetails).trim() ? String(body.projectDetails).trim() : null;
        if (body.status !== undefined) data.status = body.status;
        if (body.assignedDeveloperId !== undefined) data.assignedDeveloperId = body.assignedDeveloperId && String(body.assignedDeveloperId).trim() ? String(body.assignedDeveloperId).trim() : null;
        if (body.timeline !== undefined) data.timeline = body.timeline;
        if (body.managementMonthlyAmount !== undefined) data.managementMonthlyAmount = body.managementMonthlyAmount != null && body.managementMonthlyAmount !== "" ? new Prisma.Decimal(Number(body.managementMonthlyAmount)) : null;
        if (body.managementMonths !== undefined) data.managementMonths = body.managementMonths != null && body.managementMonths !== "" ? Math.max(0, Math.floor(Number(body.managementMonths))) : null;
      } else if (canEditFinance) {
        if (body.clientOrOwnerName !== undefined) data.clientOrOwnerName = body.clientOrOwnerName && String(body.clientOrOwnerName).trim() ? String(body.clientOrOwnerName).trim() : null;
        if (body.phone !== undefined) data.phone = body.phone && String(body.phone).trim() ? String(body.phone).trim() : null;
        if (body.email !== undefined) data.email = body.email && String(body.email).trim() ? String(body.email).trim() : null;
        if (body.price !== undefined) data.price = body.price != null && body.price !== "" ? new Prisma.Decimal(Number(body.price)) : null;
        if (body.managementMonthlyAmount !== undefined) data.managementMonthlyAmount = body.managementMonthlyAmount != null && body.managementMonthlyAmount !== "" ? new Prisma.Decimal(Number(body.managementMonthlyAmount)) : null;
        if (body.managementMonths !== undefined) data.managementMonths = body.managementMonths != null && body.managementMonths !== "" ? Math.max(0, Math.floor(Number(body.managementMonths))) : null;
      } else if (canEditSales) {
        if (body.clientOrOwnerName !== undefined) data.clientOrOwnerName = body.clientOrOwnerName && String(body.clientOrOwnerName).trim() ? String(body.clientOrOwnerName).trim() : null;
        if (body.phone !== undefined) data.phone = body.phone && String(body.phone).trim() ? String(body.phone).trim() : null;
        if (body.email !== undefined) data.email = body.email && String(body.email).trim() ? String(body.email).trim() : null;
        if (body.price !== undefined) data.price = body.price != null && body.price !== "" ? new Prisma.Decimal(Number(body.price)) : null;
        if (body.projectDetails !== undefined) data.projectDetails = body.projectDetails && String(body.projectDetails).trim() ? String(body.projectDetails).trim() : null;
        if (body.status !== undefined) data.status = body.status;
        if (body.assignedDeveloperId !== undefined) data.assignedDeveloperId = body.assignedDeveloperId && String(body.assignedDeveloperId).trim() ? String(body.assignedDeveloperId).trim() : null;
        if (body.timeline !== undefined) data.timeline = body.timeline;
      }

      const updated = await prisma.project.update({
        where: { id: projectId },
        data,
        include: { assignedDeveloper: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true } } }
      });
      if ("timeline" in data) {
        const timelineChanged =
          JSON.stringify(project.timeline ?? null) !== JSON.stringify(updated.timeline ?? null);
        if (timelineChanged) {
          await notifyProjectExecutionStakeholders(
            prisma,
            orgId,
            {
              name: updated.name,
              createdByUserId: updated.createdByUserId,
              assignedDeveloperId: updated.assignedDeveloperId
            },
            "Delivery timeline updated",
            `Project "${updated.name}" delivery timeline was updated.`,
            { type: "project.timeline", excludeUserId: userId }
          );
        }
      }
      res.json(updated);
    }
  );

  // Handoff: list received (pending to me) and sent requests
  router.get(
    "/handoff-requests",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const filter = (req.query.filter as string) || "received";
      const where =
        filter === "received"
          ? { orgId, toUserId: userId, status: "pending" }
          : filter === "sent"
            ? { orgId, fromUserId: userId }
            : { orgId, OR: [{ toUserId: userId }, { fromUserId: userId }] };
      const list = await prisma.projectHandoffRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
          fromUser: { select: { id: true, name: true, email: true } },
          toUser: { select: { id: true, name: true, email: true } }
        }
      });
      res.json(list);
    }
  );

  // Respond to handoff (accept or reject); only the requested "to" user can respond
  router.patch(
    "/handoff-requests/:requestId/respond",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { requestId } = req.params;
      const body = req.body as { accept: boolean };
      const handoff = await prisma.projectHandoffRequest.findFirst({
        where: { id: requestId, orgId, status: "pending" },
        include: { project: true }
      });
      if (!handoff || handoff.toUserId !== userId) {
        res.status(404).json({ error: "Handoff request not found or you cannot respond" });
        return;
      }
      const now = new Date();
      if (body.accept) {
        await prisma.$transaction([
          prisma.projectHandoffRequest.update({
            where: { id: requestId },
            data: { status: "accepted", respondedAt: now }
          }),
          prisma.project.update({
            where: { id: handoff.projectId },
            data: {
              assignedDeveloperId: userId,
              developerReviewedAt: null
            }
          })
        ]);
        await prisma.eventLog.create({
          data: { orgId, actorId: userId, type: "project.handoff.accepted", entityType: "project", entityId: handoff.projectId, metadata: { requestId, fromUserId: handoff.fromUserId } }
        });
        await notifyDirectors(prisma, orgId, "Project handoff accepted", `Project "${handoff.project.name}" was handed off to another developer (accepted).`);
      } else {
        await prisma.projectHandoffRequest.update({
          where: { id: requestId },
          data: { status: "rejected", respondedAt: now }
        });
        await prisma.eventLog.create({
          data: { orgId, actorId: userId, type: "project.handoff.rejected", entityType: "project", entityId: handoff.projectId, metadata: { requestId } }
        });
        await notifyDirectors(prisma, orgId, "Project handoff rejected", `Handoff request for project "${handoff.project.name}" was rejected. Project remains with the current developer.`);
      }
      const updated = await prisma.projectHandoffRequest.findUnique({
        where: { id: requestId },
        include: { project: { select: { id: true, name: true } }, fromUser: { select: { id: true, name: true, email: true } }, toUser: { select: { id: true, name: true, email: true } } }
      });
      res.json(updated);
    }
  );

  // Single project (role-based visibility: developer sees no price/phone/email)
  router.get(
    "/:projectId",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.sales, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedDeveloper: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } },
          tasks: { where: { deletedAt: null }, orderBy: { dueDate: "asc" } },
          milestones: { where: { deletedAt: null }, orderBy: { dueDate: "asc" } }
        }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const isDeveloper = req.auth!.roleKeys.includes(ROLE_KEYS.developer);
      const isFinance = req.auth!.roleKeys.includes(ROLE_KEYS.finance);
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      // Developer (not director): only if approved and assigned to me
      if (isDeveloper && !isDirector && (project.approvalStatus !== "approved" || project.assignedDeveloperId !== userId)) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (isFinance && project.approvalStatus !== "approved") {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (isSales && !isDirector && !isFinance && !isDeveloper && project.createdByUserId !== userId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const stripSensitive = isDeveloper && !isDirector;
      const out: any = {
        ...project,
        price: project.price != null ? Number(project.price) : null,
        amountReceived: project.amountReceived != null ? Number(project.amountReceived) : 0,
        managementMonthlyAmount: project.managementMonthlyAmount != null ? Number(project.managementMonthlyAmount) : null,
        managementMonths: project.managementMonths
      };
      if (stripSensitive) {
        delete out.phone;
        delete out.email;
        delete out.price;
        delete out.clientOrOwnerName;
        delete out.amountReceived;
        delete out.managementMonthlyAmount;
        delete out.managementMonths;
      }
      res.json(out);
    }
  );

  // Mark project as reviewed by assigned developer (prompt to add tasks done)
  router.post(
    "/:projectId/reviewed",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (!isDirector && project.assignedDeveloperId !== userId) {
        res.status(403).json({ error: "Only the assigned developer can mark as reviewed" });
        return;
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { developerReviewedAt: new Date() }
      });
      await notifyDirectors(prisma, orgId, "Project reviewed by developer", `Project "${project.name}" was marked as reviewed by the assigned developer (tasks added/reviewed).`);
      res.json(updated);
    }
  );

  // Request handoff to another developer; only current assigned dev can request
  router.post(
    "/:projectId/handoff",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const body = req.body as { toUserId: string };
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (!isDirector && project.assignedDeveloperId !== userId) {
        res.status(403).json({ error: "Only the assigned developer can request handoff" });
        return;
      }
      const toUserId = body.toUserId?.trim();
      if (!toUserId || toUserId === userId) {
        res.status(400).json({ error: "Valid toUserId (different from you) is required" });
        return;
      }
      const existing = await prisma.projectHandoffRequest.findFirst({
        where: { projectId, status: "pending" }
      });
      if (existing) {
        res.status(400).json({ error: "A handoff request is already pending for this project" });
        return;
      }
      const developerRole = await prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.developer } });
      if (!developerRole) {
        res.status(400).json({ error: "No developer role found" });
        return;
      }
      const toHasDeveloper = await prisma.userRole.findFirst({ where: { userId: toUserId, roleId: developerRole.id } });
      if (!toHasDeveloper) {
        res.status(400).json({ error: "Target user is not a developer in this org" });
        return;
      }
      const handoff = await prisma.projectHandoffRequest.create({
        data: { projectId, orgId, fromUserId: userId, toUserId },
        include: { project: { select: { id: true, name: true } }, fromUser: { select: { id: true, name: true, email: true } }, toUser: { select: { id: true, name: true, email: true } } }
      });
      await prisma.eventLog.create({
        data: { orgId, actorId: userId, type: "project.handoff.requested", entityType: "project", entityId: projectId, metadata: { requestId: handoff.id, toUserId } }
      });
      const toName = handoff.toUser?.name || handoff.toUser?.email || "a developer";
      await notifyDirectors(prisma, orgId, "Project handoff requested", `Project "${project.name}" handoff was requested to ${toName}. Waiting for their response.`);
      res.status(201).json(handoff);
    }
  );

  // AI-generated client update message (task status + optional link; for sales to send to client)
  router.post(
    "/:projectId/client-message",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { projectId } = req.params;
      const body = req.body as { link?: string };
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const tasks = await prisma.task.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { dueDate: "asc" },
        select: {
          title: true,
          status: true,
          dueDate: true,
          blockedReason: true
        }
      });
      const link = typeof body.link === "string" && body.link.trim() ? body.link.trim() : project.clientLink ?? null;
      const result = await generateClientProjectMessage({
        projectName: project.name,
        projectStatus: project.status,
        tasks: tasks.map((t) => ({
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          blockedReason: t.blockedReason
        })),
        link
      });
      if (!result) {
        res.status(503).json({
          error: "AI message generation unavailable. Set GROQ_API_KEY or try again later.",
          fallback: `Project "${project.name}" is ${project.status}. ${tasks.length} task(s): ${tasks.map((t) => `${t.title} (${t.status})`).join(", ") || "none"}.${link ? ` View status: ${link}` : ""}`
        });
        return;
      }
      res.json({ message: result.message, link: result.link ?? undefined });
    }
  );

  // Milestones
  router.get(
    "/:projectId/milestones",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const { projectId } = req.params;
    const milestones = await prisma.milestone.findMany({
      where: { orgId, projectId, deletedAt: null },
      orderBy: { dueDate: "asc" }
    });
    res.json(milestones);
    }
  );

  router.post(
    "/:projectId/milestones",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { projectId } = req.params;
    const { name, dueDate } = req.body as {
      name: string;
      dueDate?: string;
    };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const milestone = await prisma.milestone.create({
      data: {
        orgId,
        projectId,
        name,
        status: "pending",
        dueDate: dueDate ? new Date(dueDate) : undefined
      }
    });

    await prisma.eventLog.create({
      data: {
        orgId,
        actorId: userId,
        type: "milestone.created",
        entityType: "milestone",
        entityId: milestone.id,
        metadata: { projectId }
      }
    });
    res.status(201).json(milestone);
    }
  );

  // Tasks (assigned developer or director/analyst only for add/edit)
  router.get(
    "/:projectId/tasks",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (!isDirector && !req.auth!.roleKeys.includes(ROLE_KEYS.analyst) && project.assignedDeveloperId !== userId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const tasks = await prisma.task.findMany({
        where: { orgId, projectId, deletedAt: null },
        orderBy: { dueDate: "asc" }
      });
      res.json(tasks);
    }
  );

  router.post(
    "/:projectId/tasks",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (!isDirector && project.assignedDeveloperId !== userId) {
        res.status(403).json({ error: "Only the assigned developer can add tasks" });
        return;
      }
      const { title, description, milestoneId, dueDate } = req.body as {
        title: string;
        description?: string;
        milestoneId?: string;
        dueDate?: string;
      };
      if (!title?.trim()) {
        res.status(400).json({ error: "Title is required" });
        return;
      }
      const task = await prisma.task.create({
        data: {
          orgId,
          projectId,
          milestoneId: milestoneId || undefined,
          title: title.trim(),
          description: description?.trim() || undefined,
          status: "todo",
          assigneeId: userId,
          dueDate: dueDate ? new Date(dueDate) : undefined
        }
      });
      await prisma.eventLog.create({
        data: { orgId, actorId: userId, type: "task.created", entityType: "task", entityId: task.id, metadata: { projectId } }
      });
      await notifyProjectExecutionStakeholders(
        prisma,
        orgId,
        { name: project.name, createdByUserId: project.createdByUserId, assignedDeveloperId: project.assignedDeveloperId },
        "Task created",
        `Task "${task.title}" was added to project "${project.name}".`,
        { type: "project.task", excludeUserId: userId }
      );
      res.status(201).json(task);
    }
  );

  // Task comments (assigned developer or director/analyst)
  router.get(
    "/tasks/:taskId/comments",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { taskId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
      if (!task || task.orgId !== orgId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      if (!isDirector && !req.auth!.roleKeys.includes(ROLE_KEYS.analyst) && task.project.assignedDeveloperId !== userId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      const comments = await prisma.taskComment.findMany({
        where: { orgId, taskId, deletedAt: null },
        orderBy: { createdAt: "asc" }
      });
      res.json(comments);
    }
  );

  router.post(
    "/tasks/:taskId/comments",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { taskId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
      if (!task || task.orgId !== orgId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      if (!isDirector && task.project.assignedDeveloperId !== userId) {
        res.status(403).json({ error: "Only the assigned developer can add comments" });
        return;
      }
      const { body, type } = req.body as { body: string; type?: string };
      if (!body?.trim()) {
        res.status(400).json({ error: "Body is required" });
        return;
      }
      const allowedTypes = ["progress", "blocker", "completion", "scope_issue"];
      const commentType = type && allowedTypes.includes(type) ? type : "progress";
      const comment = await prisma.taskComment.create({
        data: { orgId, taskId, authorId: userId, body: body.trim(), type: commentType }
      });
      await prisma.eventLog.create({
        data: { orgId, actorId: userId, type: "task.comment.added", entityType: "task", entityId: taskId, metadata: { commentId: comment.id } }
      });
      res.status(201).json(comment);
    }
  );

  // Update task status / priority / blocked reason (assigned developer or director only)
  router.patch(
    "/tasks/:taskId",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { taskId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const existing = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
      if (!existing || existing.orgId !== orgId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      if (!isDirector && existing.project.assignedDeveloperId !== userId) {
        res.status(403).json({ error: "Only the assigned developer can edit this task" });
        return;
      }
    const { status, priority, blockedReason, dueDate, estimatedHours, actualHours } =
      req.body as {
        status?: string;
        priority?: string;
        blockedReason?: string;
        dueDate?: string;
        estimatedHours?: string;
        actualHours?: string;
      };

    if (status === "blocked" && !blockedReason) {
      res.status(400).json({ error: "blockedReason is required when status is blocked" });
      return;
    }

    if (status === "done" && (existing.blockedReason || blockedReason)) {
      res.status(400).json({ error: "Task with blockedReason cannot be marked done" });
      return;
    }

    const data: any = {
      status,
      priority,
      blockedReason,
      dueDate: dueDate ? new Date(dueDate) : undefined
    };

    if (estimatedHours !== undefined) {
      const parsed = Number(estimatedHours);
      if (Number.isNaN(parsed) || parsed < 0) {
        res.status(400).json({ error: "estimatedHours must be a non-negative number" });
        return;
      }
      data.estimatedHours = new Prisma.Decimal(parsed.toFixed(2));
    }

    if (actualHours !== undefined) {
      const parsed = Number(actualHours);
      if (Number.isNaN(parsed) || parsed < 0) {
        res.status(400).json({ error: "actualHours must be a non-negative number" });
        return;
      }
      data.actualHours = new Prisma.Decimal(parsed.toFixed(2));
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data
    });

    const events: string[] = ["task.updated"];
    if (status === "blocked") {
      events.push("task.blocked");
    }
    if (status === "done") {
      events.push("task.completed");
    }

    await prisma.eventLog.createMany({
      data: events.map((type) => ({
        orgId,
        actorId: userId,
        type,
        entityType: "task",
        entityId: task.id,
        metadata: { status: task.status, priority: task.priority }
      }))
    });

    await notifyProjectExecutionStakeholders(
      prisma,
      orgId,
      {
        name: existing.project.name,
        createdByUserId: existing.project.createdByUserId,
        assignedDeveloperId: existing.project.assignedDeveloperId
      },
      "Task updated",
      `Task "${task.title}" on project "${existing.project.name}" was updated. Status: ${task.status}.`,
      { type: "project.task", excludeUserId: userId }
    );
    res.json(task);
    }
  );

  // Request approval for milestone completion
  router.post(
    "/milestones/:id/request-approval",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { id } = req.params;
    const { acceptanceCriteria } = req.body as {
      acceptanceCriteria?: string;
    };

    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        status: "pending",
        acceptanceCriteria: acceptanceCriteria ?? null
      }
    });

    const approval = await prisma.approval.create({
      data: {
        orgId,
        requesterId: userId,
        entityType: "milestone",
        entityId: milestone.id,
        status: "pending",
        reason: "Milestone completion requires approval"
      }
    });

    await prisma.eventLog.create({
      data: {
        orgId,
        actorId: userId,
        type: "approval.requested",
        entityType: "milestone",
        entityId: milestone.id,
        metadata: { approvalId: approval.id }
      }
    });

    res.status(201).json({ milestone, approval });
    }
  );

  // Director approval for milestone completion (Definition of Done)
  router.post(
    "/milestones/:id/complete",
    requireRoles([ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { completionNotes } = req.body as {
        completionNotes: string;
      };

      if (!completionNotes) {
        res.status(400).json({ error: "completionNotes is required" });
        return;
      }

      const milestone = await prisma.milestone.findFirst({
        where: { id, orgId, deletedAt: null },
        include: { tasks: true }
      });

      if (!milestone) {
        res.status(404).json({ error: "Milestone not found" });
        return;
      }

      const hasOpenTasks = milestone.tasks.some(
        (t) => t.status !== "done" && !t.deletedAt
      );
      if (hasOpenTasks) {
        res.status(400).json({ error: "All tasks must be done before milestone completion" });
        return;
      }

      const updated = await prisma.milestone.update({
        where: { id },
        data: {
          status: "completed",
          completionNotes
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "milestone.completed",
          entityType: "milestone",
          entityId: id,
          metadata: { completionNotes }
        }
      });

      await notifyDirectors(prisma, orgId, "Milestone completed", `Milestone "${milestone.name}" was marked completed.`);
      res.json(updated);
    }
  );

  // Change requests
  router.get(
    "/:projectId/change-requests",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { projectId } = req.params;

      const items = await prisma.changeRequest.findMany({
        where: {
          orgId,
          projectId
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(items);
    }
  );

  router.post(
    "/:projectId/change-requests",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const { taskId, description, impact } = req.body as {
        taskId?: string;
        description: string;
        impact?: string;
      };

      if (!description) {
        res.status(400).json({ error: "description is required" });
        return;
      }

      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const changeRequest = await prisma.changeRequest.create({
        data: {
          orgId,
          projectId,
          taskId: taskId ?? null,
          description,
          impact,
          createdByUserId: userId
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "change_request.created",
          entityType: "change_request",
          entityId: changeRequest.id,
          metadata: { projectId, taskId, impact }
        }
      });

      await notifyDirectors(prisma, orgId, "Change request created", `A change request was created for project (impact: ${changeRequest.impact ?? "—"}).`);
      res.status(201).json(changeRequest);
    }
  );

  return router;
}

