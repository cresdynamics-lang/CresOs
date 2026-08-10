import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";

type EscalateSource = "invoice_created" | "finance_escalate" | "overdue";

export type EscalateInvoiceCollectionInput = {
  orgId: string;
  invoiceId: string;
  escalatedById?: string | null;
  source?: EscalateSource;
};

function collectionDueAt(issueDate: Date, dueDate: Date | null | undefined): Date {
  if (dueDate && !Number.isNaN(dueDate.getTime())) return dueDate;
  const d = new Date(issueDate);
  d.setDate(d.getDate() + 14);
  return d;
}

async function resolveSalesAssignees(
  prisma: PrismaClient,
  orgId: string,
  projectId: string | null | undefined
): Promise<string[]> {
  const ids = new Set<string>();

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, deletedAt: null },
      select: { ownerUserId: true, createdByUserId: true }
    });
    for (const uid of [project?.ownerUserId, project?.createdByUserId]) {
      if (!uid) continue;
      const sales = await prisma.userRole.findFirst({
        where: {
          userId: uid,
          role: { orgId, key: ROLE_KEYS.sales }
        },
        select: { userId: true }
      });
      if (sales) ids.add(uid);
    }
  }

  if (ids.size === 0) {
    const salesUsers = await prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "active",
        roles: { some: { role: { orgId, key: ROLE_KEYS.sales } } }
      },
      select: { id: true }
    });
    for (const u of salesUsers) ids.add(u.id);
  }

  return [...ids];
}

async function notifyRoles(
  prisma: PrismaClient,
  orgId: string,
  roleKeys: string[],
  payload: { subject: string; body: string; type: string; tier: string },
  excludeUserIds: string[] = []
) {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: "active",
      roles: { some: { role: { orgId, key: { in: roleKeys } } } },
      ...(excludeUserIds.length
        ? { id: { notIn: excludeUserIds } }
        : {})
    },
    select: { id: true }
  });
  if (!users.length) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({
      orgId,
      channel: "in_app",
      to: u.id,
      subject: payload.subject,
      body: payload.body,
      status: "sent",
      type: payload.type,
      tier: payload.tier
    }))
  });
}

/**
 * Creates (or refreshes) collection tasks for sales on an invoice and notifies
 * sales + leadership (admin / finance / director) with the payment timeline.
 */
export async function escalateInvoiceToSales(
  prisma: PrismaClient,
  input: EscalateInvoiceCollectionInput
): Promise<{ taskIds: string[]; assignedToIds: string[] }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: input.orgId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } }
    }
  });
  if (!invoice) {
    return { taskIds: [], assignedToIds: [] };
  }

  const assignees = await resolveSalesAssignees(prisma, input.orgId, invoice.projectId);
  if (!assignees.length) {
    return { taskIds: [], assignedToIds: [] };
  }

  const dueAt = collectionDueAt(invoice.issueDate, invoice.dueDate);
  const source = input.source ?? "invoice_created";
  const taskIds: string[] = [];

  for (const assignedToId of assignees) {
    const existing = await prisma.invoiceCollectionTask.findUnique({
      where: {
        invoiceId_assignedToId: { invoiceId: invoice.id, assignedToId }
      }
    });
    if (existing) {
      const updated = await prisma.invoiceCollectionTask.update({
        where: { id: existing.id },
        data: {
          status: existing.status === "closed" ? "open" : existing.status,
          dueAt,
          source,
          escalatedById: input.escalatedById ?? existing.escalatedById,
          updatedAt: new Date()
        }
      });
      taskIds.push(updated.id);
      continue;
    }
    const created = await prisma.invoiceCollectionTask.create({
      data: {
        orgId: input.orgId,
        invoiceId: invoice.id,
        assignedToId,
        escalatedById: input.escalatedById ?? null,
        status: "open",
        dueAt,
        source
      }
    });
    taskIds.push(created.id);
  }

  const dueLabel = dueAt.toISOString().slice(0, 10);
  const clientName = invoice.client?.name ?? "client";
  const subject = `Invoice due · ${invoice.number}`;
  const body = `Finance escalated invoice ${invoice.number} (${clientName}, ${invoice.currency} ${Number(invoice.totalAmount).toFixed(2)}). Reach the client before ${dueLabel} and log the outcome.`;

  await prisma.notification.createMany({
    data: assignees.map((to) => ({
      orgId: input.orgId,
      channel: "in_app",
      to,
      subject,
      body,
      status: "sent",
      type: "invoice.collection.escalated",
      tier: "financial"
    }))
  });

  await notifyRoles(
    prisma,
    input.orgId,
    [ROLE_KEYS.admin, ROLE_KEYS.finance, ROLE_KEYS.director],
    {
      subject: `Collection assigned · ${invoice.number}`,
      body: `Invoice ${invoice.number} for ${clientName} was assigned to sales with timeline ${dueLabel}.`,
      type: "invoice.collection.assigned",
      tier: "financial"
    },
    assignees
  );

  await prisma.eventLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.escalatedById ?? null,
      type: "invoice.collection.escalated",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: {
        number: invoice.number,
        assignedToIds: assignees,
        dueAt: dueAt.toISOString(),
        source,
        taskIds
      }
    }
  });

  return { taskIds, assignedToIds: assignees };
}

export async function markCollectionReached(
  prisma: PrismaClient,
  input: {
    orgId: string;
    taskId: string;
    actorUserId: string;
    clientNote: string;
    isAdmin?: boolean;
  }
) {
  const note = input.clientNote.trim();
  if (!note) {
    throw Object.assign(new Error("Client note is required"), { code: "NOTE_REQUIRED" });
  }

  const task = await prisma.invoiceCollectionTask.findFirst({
    where: {
      id: input.taskId,
      orgId: input.orgId,
      ...(input.isAdmin ? {} : { assignedToId: input.actorUserId })
    },
    include: {
      invoice: {
        include: { client: { select: { name: true } } }
      },
      assignedTo: { select: { id: true, name: true, email: true } }
    }
  });
  if (!task) {
    throw Object.assign(new Error("Collection task not found"), { code: "NOT_FOUND" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceCollectionTask.update({
      where: { id: task.id },
      data: {
        status: "reached",
        reachedAt: new Date(),
        clientNote: note
      }
    });
    await tx.invoiceCollectionNote.create({
      data: {
        orgId: input.orgId,
        taskId: task.id,
        authorId: input.actorUserId,
        content: note
      }
    });
    const salesName = task.assignedTo.name?.trim() || task.assignedTo.email;
    await tx.eventLog.create({
      data: {
        orgId: input.orgId,
        actorId: input.actorUserId,
        type: "invoice.collection.reached",
        entityType: "invoice",
        entityId: task.invoiceId,
        metadata: {
          taskId: task.id,
          invoiceNumber: task.invoice.number,
          salesUserId: task.assignedToId,
          salesName,
          clientNote: note
        }
      }
    });
    return row;
  });

  const salesName = task.assignedTo.name?.trim() || task.assignedTo.email;
  await notifyRoles(
    prisma,
    input.orgId,
    [ROLE_KEYS.admin, ROLE_KEYS.finance, ROLE_KEYS.director],
    {
      subject: `Client reached · ${task.invoice.number}`,
      body: `${salesName} reached ${task.invoice.client?.name ?? "the client"} about invoice ${task.invoice.number}: ${note}`,
      type: "invoice.collection.reached",
      tier: "financial"
    }
  );

  return updated;
}
