import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles } from "./auth-middleware";
import { getOnboardingPlaybook } from "../lib/onboarding-playbooks";
import {
  onboardingAccessRoles,
  resolveOnboardingAudience
} from "../lib/onboarding-role-scope";

/** Microservice: role playbook + expectations bootstrap. */
export default function onboardingPlaybookRouter(prisma: PrismaClient): Router {
  const router = Router();
  const roles = onboardingAccessRoles();

  router.get("/", requireRoles(roles), async (req, res) => {
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const playbook = getOnboardingPlaybook(audience);
    res.json({
      audience,
      playbook,
      userId: req.auth!.userId,
      orgId: req.auth!.orgId
    });
  });

  router.get("/expectations", requireRoles(roles), async (req, res) => {
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const playbook = getOnboardingPlaybook(audience);
    res.json({
      audience,
      title: playbook.title,
      summary: playbook.summary,
      expectations: playbook.expectations,
      dailyRhythm: playbook.dailyRhythm
    });
  });

  router.get("/suggested-questions", requireRoles(roles), async (req, res) => {
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const playbook = getOnboardingPlaybook(audience);
    res.json({ audience, questions: playbook.suggestedQuestions });
  });

  return router;
}
