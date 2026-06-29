// @ts-nocheck
import type { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import multer from "multer";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { applyProjectAiPlan } from "../lib/apply-project-ai-plan";
import { extractPlanningDocumentText } from "../lib/project-document-text";
import {
  generateProjectPlanFromBrief,
  generateDeliveryPlanFromDetails,
  transcribeProjectPlanningAudio
} from "../lib/groq-project-planner";
import { countPlanMilestones, countPlanTasks } from "../lib/project-ai-plan-types";

const PLANNER_ROLES = [
  ROLE_KEYS.sales,
  ROLE_KEYS.director,
  ROLE_KEYS.admin,
  ROLE_KEYS.project_manager
];

const CLIENT_REMARK_ROLES = [ROLE_KEYS.client, ROLE_KEYS.sales, ROLE_KEYS.director];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

function primaryRole(roleKeys: string[]): string {
  if (roleKeys.includes(ROLE_KEYS.director)) return ROLE_KEYS.director;
  if (roleKeys.includes(ROLE_KEYS.project_manager)) return ROLE_KEYS.project_manager;
  if (roleKeys.includes(ROLE_KEYS.sales)) return ROLE_KEYS.sales;
  if (roleKeys.includes(ROLE_KEYS.client)) return ROLE_KEYS.client;
  return roleKeys[0] ?? "user";
}

async function loadProjectContext(prisma: PrismaClient, orgId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null },
    include: {
      milestones: { where: { deletedAt: null }, select: { name: true } },
      tasks: { where: { deletedAt: null }, select: { title: true }, take: 80 }
    }
  });
  if (!project) return null;
  return {
    project,
    existingContext: {
      projectName: project.name,
      projectDetails: project.projectDetails,
      successCriteria: project.successCriteria,
      agileSprintNotes: project.agileSprintNotes,
      existingMilestones: project.milestones.map((m) => m.name),
      existingTaskTitles: project.tasks.map((t) => t.title)
    }
  };
}

async function savePlanningNote(
  prisma: PrismaClient,
  input: {
    orgId: string;
    projectId?: string | null;
    source: string;
    authorRole: string;
    authorUserId: string;
    rawText: string;
    aiSummary?: string;
    roleBriefs?: object;
    planJson?: object;
    fileName?: string;
  }
) {
  return prisma.projectPlanningNote.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      source: input.source,
      authorRole: input.authorRole,
      authorUserId: input.authorUserId,
      rawText: input.rawText,
      aiSummary: input.aiSummary ?? null,
      roleBriefs: input.roleBriefs ?? undefined,
      planJson: input.planJson ?? undefined,
      fileName: input.fileName ?? null
    }
  });
}

