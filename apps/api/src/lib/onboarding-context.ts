import type { PrismaClient } from "@prisma/client";
import { fetchKnowledgeChunks } from "./knowledge-context";
import { getOnboardingPlaybook } from "./onboarding-playbooks";
import {
  allowedSourceTypesForAudience,
  audienceLabel,
  type OnboardingAudience
} from "./onboarding-role-scope";

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Role-scoped knowledge + playbook block for onboarding chat.
 * Admin: full pool. Other roles: allowlisted sourceTypes only.
 */
export async function buildOnboardingContextBlock(
  prisma: PrismaClient,
  orgId: string,
  audience: OnboardingAudience,
  question?: string
): Promise<{ contextBlock: string; chunkCount: number; poolEmpty: boolean }> {
  const playbook = getOnboardingPlaybook(audience);
  const allow = allowedSourceTypesForAudience(audience);
  const q = question?.trim();

  const chunks = await fetchKnowledgeChunks(prisma, orgId, {
    q: q || undefined,
    sinceDays: q ? 90 : 45,
    limit: audience === "admin" ? 50 : 35
  });

  const filtered =
    allow == null
      ? chunks
      : chunks.filter((c) => allow.includes(c.sourceType) || allow.includes(c.kind));

  const playbookBlock = [
    `ROLE: ${audienceLabel(audience)}`,
    `PLAYBOOK: ${playbook.title}`,
    `SUMMARY: ${playbook.summary}`,
    "EXPECTATIONS:",
    ...playbook.expectations.map((e, i) => `  ${i + 1}. ${e}`),
    "WHEN THIS HAPPENS → GO TO:",
    ...playbook.contactRules.map((r) => `  • When: ${r.when} → ${r.goTo}`),
    "DAILY RHYTHM:",
    ...playbook.dailyRhythm.map((d) => `  • ${d}`)
  ].join("\n");

  const knowledgeLines =
    filtered.length === 0
      ? ["(No role-scoped knowledge chunks matched — answer from playbook + general CresOS process.)"]
      : filtered.map(
          (c, i) =>
            `[${i + 1}] ${c.sourceType}/${c.kind} · ${c.occurredAt.toISOString().slice(0, 10)}\n` +
            `${c.title ? `Title: ${c.title}\n` : ""}${truncate(c.content, 700)}`
        );

  const contextBlock = [
    "=== CRES DYNAMICS ROLE PLAYBOOK (authoritative for expectations) ===",
    playbookBlock,
    "",
    "=== ROLE-SCOPED KNOWLEDGE POOL (live CresOS actions & communication) ===",
    `Chunks: ${filtered.length}${allow ? ` (filtered for ${audience})` : " (admin — unfiltered)"}`,
    ...knowledgeLines
  ].join("\n");

  return {
    contextBlock,
    chunkCount: filtered.length,
    poolEmpty: filtered.length === 0
  };
}

/** Live roster contacts matching playbook roleHints (best-effort). */
export async function resolveOnboardingLiveContacts(
  prisma: PrismaClient,
  orgId: string,
  audience: OnboardingAudience
): Promise<{ when: string; goTo: string; people: { id: string; name: string; email: string }[] }[]> {
  const playbook = getOnboardingPlaybook(audience);
  const roleKeys = [...new Set(playbook.contactRules.map((r) => r.roleHint))];

  const users = await prisma.user.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: "active",
      OR: [
        { roles: { some: { role: { key: { in: roleKeys } } } } },
        { memberships: { some: { role: { key: { in: roleKeys } } } } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      roles: { select: { role: { select: { key: true } } } },
      memberships: { select: { role: { select: { key: true } } } }
    },
    take: 80
  });

  const byRole = new Map<string, { id: string; name: string; email: string }[]>();
  for (const u of users) {
    const keys = new Set([
      ...u.roles.map((r) => r.role.key),
      ...u.memberships.map((m) => m.role?.key).filter(Boolean)
    ] as string[]);
    for (const k of keys) {
      if (!roleKeys.includes(k)) continue;
      const list = byRole.get(k) ?? [];
      list.push({ id: u.id, name: u.name?.trim() || u.email, email: u.email });
      byRole.set(k, list);
    }
  }

  return playbook.contactRules.map((rule) => ({
    when: rule.when,
    goTo: rule.goTo,
    people: (byRole.get(rule.roleHint) ?? []).slice(0, 5)
  }));
}
