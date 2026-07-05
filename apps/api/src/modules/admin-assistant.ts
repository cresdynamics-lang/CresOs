import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import multer from "multer";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { runAdminAssistant } from "../lib/admin-assistant-intent";
import type { AdminAssistantMode } from "../lib/admin-assistant-types";
import { transcribeProjectPlanningAudio } from "../lib/groq-project-planner";

const ADMIN_ASSISTANT_ROLES = [ROLE_KEYS.admin];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

function parseMode(raw: unknown): AdminAssistantMode {
  return raw === "execute" ? "execute" : "intelligence";
}

export default function adminAssistantRouter(prisma: PrismaClient): Router {
  const router = Router();

  /** POST /admin/assistant/chat — text → preview actions or intelligence answer */
  router.post("/chat", requireRoles(ADMIN_ASSISTANT_ROLES), async (req, res) => {
    const body = (req.body || {}) as { message?: string; mode?: string };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mode = parseMode(body.mode);

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    try {
      const result = await runAdminAssistant(prisma, req.auth!.orgId, { message, mode });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Assistant failed" });
    }
  });

  /** POST /admin/assistant/ask — alias for intelligence mode */
  router.post("/ask", requireRoles(ADMIN_ASSISTANT_ROLES), async (req, res) => {
    const body = (req.body || {}) as { q?: string; message?: string };
    const message = (typeof body.q === "string" ? body.q : body.message)?.trim() ?? "";
    if (!message) {
      res.status(400).json({ error: "q or message is required" });
      return;
    }
    try {
      const result = await runAdminAssistant(prisma, req.auth!.orgId, {
        message,
        mode: "intelligence"
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Assistant failed" });
    }
  });

  /** POST /admin/assistant/parse — alias for execute mode preview */
  router.post("/parse", requireRoles(ADMIN_ASSISTANT_ROLES), async (req, res) => {
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
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Parse failed" });
    }
  });

  /** POST /admin/assistant/from-voice — audio → transcript → chat */
  router.post(
    "/from-voice",
    requireRoles(ADMIN_ASSISTANT_ROLES),
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
        const result = await runAdminAssistant(prisma, req.auth!.orgId, {
          message: transcript,
          mode,
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