export function registerProjectAiPlanningRoutes(router: Router, prisma: PrismaClient): void {
  router.post(
    "/ai/plan-from-text",
    requireRoles(PLANNER_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = (req.body || {}) as { brief?: string; projectId?: string };
      const brief = body.brief?.trim();
      if (!brief) {
        res.status(400).json({ error: "brief is required" });
        return;
      }

      let existingContext;
      if (body.projectId) {
        const loaded = await loadProjectContext(prisma, orgId, body.projectId);
        if (!loaded) {
          res.status(404).json({ error: "Project not found" });
          return;
        }
        existingContext = loaded.existingContext;
      }

      const { plan, transcript } = await generateProjectPlanFromBrief({
        brief,
        sourceLabel: "text",
        existingContext
      });

      await savePlanningNote(prisma, {
        orgId,
        projectId: body.projectId ?? null,
        source: "text",
        authorRole: primaryRole(req.auth!.roleKeys),
        authorUserId: req.auth!.userId,
        rawText: transcript,
        aiSummary: plan.projectSummary,
        roleBriefs: plan.roleBriefs,
        planJson: plan
      });

      res.json({
        plan,
        stats: {
          sprints: plan.sprints.length,
          milestones: countPlanMilestones(plan),
          tasks: countPlanTasks(plan)
        }
      });
    }
  );

  router.post(
    "/ai/plan-from-voice",
    requireRoles(PLANNER_ROLES),
    upload.single("audio"),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }

      const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : undefined;
      const transcript =
        (await transcribeProjectPlanningAudio(file.buffer, file.mimetype, file.originalname)) ?? "";

      if (!transcript.trim()) {
        res.status(422).json({ error: "Could not transcribe audio. Try again or type the brief." });
        return;
      }

      let existingContext;
      if (projectId) {
        const loaded = await loadProjectContext(prisma, orgId, projectId);
        if (!loaded) {
          res.status(404).json({ error: "Project not found" });
          return;
        }
        existingContext = loaded.existingContext;
      }

      const { plan } = await generateProjectPlanFromBrief({
        brief: transcript,
        sourceLabel: "voice",
        existingContext
      });

      await savePlanningNote(prisma, {
        orgId,
        projectId: projectId ?? null,
        source: "voice",
        authorRole: primaryRole(req.auth!.roleKeys),
        authorUserId: req.auth!.userId,
        rawText: transcript,
        aiSummary: plan.projectSummary,
        roleBriefs: plan.roleBriefs,
        planJson: plan,
        fileName: file.originalname
      });

      res.json({
        transcript,
        plan,
        stats: {
          sprints: plan.sprints.length,
          milestones: countPlanMilestones(plan),
          tasks: countPlanTasks(plan)
        }
      });
    }
  );

  router.post(
    "/ai/plan-from-document",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.sales, ROLE_KEYS.project_manager]),
    upload.single("document"),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "document file is required" });
        return;
      }

      const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : undefined;
      let text: string;
      try {
        text = await extractPlanningDocumentText(file.buffer, file.mimetype, file.originalname);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message || "Could not read document" });
        return;
      }
      if (!text.trim()) {
        res.status(422).json({ error: "No readable text in document" });
        return;
      }

      let existingContext;
      if (projectId) {
        const loaded = await loadProjectContext(prisma, orgId, projectId);
        if (!loaded) {
          res.status(404).json({ error: "Project not found" });
          return;
        }
        existingContext = loaded.existingContext;
      }

      const { plan } = await generateProjectPlanFromBrief({
        brief: text.slice(0, 120_000),
        sourceLabel: `document:${file.originalname}`,
        existingContext,
        isDocument: true
      });

      await savePlanningNote(prisma, {
        orgId,
        projectId: projectId ?? null,
        source: "document",
        authorRole: primaryRole(req.auth!.roleKeys),
        authorUserId: req.auth!.userId,
        rawText: text.slice(0, 50_000),
        aiSummary: plan.projectSummary,
        roleBriefs: plan.roleBriefs,
        planJson: plan,
        fileName: file.originalname
      });

      res.json({
        extractedChars: text.length,
        plan,
        stats: {
          sprints: plan.sprints.length,
          milestones: countPlanMilestones(plan),
          tasks: countPlanTasks(plan)
        }
      });
    }
  );

  router.post(
    "/ai/plan-from-details",
    requireRoles(PLANNER_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = (req.body || {}) as {
        projectDetails?: string;
        projectType?: string;
        successCriteria?: string;
        projectId?: string;
      };
      const projectDetails = body.projectDetails?.trim();
      if (!projectDetails) {
        res.status(400).json({ error: "projectDetails is required" });
        return;
      }

      let existingContext;
      if (body.projectId) {
        const loaded = await loadProjectContext(prisma, orgId, body.projectId);
        if (!loaded) {
          res.status(404).json({ error: "Project not found" });
          return;
        }
        existingContext = loaded.existingContext;
      }

      const delivery = await generateDeliveryPlanFromDetails({
        projectDetails,
        projectType: body.projectType,
        successCriteria: body.successCriteria,
        existingContext
      });

      const plan = {
        projectSummary: "",
        projectDetails,
        projectType: body.projectType,
        successCriteria: delivery.successCriteria || body.successCriteria || "",
        agileSprintNotes: delivery.agileSprintNotes,
        timeline: delivery.timeline,
        sprints: delivery.sprints,
        roleBriefs: delivery.roleBriefs
      };

      res.json({
        plan,
        stats: {
          sprints: plan.sprints.length,
          milestones: countPlanMilestones(plan as any),
          tasks: countPlanTasks(plan as any)
        }
      });
    }
  );

  router.post(
    "/:projectId/ai/apply-plan",
    requireRoles(PLANNER_ROLES),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { projectId } = req.params;
      const body = (req.body || {}) as { plan?: object; merge?: boolean };
      if (!body.plan) {
        res.status(400).json({ error: "plan is required" });
        return;
      }

      const loaded = await loadProjectContext(prisma, orgId, projectId);
      if (!loaded) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      try {
        const result = await applyProjectAiPlan(prisma, {
          orgId,
          projectId,
          plan: body.plan as any,
          merge: body.merge !== false
        });
        res.json({ ok: true, ...result });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message || "Failed to apply plan" });
      }
    }
  );

  router.post(
    "/:projectId/ai/client-remark",
    requireRoles(CLIENT_REMARK_ROLES),
    upload.fields([
      { name: "audio", maxCount: 1 },
      { name: "document", maxCount: 1 }
    ]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { projectId } = req.params;
      const loaded = await loadProjectContext(prisma, orgId, projectId);
      if (!loaded) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const textBrief = typeof req.body?.brief === "string" ? req.body.brief.trim() : "";
      const audioFile = req.files?.audio?.[0];
      const docFile = req.files?.document?.[0];

      let brief = textBrief;
      if (audioFile?.buffer?.length) {
        const transcript = await transcribeProjectPlanningAudio(
          audioFile.buffer,
          audioFile.mimetype,
          audioFile.originalname
        );
        brief = [brief, transcript].filter(Boolean).join("\n\n");
      }
      if (docFile?.buffer?.length) {
        try {
          const docText = await extractPlanningDocumentText(
            docFile.buffer,
            docFile.mimetype,
            docFile.originalname
          );
          brief = [brief, docText].filter(Boolean).join("\n\n");
        } catch {
          // ignore doc read errors if text brief exists
        }
      }

      if (!brief.trim()) {
        res.status(400).json({ error: "Provide text, voice, or a document remark" });
        return;
      }

      const { plan } = await generateProjectPlanFromBrief({
        brief,
        sourceLabel: "client_remark",
        existingContext: loaded.existingContext,
        clientRemark: true
      });

      const apply = req.body?.apply !== "false";
      let applied = { milestonesCreated: 0, tasksCreated: 0 };
      if (apply) {
        applied = await applyProjectAiPlan(prisma, {
          orgId,
          projectId,
          plan,
          merge: true
        });
      }

      const note = await savePlanningNote(prisma, {
        orgId,
        projectId,
        source: "client_remark",
        authorRole: primaryRole(req.auth!.roleKeys),
        authorUserId: req.auth!.userId,
        rawText: brief.slice(0, 50_000),
        aiSummary: plan.projectSummary,
        roleBriefs: plan.roleBriefs,
        planJson: plan
      });

      res.json({
        noteId: note.id,
        plan,
        roleBriefs: plan.roleBriefs,
        applied
      });
    }
  );

  router.get(
    "/:projectId/ai/planning-notes",
    requireRoles([
      ...PLANNER_ROLES,
      ROLE_KEYS.developer,
      ROLE_KEYS.client,
      ROLE_KEYS.finance,
      ROLE_KEYS.analyst
    ]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { projectId } = req.params;
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null },
        select: { id: true }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const notes = await prisma.projectPlanningNote.findMany({
        where: { orgId, projectId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          source: true,
          authorRole: true,
          aiSummary: true,
          roleBriefs: true,
          fileName: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true } }
        }
      });
      res.json(notes);
    }
  );
}
