// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { getAcceptedDeveloperIds } from "../lib/project-access";
import {
  extractPriorQuestionsFromRows,
  formatAnswersAsResponse,
  formatCheckInDisplayText,
  generateRoleProjectCheckIn,
  resolveSenderRole,
  type CheckInQuestion,
  type RoleCheckInPayload,
  type SenderRole
} from "../lib/role-project-checkin";
import { generatePmDeliveryBrief, generatePmSprintSuggestion } from "../lib/pm-ai-brief";
import { buildIntelligencePayload, scoreProjectHealth } from "../lib/pm-delivery-intelligence";
import { buildPmWorkspaceCompanion } from "../lib/pm-workspace-companion";
import { fetchKnowledgeChunks, getKnowledgePoolStats } from "../lib/knowledge-context";
import { syncOrgKnowledgePool } from "../lib/knowledge-backfill";
import { generateKnowledgeInsights } from "../lib/knowledge-ai-insights";
import { PM_PROJECT_LIST_SELECT, sanitizeProjectForPm } from "../lib/pm-project-view";
import {
  enrichCheckInsWithConversationIds,
  postCheckInReplyToCommunity,
  postCheckInToCommunity
} from "../lib/pm-checkin-community";

const PM_ACCESS = [ROLE_KEYS.project_manager, ROLE_KEYS.director, ROLE_KEYS.admin];
const KNOWLEDGE_ACCESS = [...PM_ACCESS, ROLE_KEYS.sales];
const PM_OR_DEV = [...PM_ACCESS, ROLE_KEYS.developer];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

import { notifyDirectors } from "./director-notifications";

async function loadPriorQuestions(
  prisma: PrismaClient,
  projectId: string,
  developerId: string,
  senderRole: SenderRole
): Promise<string[]> {
  const rows = await prisma.pmDeveloperCheckIn.findMany({
    where: { projectId, developerId, senderRole },
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { questionsJson: true, message: true }
  });
  return extractPriorQuestionsFromRows(rows);
}

