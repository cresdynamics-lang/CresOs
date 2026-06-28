// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { getAcceptedDeveloperIds } from "../lib/project-access";
import { generatePmDailyCheckIn } from "../lib/pm-ai-checkin";
import { generatePmDeliveryBrief, generatePmSprintSuggestion } from "../lib/pm-ai-brief";
import { buildIntelligencePayload, scoreProjectHealth } from "../lib/pm-delivery-intelligence";
import { PM_PROJECT_LIST_SELECT, sanitizeProjectForPm } from "../lib/pm-project-view";
import { notifyDirectors } from "./director-notifications";

const PM_ACCESS = [ROLE_KEYS.project_manager, ROLE_KEYS.director, ROLE_KEYS.admin];
const PM_OR_DEV = [...PM_ACCESS, ROLE_KEYS.developer];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function postCheckInToTalks(
  prisma: PrismaClient,
  orgId: string,
  senderId: string,
  developerId: string,
  projectId: string,
  projectName: string,
  content: string
): Promise<string | null> {
  let conversation = await prisma.conversation.findFirst({
    where: { orgId, projectId, type: { in: ["channel", "project", "community"] } }
  });

  if (!conversation) {
    const participants = [...new Set([senderId, developerId])];
    conversation = await prisma.conversation.create({
      data: {
        orgId,
        projectId,
        type: "project",
        name: `${projectName} · Talks`,
        createdBy: senderId,
        participants,
        admins: [senderId],
        unreadCounts: Object.fromEntries(participants.map((id) => [id, id === developerId ? 1 : 0]))
      }
    });
  } else {
    const participants = [...new Set([...conversation.participants, senderId, developerId])];
    const unread = { ...(conversation.unreadCounts as Record<string, number>) };
    unread[developerId] = (unread[developerId] ?? 0) + 1;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { participants, unreadCounts: unread }
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      content,
      type: "text",
      metadata: { pmCheckIn: true, projectId, requiresResponse: true }
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: {
        id: message.id,
        content: content.slice(0, 200),
        senderId,
        timestamp: message.createdAt.toISOString(),
        type: "text"
      },
      updatedAt: new Date()
    }
  });

  return message.id;
}

