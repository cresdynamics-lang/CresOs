import type { PrismaClient } from "@prisma/client";

/**
 * Ensures a Client exists (from project contact fields), links the project, and upserts a Lead
 * so CRM/leads stay in sync when projects are created or contact details change.
 */
export async function syncLeadAndClientFromProject(
  prisma: PrismaClient,
  orgId: string,
  projectId: string
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null }
  });
  if (!project) return;

  const displayName = (project.clientOrOwnerName?.trim() || project.name).trim() || "Client";
  const email = project.email?.trim() || null;
  const phone = project.phone?.trim() || null;

  let clientId = project.clientId;

  if (!clientId) {
    let matched: { id: string } | null = null;
    if (email) {
      matched = await prisma.client.findFirst({
        where: { orgId, deletedAt: null, email },
        select: { id: true }
      });
    }
    if (!matched && phone) {
      matched = await prisma.client.findFirst({
        where: { orgId, deletedAt: null, phone },
        select: { id: true }
      });
    }
    if (matched) {
      clientId = matched.id;
      await prisma.client.update({
        where: { id: clientId },
        data: {
          name: displayName,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {})
        }
      });
    } else {
      const c = await prisma.client.create({
        data: { orgId, name: displayName, email, phone }
      });
      clientId = c.id;
    }
    await prisma.project.update({ where: { id: projectId }, data: { clientId } });
  } else {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        name: displayName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {})
      }
    });
  }

  const existingLead = await prisma.lead.findFirst({
    where: { orgId, projectId, deletedAt: null }
  });

  const leadTitle = project.name.trim();

  if (existingLead) {
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        title: leadTitle,
        clientId,
        source: existingLead.source || "project"
      }
    });
    return;
  }

  await prisma.lead.create({
    data: {
      orgId,
      title: leadTitle,
      clientId,
      projectId: project.id,
      ownerId: project.createdByUserId,
      source: "project",
      status: "new",
      approvalStatus: "approved",
      approvedAt: new Date()
    }
  });
}
