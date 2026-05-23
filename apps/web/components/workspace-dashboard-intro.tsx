"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useAuth } from "../app/auth-context";
import { PageHeader } from "../app/page-header";
import { buildWelcomeHeadline, getDisplayFirstName } from "../lib/personalized-greeting";
import {
  DashboardSectionLabel,
  DashboardWelcomeBanner,
  resolveRoleTheme
} from "./dashboard-welcome-banner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst",
  client: "Client"
};

function useDisplayFirstName(): string {
  const { auth } = useAuth();
  return useMemo(
    () => getDisplayFirstName(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );
}

function usePrimaryRoleLabel(roleKeys: string[]): string {
  return roleKeys.map((k) => ROLE_LABELS[k]).filter(Boolean)[0] ?? "User";
}

type WorkspaceDashboardIntroProps = {
  title: string;
  description?: string;
  /** Small caps label above title (e.g. Finance, Sales, Analytics) */
  eyebrow?: string;
  brandLead?: string;
  showWelcomeBanner?: boolean;
  /** Hide the DEVELOPER / SALES etc. pill in the welcome banner. */
  showWelcomeRoleLabel?: boolean;
  welcomeChildren?: ReactNode;
  actions?: ReactNode;
};

/**
 * Styled welcome + hero header for workspace dashboards (Finance, Sales, Analytics, etc.).
 */
export function WorkspaceDashboardIntro({
  title,
  description,
  eyebrow,
  brandLead,
  showWelcomeBanner = true,
  showWelcomeRoleLabel = true,
  welcomeChildren,
  actions
}: WorkspaceDashboardIntroProps) {
  const { auth } = useAuth();
  const firstName = useDisplayFirstName();
  const roleLabel = usePrimaryRoleLabel(auth.roleKeys);
  const theme = resolveRoleTheme(auth.roleKeys);
  const welcomeHeadline = useMemo(
    () => buildWelcomeHeadline(auth.userName, auth.userEmail),
    [auth.userName, auth.userEmail]
  );

  return (
    <div className="flex flex-col gap-4">
      {showWelcomeBanner && (
        <DashboardWelcomeBanner
          firstName={firstName}
          roleLabel={roleLabel}
          roleKeys={auth.roleKeys}
          showRoleLabel={showWelcomeRoleLabel}
          headline={welcomeHeadline}
        >
          {welcomeChildren ?? (
            <>
              <DashboardSectionLabel roleKeys={auth.roleKeys}>
                Today&apos;s priorities (your queue)
              </DashboardSectionLabel>
              <p className="font-body text-sm leading-relaxed text-slate-400">
                Use <span className={`font-medium ${theme.roleText}`}>{title}</span> and the sections
                below for live data.
              </p>
            </>
          )}
        </DashboardWelcomeBanner>
      )}
      <PageHeader
        title={title}
        description={description}
        showWorkspaceProfile={false}
        eyebrow={eyebrow ?? roleLabel}
        brandLead={brandLead}
        actions={actions}
      />
    </div>
  );
}
