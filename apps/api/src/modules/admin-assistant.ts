import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import multer from "multer";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { runAdminAssistant } from "../lib/admin-assistant-intent";
import { executeProposedActions } from "../lib/admin-assistant-execute";
import { parseIntelligenceFocus } from "../lib/admin-assistant-focus";
import { logAssistantSession, listAssistantSessions } from "../lib/assistant-session";
import type { AdminAssistantMode, ProposedAction } from "../lib/admin-assistant-types";
import { transcribeProjectPlanningAudio } from "../lib/groq-project-planner";

const EXECUTE_ROLES = [ROLE_KEYS.admin];
const INTELLIGENCE_ROLES = [ROLE_KEYS.admin, ROLE_KEYS.director];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

function parseMode(raw: unknown): AdminAssistantMode {
  return raw === "execute" ? "execute" : "intelligence";
}

async function attachSession(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  mode: string,
  message: string,
  result: Awaited<ReturnType<typeof runAdminAssistant>>,
  extra?: { transcript?: string; executedResults?: unknown }
) {
  const sessionId = await logAssistantSession(prisma, {
    orgId,
    userId,
    assistantKind: "admin",
    mode,
    focus: result.focus ?? null,
    message,
    transcript: extra?.transcript ?? result.transcript ?? null,
    reply: result.reply,
    proposedActions: result.proposedActions,
    executedResults: extra?.executedResults,
    aiGenerated: result.aiGenerated
  });
  result.sessionId = sessionId;
  return result;
}

export default function adminAssistantRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/sessions", requireRoles(INTELLIGENCE_ROLES), async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const sessions = await listAssistantSessions(prisma, req.auth!.orgId, {
      assistantKind: "admin",
      limit
    });
    res.json({ sessions });
  });

  router.post("/chat", requireRoles(INTELLIGENCE_ROLES), async (req, res) => {
    const body = (req.body || {}) as { message?: string; mode?: string; focus?: string };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mode = parseMode(body.mode);
    const focus = parseIntelligenceFocus(body.focus);

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (mode === "execute" && !req.auth!.roleKeys.includes(ROLE_KEYS.admin)) {
      res.status(403).json({ error: "Execute mode requires admin role" });
      return;
    }

    try {
      const result = await runAdminAssistant(prisma, req.auth!.orgId, {
        message,
        mode,
        focus
      });
      await attachSession(prisma, req.auth!.orgId, req.auth!.userId, mode, message, result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Assistant failed" });
    }
  });

  router.post("/ask", requireRoles(INTELLIGENCE_ROLES), async (req, res) => {
    const body = (req.body || {}) as { q?: string; message?: string; focus?: string };
    const message = (typeof body.q === "string" ? body.q : body.message)?.trim() ?? "";
    const focus = parseIntelligenceFocus(body.focus);
    if (!message) {
      res.status(400).json({ error: "q or message is required" });
      return;
    }
    try {
      const result = await runAdminAssistant(prisma, req.auth!.orgId, {
        message,
        mode: "intelligence",
        focus
      });
      await attachSession(prisma, req.auth!.orgId, req.auth!.userId, "intelligence", message, result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Assistant failed" });
    }
  });

  router.post("/parse", requireRoles(EXECUTE_ROLES), async (req, res) => {
    const body = (req.body || {}) as { message?: string; text?: string };
    const message = (typeof body.message === "string" ? body.message : body.text)?.trim() ?? "";
    if (!message) {
      res.status(400).json({ error: "message or text is required" });
      return;
    }
    try {
      const result = await runAdminAssistant(prisma, req.auth!.orgId, {
        message,
        mode: "execute"
      });
      await attachSession(prisma, req.auth!.orgId, req.auth!.userId, "execute", message, result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Parse failed" });
    }
  });

  router.post("/execute", requireRoles(EXECUTE_ROLES), async (req, res) => {
    const body = (req.body || {}) as {
      actions?: ProposedAction[];
      overrides?: Record<string, { assigneeId?: string; projectId?: string }>;
      sourceMessage?: string;
    };
    const actions = Array.isArray(body.actions) ? body.actions : [];
    if (actions.length === 0) {
      res.status(400).json({ error: "actions array is required" });
      return;
    }
    if (actions.length > 20) {
      res.status(400).json({ error: "Maximum 20 actions per request" });
      return;
    }

    try {
      const result = await executeProposedActions(
        prisma,
        req.auth!.orgId,
        req.auth!.userId,
        actions,
        body.overrides
      );

      const sessionId = await logAssistantSession(prisma, {
        orgId: req.auth!.orgId,
        userId: req.auth!.userId,
        assistantKind: "admin",
        mode: "execute",
        message: body.sourceMessage?.trim() || actions.map((a) => a.title).join("; "),
        reply: `${result.succeeded} succeeded, ${result.failed} failed`,
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
    requireRoles(INTELLIGENCE_ROLES),
    upload.single("audio"),
    async (req, res) => {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }

      const mode = parseMode(req.body?.mode);
      if (mode === "execute" && !req.auth!.roleKeys.includes(ROLE_KEYS.admin)) {
        res.status(403).json({ error: "Execute mode requires admin role" });
        return;
      }

      const transcript =
        (await transcribeProjectPlanningAudio(file.buffer, file.mimetype, file.originalname)) ?? "";

      if (!transcript.trim()) {
        res.status(422).json({ error: "Could not transcribe audio. Try again or type your request." });
        return;
      }

      const focus = parseIntelligenceFocus(req.body?.focus);

      try {
        const result = await runAdminAssistant(prisma, req.auth!.orgId, {
          message: transcript,
          mode,
          transcript,
          focus
        });
        await attachSession(prisma, req.auth!.orgId, req.auth!.userId, mode, transcript, result, {
          transcript
        });
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message || "Voice assistant failed" });
      }
    }
  );

  return router;
}
