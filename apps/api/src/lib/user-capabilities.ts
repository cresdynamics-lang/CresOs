import type { Prisma } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";

export type UserCapabilityFlags = {
  canSeeFinance?: boolean;
  canSubmitReports?: boolean;
  canReviewTeamReports?: boolean;
};

export const DEFAULT_CAPABILITY_FLAGS: UserCapabilityFlags = {
  canSeeFinance: false,
  canSubmitReports: true,
  canReviewTeamReports: true
};

export function parseCapabilityFlags(raw: Prisma.JsonValue | null | undefined): UserCapabilityFlags {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CAPABILITY_FLAGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    canSeeFinance: o.canSeeFinance === true,
    canSubmitReports: o.canSubmitReports !== false,
    canReviewTeamReports: o.canReviewTeamReports !== false
  };
}

export function mergeCapabilityFlags(
  current: Prisma.JsonValue | null | undefined,
  patch: Partial<UserCapabilityFlags>
): UserCapabilityFlags {
  const base = parseCapabilityFlags(current);
  return { ...base, ...patch };
}

export function userHasFinanceAccess(roleKeys: string[], capabilityFlags: Prisma.JsonValue | null | undefined): boolean {
  if (roleKeys.includes(ROLE_KEYS.admin) || roleKeys.includes(ROLE_KEYS.finance)) {
    return true;
  }
  if (roleKeys.includes(ROLE_KEYS.director)) {
    return parseCapabilityFlags(capabilityFlags).canSeeFinance === true;
  }
  return roleKeys.includes(ROLE_KEYS.analyst);
}

export function isAdminRole(roleKeys: string[]): boolean {
  return roleKeys.includes(ROLE_KEYS.admin);
}

export function isDirectorOnly(roleKeys: string[]): boolean {
  return roleKeys.includes(ROLE_KEYS.director) && !roleKeys.includes(ROLE_KEYS.admin);
}

/** Team member user IDs assigned to this director (ICs only). */
export function primaryRoleLabel(
  roles: { role: { name: string; key: string; department?: { name: string } | null } }[]
): { role: string; department: string; roleKeys: string[] } {
  const roleKeys = roles.map((r) => r.role.key);
  const primary = roles.find((r) => r.role.key === ROLE_KEYS.director)
    ?? roles.find((r) => r.role.key === ROLE_KEYS.sales)
    ?? roles.find((r) => r.role.key === ROLE_KEYS.developer)
    ?? roles[0];
  return {
    role: primary?.role.name ?? "",
    department: primary?.role.department?.name ?? "",
    roleKeys
  };
}

export async function getDirectorTeamMemberIds(
  prisma: { user: { findMany: (args: object) => Promise<{ id: string }[]> } },
  orgId: string,
  directorId: string
): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { orgId, deletedAt: null, reportsToDirectorId: directorId },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}