async function buildCheckInPayload(
  prisma: PrismaClient,
  input: {
    senderRole: SenderRole;
    project: {
      name: string;
      successCriteria: string | null;
      projectDetails: string | null;
      milestones: { name: string }[];
    };
    developer: { name: string | null };
    projectId: string;
    developerId: string;
    useAi: boolean;
    customMessage?: string;
  }
): Promise<RoleCheckInPayload> {
  const overdue = await prisma.milestone.count({
    where: {
      projectId: input.projectId,
      status: { in: ["pending", "in_progress"] },
      dueDate: { lt: new Date() }
    }
  });
  const openTasks = await prisma.task.count({
    where: {
      projectId: input.projectId,
      deletedAt: null,
      status: { in: ["todo", "in_progress", "blocked"] }
    }
  });
  const priorQuestions = await loadPriorQuestions(
    prisma,
    input.projectId,
    input.developerId,
    input.senderRole
  );

  if (input.useAi || !input.customMessage?.trim()) {
    return generateRoleProjectCheckIn({
      senderRole: input.senderRole,
      projectName: input.project.name,
      successCriteria: input.project.successCriteria || input.project.projectDetails,
      developerName: input.developer.name,
      milestoneName: input.project.milestones[0]?.name ?? null,
      overdueMilestones: overdue,
      openTasks,
      priorQuestions
    });
  }

  return {
    intro: input.customMessage!.trim(),
    questions: [
      {
        id: "q1",
        text: "What did you complete on this project since we last spoke?",
        placeholder: "Shipped work or progress…"
      },
      {
        id: "q2",
        text: "What needs attention or is blocking delivery next?",
        placeholder: "Blockers or next step…"
      }
    ],
    aiGenerated: false
  };
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

  router.get("/companion", requireRoles(PM_ACCESS), async (req, res) => {
    try {
      const payload = await buildPmWorkspaceCompanion(
        prisma,
        req.auth!.orgId,
        req.auth!.userId,
        req.auth!.sessionId
      );
      res.json(payload);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[pm] companion:", e);
      res.status(500).json({ error: "Failed to load workspace companion" });
    }
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
    const recentReports = await prisma.developerReport.findMany({
      where: { orgId, reportDate: { gte: weekAgo } },
      select: { submittedById: true }
    });
    const devsWhoReported = new Set(recentReports.map((r) => r.submittedById));

    const [pendingByProject, devCounts] = await Promise.all([
      prisma.pmDeveloperCheckIn.groupBy({
        by: ["projectId"],
        where: { orgId, status: "pending", projectId: { in: projectIds } },
        _count: { _all: true }
      }),
      Promise.all(
        projects.map(async (p) => {
          const devIds = await getAcceptedDeveloperIds(prisma, p.id);
          const reportsLast7Days = devIds.filter((id) => devsWhoReported.has(id)).length;
          return { projectId: p.id, count: devIds.length, reportsLast7Days };
        })
      )
    ]);

    const pendingMap = Object.fromEntries(pendingByProject.map((r) => [r.projectId, r._count._all]));
    const devMap = Object.fromEntries(devCounts.map((r) => [r.projectId, r.count]));
    const reportsMap = Object.fromEntries(devCounts.map((r) => [r.projectId, r.reportsLast7Days]));

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
      const { brief, aiGenerated } = await generatePmDeliveryBrief(payload, user?.name, prisma, orgId);
      res.json({ ...payload, brief, briefAiGenerated: aiGenerated });
      return;
    }

    res.json(payload);
  });

  router.get("/knowledge", requireRoles(KNOWLEDGE_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const sourceType = typeof req.query.sourceType === "string" ? req.query.sourceType : undefined;
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const sinceDays = req.query.sinceDays != null ? Number(req.query.sinceDays) : undefined;

    const [chunks, stats] = await Promise.all([
      fetchKnowledgeChunks(prisma, orgId, { projectId, q, sourceType, kind, sinceDays, limit: q ? 100 : 60 }),
      getKnowledgePoolStats(prisma, orgId)
    ]);

    res.json({
      stats,
      chunks: chunks.map((c) => ({
        ...c,
        occurredAt: c.occurredAt.toISOString()
      }))
    });
  });

  router.post("/knowledge/sync", requireRoles(KNOWLEDGE_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const body = (req.body || {}) as { sinceDays?: number; fullHistory?: boolean };
    const sinceDays = body.fullHistory ? 0 : body.sinceDays ?? 0;
    try {
      const result = await syncOrgKnowledgePool(prisma, orgId, { sinceDays });
      const stats = await getKnowledgePoolStats(prisma, orgId);
      res.json({ ok: true, ...result, stats });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Knowledge sync failed" });
    }
  });

  router.get("/knowledge/insights", requireRoles(KNOWLEDGE_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const roleKeys = req.auth!.roleKeys;
    const audience = roleKeys.includes(ROLE_KEYS.sales)
      ? "sales"
      : roleKeys.includes(ROLE_KEYS.director)
        ? "director"
        : "pm";

    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      select: {
        id: true,
        name: true,
        status: true,
        successCriteria: true,
        managementProgressPercent: true,
        milestones: { select: { id: true, name: true, dueDate: true, status: true } },
        tasks: { where: { deletedAt: null }, select: { status: true } }
      }
    });
    const scored = projects.map((p) =>
      scoreProjectHealth({
        project: p,
        pendingCheckIns: 0,
        reportsLast7Days: 0,
        developerCount: 0
      })
    );
    const intel = { ...buildIntelligencePayload(scored), generatedAt: new Date().toISOString() };

    const result = await generateKnowledgeInsights(prisma, orgId, {
      projectId,
      intel,
      audience
    });
    res.json(result);
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
    res.json(await enrichCheckInsWithConversationIds(prisma, rows));
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
    res.json(await enrichCheckInsWithConversationIds(prisma, rows));
  });

  router.post("/check-ins", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const senderRole = resolveSenderRole(req.auth!.roleKeys);
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
      where: {
        projectId_developerId_dayKey_senderRole: { projectId, developerId, dayKey, senderRole }
      }
    });
    if (existing) {
      res.status(400).json({
        error: `Check-in already sent today for this developer (${senderRole === "director_admin" ? "Director" : "PM"})`
      });
      return;
    }

    const payload = await buildCheckInPayload(prisma, {
      senderRole,
      project,
      developer,
      projectId,
      developerId,
      useAi: useAi !== false,
      customMessage: message
    });

    const row = await prisma.pmDeveloperCheckIn.create({
      data: {
        orgId,
        projectId,
        developerId,
        sentById: userId,
        senderRole,
        message: formatCheckInDisplayText(payload.intro, payload.questions),
        questionsJson: payload.questions,
        aiGenerated: payload.aiGenerated,
        dayKey,
        status: "pending"
      },
      include: {
        project: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } }
      }
    });

    const posted = await postCheckInToCommunity(prisma, {
      orgId,
      senderId: userId,
      developerId,
      projectId,
      projectName: project.name,
      checkInId: row.id,
      senderRole,
      payload
    });

    const updated = await prisma.pmDeveloperCheckIn.update({
      where: { id: row.id },
      data: { messageId: posted.messageId },
      include: {
        project: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({ ...updated, conversationId: posted.conversationId });
  });

  router.post("/check-ins/daily-batch", requireRoles(PM_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const senderRole: SenderRole = "project_manager";
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
          where: {
            projectId_developerId_dayKey_senderRole: {
              projectId: project.id,
              developerId,
              dayKey,
              senderRole
            }
          }
        });
        if (exists) continue;
        const developer = await prisma.user.findFirst({ where: { id: developerId } });
        const payload = await buildCheckInPayload(prisma, {
          senderRole,
          project,
          developer: developer ?? { name: null },
          projectId: project.id,
          developerId,
          useAi: true
        });
        const row = await prisma.pmDeveloperCheckIn.create({
          data: {
            orgId,
            projectId: project.id,
            developerId,
            sentById: userId,
            senderRole,
            message: formatCheckInDisplayText(payload.intro, payload.questions),
            questionsJson: payload.questions,
            aiGenerated: payload.aiGenerated,
            dayKey,
            status: "pending"
          }
        });
        const posted = await postCheckInToCommunity(prisma, {
          orgId,
          senderId: userId,
          developerId,
          projectId: project.id,
          projectName: project.name,
          checkInId: row.id,
          senderRole,
          payload
        });
        await prisma.pmDeveloperCheckIn.update({
          where: { id: row.id },
          data: { messageId: posted.messageId }
        });
        created.push({ ...row, messageId: posted.messageId, conversationId: posted.conversationId });
      }
    }
    res.json({ sent: created.length, checkIns: created });
  });

  router.post("/check-ins/:id/respond", requireRoles(PM_OR_DEV), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { id } = req.params;
    const { response, answers } = req.body as {
      response?: string;
      answers?: Record<string, string>;
    };

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

    const questions = (row.questionsJson as CheckInQuestion[] | null) ?? [];
    let responseText = response?.trim() ?? "";
    let answersJson: Record<string, string> | undefined;

    if (answers && typeof answers === "object" && questions.length > 0) {
      const missing = questions.filter((q) => !(answers[q.id] ?? "").trim());
      if (missing.length > 0) {
        res.status(400).json({ error: "Please answer all questions", missingIds: missing.map((q) => q.id) });
        return;
      }
      answersJson = Object.fromEntries(questions.map((q) => [q.id, (answers[q.id] ?? "").trim()]));
      responseText = formatAnswersAsResponse(questions, answersJson);
    }

    if (!responseText) {
      res.status(400).json({ error: "Response required" });
      return;
    }

    const updated = await prisma.pmDeveloperCheckIn.update({
      where: { id },
      data: {
        response: responseText,
        answersJson: answersJson ?? undefined,
        respondedAt: new Date(),
        status: "answered"
      }
    });

    const replyMessageId = await postCheckInReplyToCommunity(prisma, {
      orgId,
      developerId: userId,
      checkInMessageId: row.messageId,
      projectName: row.project.name,
      checkInId: row.id,
      questions,
      answers: answersJson ?? {}
    });

    const roleLabel = row.senderRole === "director_admin" ? "Director" : "Project Manager";
    await notifyDirectors(
      prisma,
      orgId,
      `Developer answered ${roleLabel} check-in: ${row.project.name}`,
      `${responseText.trim().slice(0, 500)}`,
      { type: "pm_checkin.answered" }
    );

    res.json({ ...updated, replyMessageId });
  });

  return router;
}
