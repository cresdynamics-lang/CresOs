import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles } from "./auth-middleware";
import { listAssistantSessions } from "../lib/assistant-session";
import { onboardingAccessRoles } from "../lib/onboarding-role-scope";

/** Microservice: onboarding chat history for the current user. */
export default function onboardingSessionsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const roles = onboardingAccessRoles();

  router.get("/", requireRoles(roles), async (req, res) => {
    const limit = Number(req.query.limit) || 15;
    const sessions = await listAssistantSessions(prisma, req.auth!.orgId, {
      userId: req.auth!.userId,
      assistantKind: "onboarding",
      limit
    });
    res.json({ sessions });
  });

  return router;
}
