import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles } from "./auth-middleware";
import { logAssistantSession } from "../lib/assistant-session";
import { createAssistantSseWriter } from "../lib/assistant-sse";
import { runOnboardingChat } from "../lib/onboarding-intent";
import { streamOnboardingChat } from "../lib/onboarding-stream";
import {
  onboardingAccessRoles,
  resolveOnboardingAudience
} from "../lib/onboarding-role-scope";

/** Microservice: onboarding AI chat (role-scoped knowledge pool) + SSE stream. */
export default function onboardingChatRouter(prisma: PrismaClient): Router {
  const router = Router();
  const roles = onboardingAccessRoles();

  async function handleAsk(req: Request, res: Response): Promise<void> {
    const body = (req.body || {}) as { message?: string; q?: string };
    const message = (typeof body.message === "string" ? body.message : body.q)?.trim() ?? "";
    if (!message) {
      res.status(400).json({ error: "message or q is required" });
      return;
    }

    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    try {
      const result = await runOnboardingChat(prisma, req.auth!.orgId, audience, message);
      const sessionId = await logAssistantSession(prisma, {
        orgId: req.auth!.orgId,
        userId: req.auth!.userId,
        assistantKind: "onboarding",
        mode: "intelligence",
        focus: audience,
        message,
        reply: result.reply,
        aiGenerated: result.aiGenerated
      });
      res.json({ ...result, sessionId });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message || "Onboarding chat failed" });
    }
  }

  router.post("/chat", requireRoles(roles), (req, res) => void handleAsk(req, res));
  router.post("/ask", requireRoles(roles), (req, res) => void handleAsk(req, res));

  router.post("/stream", requireRoles(roles), async (req, res) => {
    const body = (req.body || {}) as { message?: string; q?: string };
    const message = (typeof body.message === "string" ? body.message : body.q)?.trim() ?? "";
    if (!message) {
      res.status(400).json({ error: "message or q is required" });
      return;
    }
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const sse = createAssistantSseWriter(res);
    req.on("close", () => {
      try {
        res.end();
      } catch {
        /* closed */
      }
    });
    await streamOnboardingChat(
      prisma,
      req.auth!.orgId,
      req.auth!.userId,
      audience,
      message,
      sse
    );
  });

  return router;
}
