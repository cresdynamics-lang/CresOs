import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles } from "./auth-middleware";
import { resolveOnboardingLiveContacts } from "../lib/onboarding-context";
import { getOnboardingPlaybook } from "../lib/onboarding-playbooks";
import {
  onboardingAccessRoles,
  resolveOnboardingAudience
} from "../lib/onboarding-role-scope";

/** Microservice: when X happens → go to Y (+ live roster match). */
export default function onboardingContactsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const roles = onboardingAccessRoles();

  router.get("/", requireRoles(roles), async (req, res) => {
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const playbook = getOnboardingPlaybook(audience);
    const live = await resolveOnboardingLiveContacts(prisma, req.auth!.orgId, audience);
    res.json({
      audience,
      rules: playbook.contactRules,
      live
    });
  });

  router.get("/map", requireRoles(roles), async (req, res) => {
    const audience = resolveOnboardingAudience(req.auth!.roleKeys);
    const playbook = getOnboardingPlaybook(audience);
    res.json({
      audience,
      map: playbook.contactRules.map((r) => ({
        when: r.when,
        goTo: r.goTo,
        roleHint: r.roleHint
      }))
    });
  });

  return router;
}