export default function projectManagementRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get("/overview", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      select: { id: true, status: true }
    });
    const projectIds = projects.map((p) => p.id);
    const [openTasks, overdueMilestones, pendingCheckIns, reportsToday] = await Promise.all([
      prisma.task.count({
        where: { orgId, projectId: { in: projectIds }, deletedAt: null, status: { in: ["todo", "in_progress", "blocked"] } }
      }),
      prisma.milestone.count({
        where: {
          projectId: { in: projectIds },
          status: { in: ["pending", "in_progress"] },
          dueDate: { lt: new Date() }
        }
      }),
      prisma.pmDeveloperCheckIn.count({
        where: { orgId, status: "pending" }
      }),
      prisma.developerReport.count({
        where: {
          orgId,
          reportDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      })
    ]);

    res.json({
      activeProjects: projects.filter((p) => p.status === "active").length,
      totalProjects: projects.length,
      openTasks,
      overdueMilestones,
      pendingCheckIns,
      reportsToday
    });
  });

  router.get("/intelligence", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const withBrief = req.query.brief !== "0";
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      select: {
        id: true,
        name: true,
        status: true,
        successCriteria: true,
        managementProgressPercent: true,
        milestones: {
          select: { id: true, name: true, dueDate: true, status: true }
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true }
        }
      }
    });

    const projectIds = projects.map((p) => p.id);
    const [pendingByProject, reportsByProject, devCounts] = await Promise.all([
      prisma.pmDeveloperCheckIn.groupBy({
        by: ["projectId"],
        where: { orgId, status: "pending", projectId: { in: projectIds } },
        _count: { _all: true }
      }),
      prisma.developerReport.groupBy({
        by: ["projectId"],
        where: { orgId, projectId: { in: projectIds }, reportDate: { gte: weekAgo } },
        _count: { _all: true }
      }),
      Promise.all(
        projects.map(async (p) => ({
          projectId: p.id,
          count: (await getAcceptedDeveloperIds(prisma, p.id)).length
        }))
      )
    ]);

    const pendingMap = Object.fromEntries(pendingByProject.map((r) => [r.projectId, r._count._all]));
    const reportsMap = Object.fromEntries(reportsByProject.map((r) => [r.projectId, r._count._all]));
    const devMap = Object.fromEntries(devCounts.map((r) => [r.projectId, r.count]));

    const scored = projects.map((p) =>
      scoreProjectHealth({
        project: p,
        pendingCheckIns: pendingMap[p.id] ?? 0,
        reportsLast7Days: reportsMap[p.id] ?? 0,
        developerCount: devMap[p.id] ?? 0
      })
    );

    const base = buildIntelligencePayload(scored);
    const payload = { ...base, generatedAt: new Date().toISOString() };

    if (withBrief) {
      const user = await prisma.user.findFirst({
        where: { id: userId, orgId },
        select: { name: true }
      });
      const { brief, aiGenerated } = await generatePmDeliveryBrief(payload, user?.name);
      res.json({ ...payload, brief, briefAiGenerated: aiGenerated });
      return;
    }

    res.json(payload);
  });

  router.post("/projects/:id/sprint-suggestion", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, orgId, deletedAt: null, approvalStatus: "approved" },
      include: {
        milestones: true,
        tasks: { where: { deletedAt: null } }
      }
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const now = Date.now();
    const overdue = project.milestones.filter(
      (m) => m.status !== "completed" && m.dueDate && m.dueDate.getTime() < now
    );
    const blocked = project.tasks.filter((t) => t.status === "blocked").length;
    const health = scoreProjectHealth({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        successCriteria: project.successCriteria,
        managementProgressPercent: project.managementProgressPercent,
        milestones: project.milestones,
        tasks: project.tasks
      },
      pendingCheckIns: 0,
      reportsLast7Days: 0,
      developerCount: 1
    });

    const suggestion =
      (await generatePmSprintSuggestion({
        projectName: project.name,
        successCriteria: project.successCriteria,
        agileSprintNotes: project.agileSprintNotes,
        overdueMilestoneNames: overdue.map((m) => m.name),
        blockedTaskCount: blocked,
        healthScore: health.healthScore
      })) ||
      health.recommendedActions.map((a) => `• ${a}`).join("\n");

    res.json({ suggestion, healthScore: health.healthScore, riskLevel: health.riskLevel });
  });

  router.get("/projects", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      orderBy: { updatedAt: "desc" },
      select: PM_PROJECT_LIST_SELECT
    });
    res.json(projects.map((p) => sanitizeProjectForPm(p)));
  });

  router.get("/projects/:id", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params;
    const project = await prisma.project.findFirst({
      where: { id, orgId, deletedAt: null, approvalStatus: "approved" },
      include: {
        milestones: { orderBy: { dueDate: "asc" } },
        tasks: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { assignee: { select: { id: true, name: true, email: true } } }
        },
        developerAssignments: {
          where: { status: "accepted" },
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        assignedDeveloper: { select: { id: true, name: true, email: true } }
      }
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(sanitizeProjectForPm(project));
  });

  router.patch("/projects/:id", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params;
    const { successCriteria, agileSprintNotes, projectManagerUserId } = req.body as {
      successCriteria?: string;
      agileSprintNotes?: string;
      projectManagerUserId?: string | null;
    };
    const existing = await prisma.project.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(successCriteria !== undefined ? { successCriteria: successCriteria.trim() || null } : {}),
        ...(agileSprintNotes !== undefined ? { agileSprintNotes: agileSprintNotes.trim() || null } : {}),
        ...(projectManagerUserId !== undefined ? { projectManagerUserId: projectManagerUserId || null } : {})
      },
      select: PM_PROJECT_LIST_SELECT
    });
    res.json(sanitizeProjectForPm(updated));
  });

  router.post("/projects/:id/milestones", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projectId = req.params.id;
    const { name, dueDate, acceptanceCriteria } = req.body as {
      name?: string;
      dueDate?: string;
      acceptanceCriteria?: string;
    };
    if (!name?.trim()) {
      res.status(400).json({ error: "Milestone name required" });
      return;
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const milestone = await prisma.milestone.create({
      data: {
        orgId,
        projectId,
        name: name.trim(),
        dueDate: dueDate ? new Date(dueDate) : null,
        acceptanceCriteria: acceptanceCriteria?.trim() || null,
        status: "pending"
      }
    });
    res.status(201).json(milestone);
  });

  router.patch("/milestones/:id", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params;
    const { status, completionNotes, name, dueDate } = req.body as {
      status?: string;
      completionNotes?: string;
      name?: string;
      dueDate?: string;
    };
    const milestone = await prisma.milestone.findFirst({
      where: { id },
      include: { project: { select: { orgId: true } } }
    });
    if (!milestone || milestone.project.orgId !== orgId) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    const updated = await prisma.milestone.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(completionNotes !== undefined ? { completionNotes: completionNotes.trim() || null } : {}),
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {})
      }
    });
    res.json(updated);
  });

  router.post("/projects/:id/tasks", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projectId = req.params.id;
    const { title, description, assigneeId, milestoneId, dueDate, priority } = req.body as {
      title?: string;
      description?: string;
      assigneeId?: string;
      milestoneId?: string;
      dueDate?: string;
      priority?: string;
    };
    if (!title?.trim()) {
      res.status(400).json({ error: "Task title required" });
      return;
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const task = await prisma.task.create({
      data: {
        orgId,
        projectId,
        title: title.trim(),
        description: description?.trim() || null,
        assigneeId: assigneeId || null,
        milestoneId: milestoneId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || "medium",
        status: "todo"
      },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });

    if (assigneeId) {
      await prisma.scheduleItem.create({
        data: {
          orgId,
          userId: assigneeId,
          title: task.title,
          type: "task",
          scheduledAt: task.dueDate ?? new Date(),
          notes: `Assigned from project: ${project.name}`,
          status: "scheduled"
        }
      });
    }

    res.status(201).json(task);
  });

  router.get("/team", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved", status: { in: ["active", "planned"] } },
      select: { id: true, name: true }
    });
    const projectIds = projects.map((p) => p.id);
    const devIds = new Set<string>();
    for (const pid of projectIds) {
      const ids = await getAcceptedDeveloperIds(prisma, pid);
      ids.forEach((id) => devIds.add(id));
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...devIds] }, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        currentFocusProject: { select: { id: true, name: true } }
      }
    });
    res.json(users);
  });

  router.get("/reports", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const reports = await prisma.developerReport.findMany({
      where: { orgId },
      orderBy: { reportDate: "desc" },
      take: 100,
      include: {
        submittedBy: { select: { id: true, name: true, email: true } }
      }
    });
    res.json(reports);
  });

  router.get("/payments", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const user = await prisma.user.findFirst({
      where: { id: userId, orgId },
      select: { monthlySalary: true, jobTitle: true, employmentType: true }
    });
    const payouts = await prisma.payout.findMany({
      where: { orgId, userId },
      orderBy: { createdAt: "desc" },
      take: 24
    });
    res.json({
      monthlySalary: user?.monthlySalary ? Number(user.monthlySalary) : null,
      jobTitle: user?.jobTitle,
      employmentType: user?.employmentType,
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt
      }))
    });
  });

  router.get("/check-ins", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const rows = await prisma.pmDeveloperCheckIn.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        project: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true, email: true } },
        sentBy: { select: { id: true, name: true } }
      }
    });
    res.json(rows);
  });

  router.get("/check-ins/inbox", requireRoles([ROLE_KEYS.developer, ...PM_ACCESS]), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const isDev = req.auth!.roleKeys.includes(ROLE_KEYS.developer);
    const where = isDev ? { orgId, developerId: userId } : { orgId };
    const rows = await prisma.pmDeveloperCheckIn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        project: { select: { id: true, name: true } },
        sentBy: { select: { id: true, name: true } }
      }
    });
    res.json(rows);
  });

  router.post("/check-ins", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { projectId, developerId, message, useAi } = req.body as {
      projectId?: string;
      developerId?: string;
      message?: string;
      useAi?: boolean;
    };
    if (!projectId || !developerId) {
      res.status(400).json({ error: "projectId and developerId required" });
      return;
    }
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, deletedAt: null },
      include: { milestones: { where: { status: { in: ["pending", "in_progress"] } }, take: 1 } }
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const developer = await prisma.user.findFirst({ where: { id: developerId, orgId, deletedAt: null } });
    if (!developer) {
      res.status(404).json({ error: "Developer not found" });
      return;
    }

    const dayKey = todayKey();
    const existing = await prisma.pmDeveloperCheckIn.findUnique({
      where: { projectId_developerId_dayKey: { projectId, developerId, dayKey } }
    });
    if (existing) {
      res.status(400).json({ error: "Check-in already sent today for this developer on this project" });
      return;
    }

    let text = message?.trim() || "";
    let aiGenerated = false;
    if (useAi || !text) {
      const ai = await generatePmDailyCheckIn({
        projectName: project.name,
        successCriteria: project.successCriteria || project.projectDetails,
        developerName: developer.name,
        milestoneName: project.milestones[0]?.name ?? null,
        priorToneIndex: new Date().getDate()
      });
      if (ai) {
        text = ai;
        aiGenerated = true;
      }
    }
    if (!text) {
      text = `Quick check-in on ${project.name} — what did you ship yesterday and what's blocking you today?`;
    }

    const messageId = await postCheckInToTalks(
      prisma,
      orgId,
      userId,
      developerId,
      projectId,
      project.name,
      text
    );

    const row = await prisma.pmDeveloperCheckIn.create({
      data: {
        orgId,
        projectId,
        developerId,
        sentById: userId,
        message: text,
        aiGenerated,
        dayKey,
        messageId,
        status: "pending"
      },
      include: {
        project: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } }
      }
    });

    res.status(201).json(row);
  });

  router.post("/check-ins/daily-batch", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved", status: "active" },
      include: { milestones: { where: { status: { in: ["pending", "in_progress"] } }, take: 1 } }
    });
    const dayKey = todayKey();
    const created = [];
    for (const project of projects) {
      const devIds = await getAcceptedDeveloperIds(prisma, project.id);
      for (const developerId of devIds) {
        const exists = await prisma.pmDeveloperCheckIn.findUnique({
          where: { projectId_developerId_dayKey: { projectId: project.id, developerId, dayKey } }
        });
        if (exists) continue;
        const developer = await prisma.user.findFirst({ where: { id: developerId } });
        const ai = await generatePmDailyCheckIn({
          projectName: project.name,
          successCriteria: project.successCriteria || project.projectDetails,
          developerName: developer?.name,
          milestoneName: project.milestones[0]?.name ?? null,
          priorToneIndex: developerId.length + new Date().getDate()
        });
        const text =
          ai ||
          `How's delivery on ${project.name} today? Anything we should adjust on milestones or tasks?`;
        const messageId = await postCheckInToTalks(
          prisma,
          orgId,
          userId,
          developerId,
          project.id,
          project.name,
          text
        );
        const row = await prisma.pmDeveloperCheckIn.create({
          data: {
            orgId,
            projectId: project.id,
            developerId,
            sentById: userId,
            message: text,
            aiGenerated: Boolean(ai),
            dayKey,
            messageId,
            status: "pending"
          }
        });
        created.push(row);
      }
    }
    res.json({ sent: created.length, checkIns: created });
  });

  router.post("/check-ins/:id/respond", requireRoles(PM_OR_DEV), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { id } = req.params;
    const { response } = req.body as { response?: string };
    if (!response?.trim()) {
      res.status(400).json({ error: "Response required" });
      return;
    }
    const row = await prisma.pmDeveloperCheckIn.findFirst({
      where: { id, orgId },
      include: { project: { select: { name: true } } }
    });
    if (!row) {
      res.status(404).json({ error: "Check-in not found" });
      return;
    }
    if (row.developerId !== userId && !req.auth!.roleKeys.some((k) => PM_ACCESS.includes(k as never))) {
      res.status(403).json({ error: "Only the assigned developer can respond" });
      return;
    }
    const updated = await prisma.pmDeveloperCheckIn.update({
      where: { id },
      data: {
        response: response.trim(),
        respondedAt: new Date(),
        status: "answered"
      }
    });

    await notifyDirectors(
      prisma,
      orgId,
      `Developer responded: ${row.project.name}`,
      `${response.trim().slice(0, 500)}`,
      { type: "pm_checkin.answered" }
    );

    res.json(updated);
  });

  return router;
}
