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
import { isTranscriptionConfigured } from "../lib/groq-voice-report";

const FINANCE_ASSISTANT_ROLES = [ROLE_KEYS.finance, ROLE_KEYS.admin];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

// Uploaded voice notes / recorded confirmations can be larger than a quick mic capture.
const uploadAudioFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
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

  /**
   * Data-entry API 1 — transcription only.
   * Spoken audio → text so the finance user can review the transcript before
   * any expense/payment is parsed or recorded (confirm-before-commit).
   */
  router.post(
    "/transcribe",
    requireRoles(FINANCE_ASSISTANT_ROLES),
    uploadAudioFile.single("audio"),
    async (req, res) => {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }
      if (!isTranscriptionConfigured()) {
        res.status(503).json({ error: "Voice transcription is not configured (GROQ_API_KEY missing)" });
        return;
      }
      const transcript =
        (await transcribeProjectPlanningAudio(file.buffer, file.mimetype, file.originalname)) ?? "";
      if (!transcript.trim()) {
        res.status(422).json({ error: "Could not transcribe audio. Try again or type your request." });
        return;
      }
      res.json({ transcript });
    }
  );

  /**
   * Data-entry API 2 — audio file entry for finance records.
   * Accepts a pre-recorded audio file (voice note describing an expense or
   * client payment), transcribes it, extracts finance actions, and with
   * autoExecute=true records them immediately and returns a confirmation.
   */
  router.post(
    "/from-audio",
    requireRoles(FINANCE_ASSISTANT_ROLES),
    uploadAudioFile.single("audio"),
    async (req, res) => {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }
      if (!isTranscriptionConfigured()) {
        res.status(503).json({ error: "Voice transcription is not configured (GROQ_API_KEY missing)" });
        return;
      }

      const mode = parseMode(req.body?.mode);
      const autoExecute = req.body?.autoExecute === "true" || req.body?.autoExecute === true;

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

        let executedResults:
          | Awaited<ReturnType<typeof executeFinanceProposedActions>>
          | undefined;
        if (autoExecute && mode === "execute" && result.proposedActions?.length) {
          executedResults = await executeFinanceProposedActions(
            prisma,
            req.auth!.orgId,
            req.auth!.userId,
            result.proposedActions
          );
          result.reply =
            `${result.reply}\n\nConfirmation: ${executedResults.succeeded} record(s) saved` +
            (executedResults.failed > 0
              ? `, ${executedResults.failed} need review (pick a match or edit hints).`
              : ".");
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
          executedResults: executedResults?.results,
          aiGenerated: result.aiGenerated
        });
        res.json({ ...result, executed: executedResults ?? null, sessionId });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message || "Audio assistant failed" });
      }
    }
  );

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
      if (!isTranscriptionConfigured()) {
        res.status(503).json({ error: "Voice transcription is not configured (GROQ_API_KEY missing)" });
        return;
      }
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
