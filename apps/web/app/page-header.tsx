"use client";

import type { ReactNode } from "react";
import { useAuth } from "./auth-context";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director_admin: "Director",
  finance: "Finance",
  developer: "Developer",
  sales: "Sales",
  analyst: "Analyst",
  client: "Client"
};

/**
 * Workspace line: user display name, roles, and org (from login or /account/me).
 */
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
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { displayName, roleLine, orgLabel } = useWorkspaceProfile();
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:gap-4 sm:pb-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">{title}</h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          Signed in as{" "}
          <span className="font-medium text-slate-200">{displayName}</span>
          {roleLine ? (
            <span className="text-slate-500"> ({roleLine})</span>
          ) : null}
          {" · "}
          <span className="text-slate-300">{orgLabel}</span>
        </p>
        {description && (
          <p className="mt-3 max-w-full text-sm leading-relaxed break-words text-slate-400 sm:max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
