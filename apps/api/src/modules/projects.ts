import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function projectsRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Projects list & create
  router.get(
    "/",
    requireRoles([ROLE_KEYS.ops, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    res.json(projects);
    }
  );

  router.post(
    "/",
    requireRoles([ROLE_KEYS.ops]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { name, clientId, dealId } = req.body as {
      name: string;
      clientId?: string;
      dealId?: string;
    };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        status: "active",
        clientId,
        dealId,
        ownerUserId: userId,
        createdByUserId: userId,
        startDate: new Date()
      }
    });

    await prisma.eventLog.create({
      data: {
        orgId,
        actorId: userId,
        type: "project.created",
        entityType: "project",
        entityId: project.id,
        metadata: { name: project.name }
      }
    });
    res.status(201).json(project);
    }
  );

  // Milestones
  router.get(
    "/:projectId/milestones",
    requireRoles([ROLE_KEYS.ops, ROLE_KEYS.director, ROLE_KEYS.analyst]),
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
    requireRoles([ROLE_KEYS.ops]),
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

  // Tasks
  router.get(
    "/:projectId/tasks",
    requireRoles([ROLE_KEYS.ops, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const { projectId } = req.params;
    const tasks = await prisma.task.findMany({
      where: { orgId, projectId, deletedAt: null },
      orderBy: { dueDate: "asc" }
    });
    res.json(tasks);
    }
  );

  router.post(
    "/:projectId/tasks",
    requireRoles([ROLE_KEYS.ops]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { projectId } = req.params;
    const { title, description, milestoneId, dueDate } = req.body as {
      title: string;
      description?: string;
      milestoneId?: string;
      dueDate?: string;
    };
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    const task = await prisma.task.create({
      data: {
        orgId,
        projectId,
        milestoneId,
        title,
        description,
        status: "todo",
        assigneeId: userId,
        dueDate: dueDate ? new Date(dueDate) : undefined
      }
    });

    await prisma.eventLog.create({
      data: {
        orgId,
        actorId: userId,
        type: "task.created",
        entityType: "task",
        entityId: task.id,
        metadata: { projectId }
      }
    });
    res.status(201).json(task);
    }
  );

  // Task comments
  router.get(
    "/tasks/:taskId/comments",
    requireRoles([ROLE_KEYS.ops, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const { taskId } = req.params;
    const comments = await prisma.taskComment.findMany({
      where: { orgId, taskId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    res.json(comments);
    }
  );

  router.post(
    "/tasks/:taskId/comments",
    requireRoles([ROLE_KEYS.ops]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
      const { taskId } = req.params;
      const { body, type } = req.body as { body: string; type?: string };
    if (!body) {
      res.status(400).json({ error: "Body is required" });
      return;
    }
      const allowedTypes = ["progress", "blocker", "completion", "scope_issue"];
      const commentType = type && allowedTypes.includes(type) ? type : "progress";
    const comment = await prisma.taskComment.create({
      data: {
        orgId,
        taskId,
        authorId: userId,
          body,
          type: commentType
      }
    });

    await prisma.eventLog.create({
      data: {
        orgId,
        actorId: userId,
        type: "task.comment.added",
        entityType: "task",
        entityId: taskId,
        metadata: { commentId: comment.id }
      }
    });
    res.status(201).json(comment);
    }
  );

  // Update task status / priority / blocked reason
  router.patch(
    "/tasks/:taskId",
    requireRoles([ROLE_KEYS.ops]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { taskId } = req.params;
    const { status, priority, blockedReason, dueDate } = req.body as {
      status?: string;
      priority?: string;
      blockedReason?: string;
      dueDate?: string;
    };

    if (status === "blocked" && !blockedReason) {
      res.status(400).json({ error: "blockedReason is required when status is blocked" });
      return;
    }

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    if (status === "done" && (existing.blockedReason || blockedReason)) {
      res.status(400).json({ error: "Task with blockedReason cannot be marked done" });
      return;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        priority,
        blockedReason,
        dueDate: dueDate ? new Date(dueDate) : undefined
      }
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

    res.json(task);
    }
  );

  // Request approval for milestone completion
  router.post(
    "/milestones/:id/request-approval",
    requireRoles([ROLE_KEYS.ops]),
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

      res.json(updated);
    }
  );

  return router;
}

