import type { AuthContext } from "./auth-middleware";

export const NOTIFICATION_TIERS = {
  execution: "execution",
  financial: "financial",
  governance: "governance",
  structural: "structural"
} as const;

const ROLE_TIER_ACCESS: Record<string, string[]> = {
  director_admin: [NOTIFICATION_TIERS.governance],
  finance: [NOTIFICATION_TIERS.financial],
  ops: [NOTIFICATION_TIERS.execution],
  sales: [NOTIFICATION_TIERS.execution],
  analyst: [],
  admin: [NOTIFICATION_TIERS.structural],
  client: []
};

export function tiersForAuth(auth: AuthContext | undefined): string[] {
  if (!auth) return [];
  const tiers = new Set<string>();
  auth.roleKeys.forEach((role) => {
    (ROLE_TIER_ACCESS[role] ?? []).forEach((t) => tiers.add(t));
  });
  return Array.from(tiers);
}

