"use client";

import type { ReactNode } from "react";
import { useAuth } from "./auth-context";
import { resolveRoleTheme } from "../components/dashboard-welcome-banner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst",
  client: "Client"
};

export function useWorkspaceProfile() {
  const { auth } = useAuth();
  const displayName =
    auth.userName?.trim() ||
    auth.userEmail?.split("@")[0] ||
    "User";
  const roleLine = auth.roleKeys
    .map((k) => ROLE_LABELS[k] ?? k)
    .filter(Boolean)
    .join(", ");
  const orgLabel = auth.orgName?.trim() || "Workspace";
  return { displayName, roleLine, orgLabel };
}

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** When false, hides the “Signed in as …” line (e.g. when a welcome banner already greets the user). */
  showWorkspaceProfile?: boolean;
  /** Small caps label above the title */
  eyebrow?: string;
  /** Highlighted phrase before the description body */
  brandLead?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  showWorkspaceProfile = true,
  eyebrow,
  brandLead
}: PageHeaderProps) {
  const { auth } = useAuth();
  const { displayName, roleLine, orgLabel } = useWorkspaceProfile();
  const theme = resolveRoleTheme(auth.roleKeys);
  const label = eyebrow ?? "Workspace";

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-5 sm:mb-6 sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-label text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">
          {label}
        </p>
        <h1
          className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r ${theme.nameGradient} bg-clip-text text-transparent`}
        >
          {title}
        </h1>
        {showWorkspaceProfile && (
          <p className="mt-2 font-body text-xs text-slate-400 sm:text-sm">
            Signed in as{" "}
            <span className="font-medium text-slate-200">{displayName}</span>
            {roleLine ? <span className="text-slate-500"> ({roleLine})</span> : null}
            {" · "}
            <span className="text-slate-300">{orgLabel}</span>
          </p>
        )}
        {description && (
          <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-slate-400 sm:text-[15px]">
            {brandLead ? (
              <>
                <span className={`font-semibold ${theme.roleText}`}>{brandLead}</span>
                <span className="text-slate-500"> — </span>
              </>
            ) : null}
            {description.replace(/^Operating System for Growth\s*[—–-]\s*/i, "")}
          </p>
        )}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
