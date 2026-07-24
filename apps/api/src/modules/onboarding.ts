import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles } from "./auth-middleware";
import onboardingPlaybookRouter from "./onboarding-playbook";
import onboardingContactsRouter from "./onboarding-contacts";
import onboardingChatRouter from "./onboarding-chat";
import onboardingSessionsRouter from "./onboarding-sessions";
import { getOnboardingPlaybook } from "../lib/onboarding-playbooks";
import { resolveOnboardingLiveContacts } from "../lib/onboarding-context";
import {
  onboardingAccessRoles,
  resolveOnboardingAudience
} from "../lib/onboarding-role-scope";

/**
 * Onboarding facade — mounts independent micro-routers:
 *   /onboarding/playbook/*
 *   /onboarding/contacts/*
 *   /onboarding/chat | /ask
 *   /onboarding/sessions
 *   /onboarding/bootstrap  (aggregated for first paint)
 */
export default function onboardingRouter(prisma: PrismaClient): Router {
  const router = Router();
  const roles = onboardingAccessRoles();

  router.use("/playbook", onboardingPlaybookRouter(prisma));
  router.use("/contacts", onboardingContactsRouter(prisma));
  router.use("/", onboardingChatRouter(prisma));
  router.use("/sessions", onboardingSessionsRouter(prisma));

  /** One-shot bootstrap so the UI is not coupled to a single mega-payload forever. */
  router.get("/bootstrap", requireRoles(roles), async (req, res) => {
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const playbook = getOnboardingPlaybook(audience);
    const live = await resolveOnboardingLiveContacts(prisma, req.auth!.orgId, audience);
    res.json({
      audience,
      playbook: {
        title: playbook.title,
        summary: playbook.summary,
        expectations: playbook.expectations,
        contactRules: playbook.contactRules,
        suggestedQuestions: playbook.suggestedQuestions,
        dailyRhythm: playbook.dailyRhythm
      },
      liveContacts: live
    });
  });

  return router;
}
