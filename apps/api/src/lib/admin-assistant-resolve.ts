import type { PrismaClient } from "@prisma/client";
import { findOrgUsersForKnowledgeSearch } from "./knowledge-team-index";

export type ResolveCandidate = { id: string; label: string };

export type ResolveResult =
  | { ok: true; id: string; label: string }
  | { ok: false; error: string; candidates?: ResolveCandidate[] };

function userLabel(name: string | null, email: string): string {
  return name?.trim() || email;
}

/** Resolve a person hint (name, email, role keyword) to an org user id. */
export async function resolveUserHint(
  prisma: PrismaClient,
  orgId: string,
  hint: string | null | undefined
): Promise<ResolveResult> {
  const trimmed = hint?.trim();
  if (!trimmed) {
    return { ok: false, error: "No person specified" };
  }

  const matches = await findOrgUsersForKnowledgeSearch(prisma, orgId, trimmed);
  if (matches.length === 0) {
    return { ok: false, error: `No user matched "${trimmed}"` };
  }
  if (matches.length > 1) {
    const exact = matches.find(
      (u) =>
        u.name?.toLowerCase() === trimmed.toLowerCase() ||
        u.email.toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) {
      return { ok: true, id: exact.id, label: userLabel(exact.name, exact.email) };
    }
    return {
      ok: false,
      error: `Ambiguous person "${trimmed}" — pick one`,
      candidates: matches.slice(0, 8).map((u) => ({
        id: u.id,
        label: userLabel(u.name, u.email)
      }))
    };
  }

  const u = matches[0]!;
  return { ok: true, id: u.id, label: userLabel(u.name, u.email) };
}

/** Resolve a project hint to an approved project id. */
export async function resolveProjectHint(
  prisma: PrismaClient,
  orgId: string,
  hint: string | null | undefined
): Promise<ResolveResult> {
  const trimmed = hint?.trim();
  if (!trimmed) {
    return { ok: false, error: "No project specified" };
  }

  const projects = await prisma.project.findMany({
    where: {
      orgId,
      deletedAt: null,
      approvalStatus: "approved",
      name: { contains: trimmed, mode: "insensitive" }
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 10
  });

  if (projects.length === 0) {
    return { ok: false, error: `No project matched "${trimmed}"` };
  }

  const exact = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return { ok: true, id: exact.id, label: exact.name };
  }
  if (projects.length === 1) {
    return { ok: true, id: projects[0]!.id, label: projects[0]!.name };
  }

  return {
    ok: false,
    error: `Ambiguous project "${trimmed}" — pick one`,
    candidates: projects.map((p) => ({ id: p.id, label: p.name }))
  };
}

export function parseActionDate(raw: string | null | undefined, fallback: Date): Date {
  if (raw?.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}
