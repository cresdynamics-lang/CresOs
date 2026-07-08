import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import multer from "multer";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { runFinanceAssistant } from "../lib/finance-assistant-intent";
import { executeFinanceProposedActions } from "../lib/finance-assistant-execute";
import { enrichFinanceActionPreviews } from "../lib/finance-assistant-preview";
import { logAssistantSession, listAssistantSessions } from "../lib/assistant-session";
import type { FinanceAssistantMode, FinanceProposedAction } from "../lib/finance-assistant-types";
import { transcribeProjectPlanningAudio } from "../lib/groq-project-planner";

const FINANCE_ASSISTANT_ROLES = [ROLE_KEYS.finance, ROLE_KEYS.admin];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

function parseMode(raw: unknown): FinanceAssistantMode {
  return raw === "intelligence" ? "intelligence" : "execute";
}

export default function financeAssistantRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/sessions", requireRoles(FINANCE_ASSISTANT_ROLES), async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const sessions = await listAssistantSessions(prisma, req.auth!.orgId, {
      assistantKind: "finance",
      limit
    });
    res.json({ sessions });
  });

  router.post("/chat", requireRoles(FINANCE_ASSISTANT_ROLES), async (req, res) => {
    const body = (req.body || {}) as { message?: string; mode?: string };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mode = parseMode(body.mode);
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    try {
      const result = await runFinanceAssistant(prisma, req.auth!.orgId, { message, mode });
      if (result.proposedActions?.length) {
        result.proposedActions = await enrichFinanceActionPreviews(
          prisma,
          req.auth!.orgId,
          result.proposedActions
        );
      }
      const sessionId = await logAssistantSession(prisma, {
        orgId: req.auth!.orgId,
        userId: req.auth!.userId,
        assistantKind: "finance",
        mode,
        message,
        reply: result.reply,
        proposedActions: result.proposedActions,
        aiGenerated: result.aiGenerated,
        transcript: result.transcript ?? null
      });
      res.json({ ...result, sessionId });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Assistant failed" });
    }
  });

  router.post("/parse", requireRoles(FINANCE_ASSISTANT_ROLES), async (req, res) => {
    const body = (req.body || {}) as { message?: string; text?: string };
    const message = (typeof body.message === "string" ? body.message : body.text)?.trim() ?? "";
    if (!message) {
      res.status(400).json({ error: "message or text is required" });
      return;
    }
    try {
      const result = await runFinanceAssistant(prisma, req.auth!.orgId, {
        message,
        mode: "execute"
      });
      if (result.proposedActions?.length) {
        result.proposedActions = await enrichFinanceActionPreviews(
          prisma,
          req.auth!.orgId,
          result.proposedActions
        );
      }
      const sessionId = await logAssistantSession(prisma, {
        orgId: req.auth!.orgId,
        userId: req.auth!.userId,
        assistantKind: "finance",
        mode: "execute",
        message,
        reply: result.reply,
        proposedActions: result.proposedActions,
        aiGenerated: result.aiGenerated
      });
      res.json({ ...result, sessionId });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Parse failed" });
    }
  });

  router.post("/execute", requireRoles(FINANCE_ASSISTANT_ROLES), async (req, res) => {
    const body = (req.body || {}) as {
      actions?: FinanceProposedAction[];
      overrides?: Record<string, { beneficiaryId?: string; projectId?: string; invoiceId?: string }>;
    };
    const actions = Array.isArray(body.actions) ? body.actions : [];
    if (actions.length === 0) {
      res.status(400).json({ error: "actions array is required" });
      return;
    }
    if (actions.length > 10) {
      res.status(400).json({ error: "Maximum 10 actions per request" });
      return;
    }
    try {
      const result = await executeFinanceProposedActions(
        prisma,
        req.auth!.orgId,
        req.auth!.userId,
        actions,
        body.overrides
      );
      const sessionId = await logAssistantSession(prisma, {
        orgId: req.auth!.orgId,
        userId: req.auth!.userId,
        assistantKind: "finance",
        mode: "execute",
        message: actions.map((a) => a.title).join("; "),
        reply: `${result.succeeded} recorded`,
        proposedActions: actions,
        executedResults: result.results,
        aiGenerated: false
      });
      res.json({ ...result, sessionId });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Execute failed" });
    }
  });

  router.post(
    "/from-voice",
    requireRoles(FINANCE_ASSISTANT_ROLES),
    upload.single("audio"),
    async (req, res) => {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }
      const mode = parseMode(req.body?.mode);
      const transcript =
        (await transcribeProjectPlanningAudio(file.buffer, file.mimetype, file.originalname)) ?? "";
      if (!transcript.trim()) {
        res.status(422).json({ error: "Could not transcribe audio. Try again or type your request." });
        return;
      }
      try {
        const result = await runFinanceAssistant(prisma, req.auth!.orgId, {
          message: transcript,
          mode,
          transcript
        });
        if (result.proposedActions?.length) {
          result.proposedActions = await enrichFinanceActionPreviews(
            prisma,
            req.auth!.orgId,
            result.proposedActions
          );
        }
        const sessionId = await logAssistantSession(prisma, {
          orgId: req.auth!.orgId,
          userId: req.auth!.userId,
          assistantKind: "finance",
          mode,
          message: transcript,
          transcript,
          reply: result.reply,
          proposedActions: result.proposedActions,
          aiGenerated: result.aiGenerated
        });
        res.json({ ...result, sessionId });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message || "Voice assistant failed" });
      }
    }
  );

  return router;
}
