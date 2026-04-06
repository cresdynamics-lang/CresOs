// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { generateClientProjectMessage } from "./ai-reminders";
import { getDirectorUsers, notifyDirectors } from "./director-notifications";
import { notifyProjectExecutionStakeholders } from "./project-stakeholder-notifications";
import { syncLeadAndClientFromProject } from "./project-lead-sync";
import { getProjectDeveloperAccess, getAcceptedDeveloperIds } from "../lib/project-access";

export default function projectsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // List users that can be assigned as developer (developer role in org)
  router.get(
    "/assignable-developers",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.developer, ROLE_KEYS.admin]),
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

      let where: Record<string, unknown> = { orgId, deletedAt: null };
      if (isDirector || roleKeys.includes(ROLE_KEYS.admin) || roleKeys.includes(ROLE_KEYS.analyst)) {
        // director/admin/analyst: all
      } else if (isDeveloper && !isDirector) {
        where.approvalStatus = "approved";
        where.OR = [
          { assignedDeveloperId: userId },
          {
            developerAssignments: {
              some: { userId, status: { in: ["pending", "accepted"] } }
            }
          }
        ];
      } else if (isFinance) {
        where.approvalStatus = "approved";
      } else if (isSales) {
        where.createdByUserId = userId;
      } else {
        where = { orgId, deletedAt: null, id: { in: [] } };
      }

      const projects = await prisma.project.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedDeveloper: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } }
        }
      });

      const projectIds = projects.map((p) => p.id);
      const emptySummary = { not_started: 0, in_progress: 0, waiting_response: 0, blocked: 0, done: 0 };
      const taskSummaryByProject: Record<string, typeof emptySummary> = {};
      if (projectIds.length > 0) {
        for (const id of projectIds) {
          taskSummaryByProject[id] = { ...emptySummary };
        }
        const grouped = await prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { orgId, projectId: { in: projectIds }, deletedAt: null },
          _count: { _all: true }
        });
        for (const row of grouped) {
          const pid = row.projectId;
          const raw = String(row.status || "");
          const st = (raw === "todo" ? "not_started" : raw) as keyof typeof emptySummary;
          if (taskSummaryByProject[pid] && st in taskSummaryByProject[pid]) {
            taskSummaryByProject[pid][st] = row._count._all;
          }
        }
      }

      // Strip price/phone/email for developer view
      const stripSensitive = isDeveloper && !isDirector;
      const out = projects.map((p) => {
        const row = {
          ...p,
          price: p.price != null ? Number(p.price) : null,
          amountReceived: p.amountReceived != null ? Number(p.amountReceived) : 0,
          managementMonthlyAmount: p.managementMonthlyAmount != null ? Number(p.managementMonthlyAmount) : null,
          managementMonths: p.managementMonths,
          taskSummary: taskSummaryByProject[p.id] ?? { ...emptySummary }
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

  // Create project: Sales (demo/project → pending director approval) or Director/Admin (approved immediately). Developers cannot create projects.
  router.post(
    "/",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.sales, ROLE_KEYS.admin]),
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
        assignedDeveloperIds?: string[];
        timeline?: { date?: string; title?: string }[];
        startDate?: string;
        endDate?: string;
      };
      if (!body.name?.trim()) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      const isDirectorLike =
        req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      if (!isDirectorLike && !isSales) {
        res.status(403).json({ error: "Only Sales or Director can create projects" });
        return;
      }
      const isSalesCreate = body.type != null && ["demo", "project"].includes(body.type);
      if (isSales && !isDirectorLike && !isSalesCreate) {
        res.status(400).json({ error: "Sales must set type to demo or project" });
        return;
      }
      const price = body.price != null && body.price !== "" ? new Prisma.Decimal(Number(body.price)) : undefined;
      const rawDevIds = Array.isArray(body.assignedDeveloperIds)
        ? body.assignedDeveloperIds
        : body.assignedDeveloperId
          ? [body.assignedDeveloperId]
          : [];
      const developerIds = [...new Set(rawDevIds.map((x) => String(x).trim()).filter(Boolean))];

      let approvalStatus: string;
      let approvedById: string | null = null;
      let approvedAt: Date | null = null;
      if (isDirectorLike) {
        approvalStatus = "approved";
        approvedById = userId;
        approvedAt = new Date();
      } else if (isSalesCreate) {
        approvalStatus = "pending_approval";
      } else {
        approvalStatus = "approved";
      }

      const primaryDev =
        (body.assignedDeveloperId && String(body.assignedDeveloperId).trim()) ||
        (developerIds.length > 0 ? developerIds[0] : null);

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
          approvalStatus,
          approvedById,
          approvedAt,
          assignedDeveloperId: primaryDev || null,
          timeline: body.timeline ?? null
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedDeveloper: { select: { id: true, name: true, email: true } }
        }
      });

      if (developerIds.length > 0 && isDirectorLike) {
        const developerRole = await prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.developer } });
        for (const devId of developerIds) {
          if (!developerRole) break;
          const hasDev = await prisma.userRole.findFirst({ where: { userId: devId, roleId: developerRole.id } });
          if (!hasDev) continue;
          await prisma.projectDeveloperAssignment
            .create({
              data: {
                orgId,
                projectId: project.id,
                userId: devId,
                status: "pending",
                invitedById: userId
              }
            })
            .catch(() => {});
          await prisma.notification.create({
            data: {
              orgId,
              channel: "in_app",
              to: devId,
              subject: "Project assignment",
              body: `You were invited to work on "${project.name}". Open Projects to accept or decline.`,
              status: "sent",
              type: "project.assignment",
              tier: "execution"
            }
          });
        }
      }

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
      if (isSalesCreate) {
        if (approvalStatus === "pending_approval") {
          await notifyDirectors(
            prisma,
            orgId,
            "New project created",
            `Project "${project.name}" was created by ${actorName} and needs director approval. Status: ${project.approvalStatus}.`
          );
        } else {
          await notifyDirectors(
            prisma,
            orgId,
            "New project created",
            `Project "${project.name}" was created by ${actorName}. Status: ${project.approvalStatus}.`
          );
        }
      } else if (!isDirectorLike) {
        await notifyDirectors(
          prisma,
          orgId,
          "New project created",
          `Project "${project.name}" was created by ${actorName}. Status: ${project.approvalStatus}.`
        );
      }
      try {
        await syncLeadAndClientFromProject(prisma, orgId, project.id);
      } catch (e) {
        console.error("syncLeadAndClientFromProject after create:", e);
      }
      res.status(201).json(project);
    }
  );

  // Director: approve or reject project (makes it visible to developer + finance) — director only, not admin
  router.patch(
    "/:projectId/approve",
    requireRoles([ROLE_KEYS.director]),
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
      if (body.approvalStatus === "approved" && project.assignedDeveloperId) {
        await prisma.projectDeveloperAssignment.upsert({
          where: {
            projectId_userId: { projectId, userId: project.assignedDeveloperId }
          },
          create: {
            orgId,
            projectId,
            userId: project.assignedDeveloperId,
            status: "accepted",
            invitedById: userId
          },
          update: { status: "accepted", respondedAt: new Date() }
        });
      }
      await prisma.eventLog.create({
        data: { orgId, actorId: userId, type: "project.approved", entityType: "project", entityId: projectId, metadata: { approvalStatus: body.approvalStatus } }
      });
      await notifyDirectors(prisma, orgId, "Project approval updated", `Project "${project.name}" was ${body.approvalStatus}.`);
      try {
        await syncLeadAndClientFromProject(prisma, orgId, projectId);
      } catch (e) {
        console.error("syncLeadAndClientFromProject after approve:", e);
      }
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
            { type: "project.timeline", excludeUserId: userId, projectId: updated.id }
          );
        }
      }
      try {
        await syncLeadAndClientFromProject(prisma, orgId, projectId);
      } catch (e) {
        console.error("syncLeadAndClientFromProject after patch:", e);
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
          developerAssignments: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              invitedBy: { select: { id: true, name: true, email: true } }
            }
          },
          tasks: {
            where: { deletedAt: null },
            orderBy: { dueDate: "asc" },
            include: {
              comments: {
                where: { deletedAt: null },
                orderBy: { createdAt: "asc" },
                include: { author: { select: { id: true, name: true, email: true } } }
              }
            }
          },
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
      if (isDeveloper && !isDirector) {
        if (project.approvalStatus !== "approved") {
          res.status(404).json({ error: "Project not found" });
          return;
        }
        const access = await getProjectDeveloperAccess(prisma, project, userId);
        if (access === "none") {
          res.status(404).json({ error: "Project not found" });
          return;
        }
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
      const mentionIds = new Set<string>();
      if (project.createdByUserId) mentionIds.add(project.createdByUserId);
      for (const id of await getAcceptedDeveloperIds(prisma, project.id)) {
        mentionIds.add(id);
      }
      for (const d of await getDirectorUsers(prisma, orgId)) {
        mentionIds.add(d.id);
      }
      out.mentionableUsers = await prisma.user.findMany({
        where: { id: { in: [...mentionIds] }, deletedAt: null },
        select: { id: true, name: true, email: true }
      });
      out.developerAccess = await getProjectDeveloperAccess(prisma, project, userId);
      res.json(out);
    }
  );

  // Director invites additional developers (pending accept)
  router.post(
    "/:projectId/developer-assignments",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const { userIds } = req.body as { userIds?: string[] };
      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({ error: "userIds array is required" });
        return;
      }
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const developerRole = await prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.developer } });
      if (!developerRole) {
        res.status(400).json({ error: "No developer role in org" });
        return;
      }
      const created: unknown[] = [];
      for (const raw of userIds) {
        const uid = String(raw).trim();
        if (!uid) continue;
        const hasDev = await prisma.userRole.findFirst({ where: { userId: uid, roleId: developerRole.id } });
        if (!hasDev) continue;
        const row = await prisma.projectDeveloperAssignment
          .upsert({
            where: { projectId_userId: { projectId, userId: uid } },
            create: {
              orgId,
              projectId,
              userId: uid,
              status: "pending",
              invitedById: userId
            },
            update: { status: "pending", invitedById: userId, respondedAt: null }
          })
          .catch(() => null);
        if (row) {
          created.push(row);
          await prisma.notification.create({
            data: {
              orgId,
              channel: "in_app",
              to: uid,
              subject: "Project assignment",
              body: `You were invited to work on "${project.name}". Open Projects to accept or decline.`,
              status: "sent",
              type: "project.assignment",
              tier: "execution"
            }
          });
        }
      }
      res.status(201).json({ assignments: created });
    }
  );

  router.patch(
    "/:projectId/developer-assignments/:assignmentId/respond",
    requireRoles([ROLE_KEYS.developer]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId, assignmentId } = req.params;
      const { accept } = req.body as { accept?: boolean };
      const row = await prisma.projectDeveloperAssignment.findFirst({
        where: { id: assignmentId, projectId, orgId }
      });
      if (!row) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }
      if (row.userId !== userId) {
        res.status(403).json({ error: "You can only respond to your own invitation" });
        return;
      }
      const now = new Date();
      const status = accept === false ? "declined" : "accepted";
      const updated = await prisma.projectDeveloperAssignment.update({
        where: { id: assignmentId },
        data: { status, respondedAt: now }
      });
      if (status === "accepted") {
        const proj = await prisma.project.findFirst({ where: { id: projectId } });
        if (proj && !proj.assignedDeveloperId) {
          await prisma.project.update({
            where: { id: projectId },
            data: { assignedDeveloperId: row.userId }
          });
        }
      }
      res.json(updated);
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
      const access = await getProjectDeveloperAccess(prisma, project, userId);
      if (!isDirector && access !== "active") {
        res.status(403).json({ error: "Only an assigned developer who accepted the project can mark as reviewed" });
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
      const handoffAccess = await getProjectDeveloperAccess(prisma, project, userId);
      if (!isDirector && handoffAccess !== "active") {
        res.status(403).json({ error: "Only an accepted developer on this project can request handoff" });
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
    const access = await getProjectDeveloperAccess(prisma, project, userId);
    if (!isDirector && access !== "active") {
      res.status(403).json({ error: "Only an accepted developer on this project can add milestones" });
      return;
    }
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
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.sales, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const isAnalyst = req.auth!.roleKeys.includes(ROLE_KEYS.analyst);
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      const isFinance = req.auth!.roleKeys.includes(ROLE_KEYS.finance);
      const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      if (isFinance && project.approvalStatus !== "approved") {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const devAccess = await getProjectDeveloperAccess(prisma, project, userId);
      const canSeeTasks =
        isDirector ||
        isAnalyst ||
        (isFinance && project.approvalStatus === "approved") ||
        devAccess !== "none" ||
        (isSales && project.createdByUserId === userId);
      if (!canSeeTasks) {
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
      const access = await getProjectDeveloperAccess(prisma, project, userId);
      if (!isDirector && access !== "active") {
        res.status(403).json({ error: "Only a developer who accepted this project can add tasks" });
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
          status: "not_started",
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
        { type: "project.task", excludeUserId: userId, projectId: project.id }
      );
      res.status(201).json(task);
    }
  );

  // Task comments (assigned developer or director/analyst)
  router.get(
    "/tasks/:taskId/comments",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.sales, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { taskId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const isAnalyst = req.auth!.roleKeys.includes(ROLE_KEYS.analyst);
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      const isFinance = req.auth!.roleKeys.includes(ROLE_KEYS.finance);
      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
      if (!task || task.orgId !== orgId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      if (isFinance && task.project.approvalStatus !== "approved") {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      const devAccess = await getProjectDeveloperAccess(prisma, task.project, userId);
      const canSeeComments =
        isDirector ||
        isAnalyst ||
        (isFinance && task.project.approvalStatus === "approved") ||
        devAccess !== "none" ||
        (isSales && task.project.createdByUserId === userId);
      if (!canSeeComments) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      const comments = await prisma.taskComment.findMany({
        where: { orgId, taskId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } }
      });
      res.json(comments);
    }
  );

  router.post(
    "/tasks/:taskId/comments",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { taskId } = req.params;
      const isDirector = req.auth!.roleKeys.includes(ROLE_KEYS.director) || req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      const isSales = req.auth!.roleKeys.includes(ROLE_KEYS.sales);
      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
      if (!task || task.orgId !== orgId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      const access = await getProjectDeveloperAccess(prisma, task.project, userId);
      const salesCanComment = isSales && task.project.createdByUserId === userId;
      if (!isDirector && !salesCanComment && access !== "active") {
        res.status(403).json({ error: "Only Sales (project owner), Director, or an accepted developer on this project can add comments" });
        return;
      }
      const { body, type, audience, mentionedUserIds } = req.body as {
        body: string;
        type?: string;
        audience?: string;
        mentionedUserIds?: string[];
      };
      if (!body?.trim()) {
        res.status(400).json({ error: "Body is required" });
        return;
      }
      const allowedTypes = ["progress", "blocker", "completion", "scope_issue", "director_note"];
      const commentType = type && allowedTypes.includes(type) ? type : "progress";
      const aud = audience && ["all", "sales", "developers"].includes(audience) ? audience : "all";
      const mentions = Array.isArray(mentionedUserIds)
        ? [...new Set(mentionedUserIds.map((x) => String(x).trim()).filter(Boolean))]
        : [];
      const comment = await prisma.taskComment.create({
        data: {
          orgId,
          taskId,
          authorId: userId,
          body: body.trim(),
          type: commentType,
          audience: aud,
          mentionedUserIds: mentions
        }
      });
      await prisma.eventLog.create({
        data: { orgId, actorId: userId, type: "task.comment.added", entityType: "task", entityId: taskId, metadata: { commentId: comment.id } }
      });
      for (const mid of mentions) {
        if (mid === userId) continue;
        await prisma.notification.create({
          data: {
            orgId,
            channel: "in_app",
            to: mid,
            subject: "You were mentioned on a task",
            body: `On project "${task.project.name}": ${body.trim().slice(0, 240)}${body.length > 240 ? "…" : ""}`,
            status: "sent",
            type: "task.mention",
            tier: "execution"
          }
        });
      }
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
      const access = await getProjectDeveloperAccess(prisma, existing.project, userId);
      if (!isDirector && access !== "active") {
        res.status(403).json({ error: "Only an accepted developer on this project can edit this task" });
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

    const normalizedStatus =
      status === "todo" ? "not_started" : status;

    if (normalizedStatus === "blocked" && !blockedReason) {
      res.status(400).json({ error: "blockedReason is required when status is blocked" });
      return;
    }

    if (normalizedStatus === "done" && (existing.blockedReason || blockedReason)) {
      res.status(400).json({ error: "Task with blockedReason cannot be marked done" });
      return;
    }

    if (
      normalizedStatus != null &&
      !["not_started", "in_progress", "waiting_response", "blocked", "done"].includes(normalizedStatus)
    ) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const data: any = {
      status: normalizedStatus,
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
    if (normalizedStatus === "blocked") {
      events.push("task.blocked");
    }
    if (normalizedStatus === "done") {
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
      { type: "project.task", excludeUserId: userId, projectId: existing.project.id }
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

