import type { PrismaClient } from "@prisma/client";
import { getAcceptedDeveloperIds } from "../lib/project-access";
import { logAdminActivity } from "./admin-activity";
import { getAdminUsers, getDirectorUsers } from "./director-notifications";

const DEFAULT_TYPE = "project.execution";

/**
 * In-app notifications for directors, admins, project creator (typically sales), and assigned developer.
 * Optional email to directors only (same pattern as notifyDirectors).
 */
export async function notifyProjectExecutionStakeholders(
  prisma: PrismaClient,
  orgId: string,
  project: { name: string; createdByUserId: string | null; assignedDeveloperId: string | null },
  subject: string,
  body: string,
  options?: { type?: string; excludeUserId?: string; emailDirectors?: boolean; projectId?: string }
): Promise<void> {
  const directors = await getDirectorUsers(prisma, orgId);
  const admins = await getAdminUsers(prisma, orgId);
  const recipientIds = new Set<string>();
  for (const d of directors) recipientIds.add(d.id);
  for (const a of admins) recipientIds.add(a.id);
  if (project.createdByUserId) recipientIds.add(project.createdByUserId);
  if (options?.projectId) {
    const devIds = await getAcceptedDeveloperIds(prisma, options.projectId);
    for (const id of devIds) recipientIds.add(id);
  } else if (project.assignedDeveloperId) {
    recipientIds.add(project.assignedDeveloperId);
  }
  if (options?.excludeUserId) recipientIds.delete(options.excludeUserId);

  if (recipientIds.size === 0) return;

  const type = options?.type ?? DEFAULT_TYPE;
  const emailSubject = `[CresOS] ${subject}`;
  const emailDirectors = options?.emailDirectors !== false;

  const inAppRows = [...recipientIds].map((to) => ({
    orgId,
    channel: "in_app" as const,
    to,
    subject,
    body,
    status: "sent",
    type,
    tier: "execution"
  }));

  const emailRows: {
    orgId: string;
    channel: "email";
    to: string;
    subject: string;
    body: string;
    status: string;
    type: string;
    tier: string;
  }[] = [];
  if (emailDirectors) {
    for (const d of directors) {
      if (options?.excludeUserId && d.id === options.excludeUserId) continue;
      emailRows.push({
        orgId,
        channel: "email",
        to: d.email,
        subject: emailSubject,
        body,
        status: "queued",
        type,
        tier: "governance"
      });
    }
  }

  await prisma.notification.createMany({ data: [...inAppRows, ...emailRows] });

  if (emailDirectors && directors.length > 0) {
    await logAdminActivity(prisma, {
      orgId,
      type: "email_sent",
      summary: `Email to ${directors.length} director(s): ${subject}`,
      body: body.slice(0, 300) + (body.length > 300 ? "…" : ""),
      metadata: { type, recipientCount: directors.length }
    });
  }
}
