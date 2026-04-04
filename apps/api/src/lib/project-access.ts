import type { PrismaClient } from "@prisma/client";

export type ProjectDevAccess = "none" | "invited" | "active";

export async function getProjectDeveloperAccess(
  prisma: PrismaClient,
  project: { id: string; assignedDeveloperId: string | null },
  userId: string
): Promise<ProjectDevAccess> {
  const row = await prisma.projectDeveloperAssignment.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } }
  });
  if (row) {
    if (row.status === "accepted") return "active";
    if (row.status === "pending") return "invited";
    return "none";
  }
  if (project.assignedDeveloperId === userId) return "active";
  return "none";
}

/** Developers actively assigned (accepted) including legacy primary field. */
export async function getAcceptedDeveloperIds(prisma: PrismaClient, projectId: string): Promise<string[]> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { assignedDeveloperId: true }
  });
  const rows = await prisma.projectDeveloperAssignment.findMany({
    where: { projectId, status: "accepted" },
    select: { userId: true }
  });
  const ids = new Set(rows.map((r) => r.userId));
  if (project?.assignedDeveloperId) ids.add(project.assignedDeveloperId);
  return [...ids];
}
