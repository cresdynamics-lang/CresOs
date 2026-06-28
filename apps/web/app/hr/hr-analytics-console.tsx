"use client";

import { useAuth } from "../auth-context";
import { WorkforceAnalyticsPanel } from "../../components/analytics/workforce-analytics-panel";
import { canAccessHrWorkspace } from "../../lib/is-hr-only";
import { buildWelcomeHeadline } from "../../lib/personalized-greeting";
import { HrFullscreenPage, HrPageHero } from "../../components/hr/hr-shell";
import { useMemo } from "react";

export function HrAnalyticsConsole() {
  const { auth } = useAuth();
  const canAccess = canAccessHrWorkspace(auth.roleKeys);

  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  if (!canAccess) {
    return (
      <div className="px-5 py-8 lg:px-8">
        <p className="text-slate-400">You don&apos;t have access to HR analytics.</p>
      </div>
    );
  }

  return (
    <HrFullscreenPage>
      <HrPageHero
        eyebrow="Human Resources"
        title={welcomeHeadline}
        description="Live workforce analytics from your employee roster — org readiness, team composition, departments, and payroll movement."
        backHref="/hr"
      />

      <WorkforceAnalyticsPanel variant="full" showHeader includeSchedule accent="hr" />
    </HrFullscreenPage>
  );
}
