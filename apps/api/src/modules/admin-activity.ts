import type { PrismaClient } from "@prisma/client";

export type AdminActivityInput = {
  orgId: string;
  type: string;
  summary: string;
  body?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Log an activity message that admin can see in the Messages feed (things happening in the system).
 */
export async function logAdminActivity(prisma: PrismaClient, input: AdminActivityInput): Promise<void> {
  await prisma.adminActivityMessage.create({
    data: {
      orgId: input.orgId,
      type: input.type,
      summary: input.summary,
      body: input.body ?? null,
      actorId: input.actorId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as any
    }
  });
}

/**
 * When sending an email notification, call this so admin sees subject/snippet in Messages.
 */
export async function logEmailSent(
  prisma: PrismaClient,
  opts: {
    orgId: string;
    to: string;
    subject: string;
    body: string;
    type?: string;
    actorId?: string | null;
  }
): Promise<void> {
  const snippet = opts.body.slice(0, 300);
  await logAdminActivity(prisma, {
    orgId: opts.orgId,
    type: "email_sent",
    summary: `Email to ${opts.to}: ${opts.subject}`,
    body: snippet + (opts.body.length > 300 ? "…" : ""),
    actorId: opts.actorId ?? null,
    metadata: { to: opts.to, notificationType: opts.type ?? null }
  });
}
