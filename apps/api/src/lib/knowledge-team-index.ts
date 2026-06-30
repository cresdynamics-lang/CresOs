import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";
import { getUserIdsInOrg } from "../modules/chat-community-helpers";
import { ingestKnowledgeChunk } from "./knowledge-ingest";

const ROLE_QUERY_ALIASES: Record<string, string> = {
  developer: ROLE_KEYS.developer,
  developers: ROLE_KEYS.developer,
  dev: ROLE_KEYS.developer,
  devs: ROLE_KEYS.developer,
  engineer: ROLE_KEYS.developer,
  engineers: ROLE_KEYS.developer,
  sales: ROLE_KEYS.sales,
  salesperson: ROLE_KEYS.sales,
  director: ROLE_KEYS.director,
  admin: ROLE_KEYS.admin,
  pm: ROLE_KEYS.project_manager,
  "project manager": ROLE_KEYS.project_manager,
  "project managers": ROLE_KEYS.project_manager
};

export type KnowledgeTeamUser = {
  id: string;
  name: string | null;
  email: string;
  jobTitle: string | null;
  roleKeys: string[];
  roleNames: string[];
};

export function parseRoleFromQuery(q: string): string | undefined {
  return ROLE_QUERY_ALIASES[q.trim().toLowerCase()];
}

function formatUserLabel(name: string | null, email: string): string {
  return name?.trim() || email;
}

/** Find org users by name, email, job title, or role keyword (e.g. "developers"). */
export async function findOrgUsersForKnowledgeSearch(
  prisma: PrismaClient,
  orgId: string,
  q: string
): Promise<KnowledgeTeamUser[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const userIds = await getUserIdsInOrg(prisma, orgId);
  if (userIds.length === 0) return [];

  const roleKey = parseRoleFromQuery(trimmed);

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      deletedAt: null,
      ...(roleKey
        ? { roles: { some: { role: { key: roleKey } } } }
        : {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
              { jobTitle: { contains: trimmed, mode: "insensitive" } },
              {
                roles: {
                  some: {
                    role: {
                      OR: [
                        { key: { contains: trimmed, mode: "insensitive" } },
                        { name: { contains: trimmed, mode: "insensitive" } }
                      ]
                    }
                  }
                }
              }
            ]
          })
    },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      roles: { select: { role: { select: { key: true, name: true } } } }
    },
    take: 60,
    orderBy: [{ name: "asc" }, { email: "asc" }]
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    jobTitle: u.jobTitle,
    roleKeys: u.roles.map((r) => r.role.key),
    roleNames: u.roles.map((r) => r.role.name)
  }));
}

/** Index every org member as a searchable team profile in the knowledge pool. */
export async function syncOrgTeamKnowledge(prisma: PrismaClient, orgId: string): Promise<number> {
  const userIds = await getUserIdsInOrg(prisma, orgId);
  if (userIds.length === 0) return 0;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      status: true,
      currentFocusNote: true,
      currentFocusUpdatedAt: true,
      currentFocusProject: { select: { name: true } },
      roles: { select: { role: { select: { key: true, name: true } } } },
      projectDevAssignments: {
        where: { status: "accepted" },
        select: { project: { select: { name: true } } }
      },
      projectsAssignedAsDev: { where: { deletedAt: null }, select: { name: true } },
      tasksAssigned: {
        where: { deletedAt: null, status: { not: "done" } },
        select: { title: true, project: { select: { name: true } } },
        take: 8
      }
    }
  });

  let count = 0;
  const now = new Date();

  for (const u of users) {
    const label = formatUserLabel(u.name, u.email);
    const roleKeys = u.roles.map((r) => r.role.key);
    const roleNames = u.roles.map((r) => r.role.name);
    const projectNames = [
      ...new Set([
        ...u.projectDevAssignments.map((a) => a.project.name),
        ...u.projectsAssignedAsDev.map((p) => p.name)
      ])
    ];
    const openTasks = u.tasksAssigned.map((t) => `${t.title} (${t.project?.name ?? "project"})`);

    const content = [
      `${label} — team member profile`,
      `Email: ${u.email}`,
      u.jobTitle ? `Job title: ${u.jobTitle}` : null,
      `Roles: ${roleNames.join(", ") || "none"} (${roleKeys.join(", ")})`,
      `Status: ${u.status}`,
      u.currentFocusProject ? `Current focus project: ${u.currentFocusProject.name}` : null,
      u.currentFocusNote ? `Current focus note: ${u.currentFocusNote}` : null,
      projectNames.length ? `Assigned projects: ${projectNames.join(", ")}` : null,
      openTasks.length ? `Open tasks: ${openTasks.join("; ")}` : null
    ]
      .filter(Boolean)
      .join("\n");

    await ingestKnowledgeChunk(prisma, {
      orgId,
      sourceType: "team_member",
      sourceId: u.id,
      kind: "profile",
      title: `${label} (${roleNames.join(", ") || "team"})`,
      content,
      metadata: { roleKeys, roleNames, email: u.email },
      occurredAt: u.currentFocusUpdatedAt ?? now,
      userId: u.id,
      actorId: u.id
    });
    count += 1;
  }

  return count;
}

export function formatTeamUsersBlock(users: KnowledgeTeamUser[]): string {
  if (users.length === 0) return "";
  return users
    .map((u) => {
      const label = formatUserLabel(u.name, u.email);
      return `- ${label} (${u.email}) — roles: ${u.roleNames.join(", ") || u.roleKeys.join(", ")}${u.jobTitle ? `, ${u.jobTitle}` : ""}`;
    })
    .join("\n");
}
