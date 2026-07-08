import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ProposedAction } from "./admin-assistant-types";
import {
  parseActionDate,
  resolveProjectHint,
  resolveUserHint,
  type ResolveCandidate
} from "./admin-assistant-resolve";
import { ingestKnowledgeFromEventLog } from "./knowledge-from-event";

const DEFAULT_REMINDER_MINUTES = Number(process.env.ASSISTANT_SCHEDULE_REMINDER_MINUTES) || 30;

function scheduleReminderMinutes(action: ProposedAction): number {
  const raw = action.notes?.match(/remind(?:er)?\s+(\d+)\s*min/i)?.[1];
  if (raw) {
    const n = Number(raw);
    if ([5, 15, 30, 60, 120].includes(n)) return n;
  }
  return DEFAULT_REMINDER_MINUTES;
}

async function createScheduleItem(
  prisma: PrismaClient,
  data: {
    orgId: string;
    userId: string;
    title: string;
    type: string;
    scheduledAt: Date;
    notes?: string | null;
    reminderMinutesBefore?: number;
  }
) {
  const reminderMinutesBefore = data.reminderMinutesBefore ?? DEFAULT_REMINDER_MINUTES;
  return prisma.scheduleItem.create({
    data: {
      orgId: data.orgId,
      userId: data.userId,
      title: data.title.trim(),
      type: data.type,
      scheduledAt: data.scheduledAt,
      originalScheduledAt: data.scheduledAt,
      status: "scheduled",
      notes: data.notes?.trim() || null,
      reminderMinutesBefore,
      reminderSentAt: null
    }
  });
}

async function logExecutedEvent(
  prisma: PrismaClient,
  orgId: string,
  actorUserId: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
) {
  const event = await prisma.eventLog.create({
    data: {
      orgId,
      actorId: actorUserId,
      type: "admin.assistant.action_executed",
      entityType,
      entityId,
      metadata: { source: "admin_assistant", ...metadata }
    },
    select: { id: true }
  });
  void ingestKnowledgeFromEventLog(prisma, event.id).catch(() => undefined);
}

export type ExecutedAction = {
  actionId: string;
  kind: ProposedAction["kind"];
  success: boolean;
  error?: string;
  candidates?: ResolveCandidate[];
  scheduleItemId?: string;
  taskId?: string;
  resolvedAssignee?: string;
  resolvedProject?: string;
};

export type ExecuteActionsResult = {
  results: ExecutedAction[];
  succeeded: number;
  failed: number;
};

async function findDuplicateSchedule(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  title: string,
  scheduledAt: Date
): Promise<boolean> {
  const windowStart = new Date(scheduledAt.getTime() - 2 * 3_600_000);
  const windowEnd = new Date(scheduledAt.getTime() + 2 * 3_600_000);
  const existing = await prisma.scheduleItem.findFirst({
    where: {
      orgId,
      userId,
      title: { equals: title.trim(), mode: "insensitive" },
      scheduledAt: { gte: windowStart, lte: windowEnd },
      completedAt: null
    },
    select: { id: true }
  });
  return Boolean(existing);
}

export async function executeProposedActions(
  prisma: PrismaClient,
  orgId: string,
  actorUserId: string,
  actions: ProposedAction[],
  overrides?: Record<string, { assigneeId?: string; projectId?: string }>
): Promise<ExecuteActionsResult> {
  const results: ExecutedAction[] = [];
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setHours(10, 0, 0, 0);

  for (const action of actions) {
    const override = overrides?.[action.id];
    const base: ExecutedAction = {
      actionId: action.id,
      kind: action.kind,
      success: false
    };

    try {
      if (action.kind === "schedule_meeting" || action.kind === "create_task") {
        let assignee: { ok: true; id: string; label: string } | Awaited<ReturnType<typeof resolveUserHint>>;
        if (override?.assigneeId) {
          const user = await prisma.user.findFirst({
            where: { id: override.assigneeId, orgId, deletedAt: null },
            select: { id: true, name: true, email: true }
          });
          assignee = user
            ? { ok: true as const, id: user.id, label: user.name || user.email }
            : { ok: false as const, error: "Assignee not found" };
        } else if (action.assigneeHint?.trim()) {
          assignee = await resolveUserHint(prisma, orgId, action.assigneeHint);
        } else {
          const actor = await prisma.user.findFirst({
            where: { id: actorUserId, orgId, deletedAt: null },
            select: { id: true, name: true, email: true }
          });
          assignee = actor
            ? { ok: true as const, id: actor.id, label: actor.name || actor.email }
            : { ok: false as const, error: "Could not resolve assignee" };
        }
        if (!assignee.ok) {
          results.push({
            ...base,
            error: assignee.error,
            candidates: assignee.candidates
          });
          continue;
        }

        const scheduledAt = parseActionDate(
          action.scheduledAt ?? action.dueDate,
          tomorrow
        );

        const duplicate = await findDuplicateSchedule(
          prisma,
          orgId,
          assignee.id,
          action.title,
          scheduledAt
        );
        if (duplicate) {
          results.push({
            ...base,
            error: "Similar schedule item already exists at this time — skipped duplicate"
          });
          continue;
        }

        const type = action.kind === "schedule_meeting" ? "meeting" : "task";
        const reminderMinutesBefore = scheduleReminderMinutes(action);
        const item = await createScheduleItem(prisma, {
          orgId,
          userId: assignee.id,
          title: action.title,
          type,
          scheduledAt,
          notes: action.notes,
          reminderMinutesBefore
        });

        if (
          action.kind === "schedule_meeting" &&
          assignee.id !== actorUserId
        ) {
          await createScheduleItem(prisma, {
            orgId,
            userId: actorUserId,
            title: action.title,
            type: "meeting",
            scheduledAt,
            notes: `With ${assignee.label}${action.notes ? ` — ${action.notes}` : ""}`,
            reminderMinutesBefore
          });
        }

        await logExecutedEvent(prisma, orgId, actorUserId, "schedule_item", item.id, {
          actionKind: action.kind,
          assigneeId: assignee.id,
          scheduledAt: scheduledAt.toISOString(),
          reminderMinutesBefore
        });

        results.push({
          ...base,
          success: true,
          scheduleItemId: item.id,
          resolvedAssignee: assignee.label
        });
        continue;
      }

      if (action.kind === "create_project_task") {
        const project = override?.projectId
          ? await prisma.project.findFirst({
              where: { id: override.projectId, orgId, deletedAt: null },
              select: { id: true, name: true, status: true }
            })
          : null;
        const projectResolved = project
          ? { ok: true as const, id: project.id, label: project.name }
          : await resolveProjectHint(prisma, orgId, action.projectHint);
        if (!projectResolved.ok) {
          results.push({
            ...base,
            error: projectResolved.error,
            candidates: projectResolved.candidates
          });
          continue;
        }

        const projectRow = await prisma.project.findFirst({
          where: { id: projectResolved.id, orgId, deletedAt: null },
          select: { id: true, name: true, status: true }
        });
        if (!projectRow) {
          results.push({ ...base, error: "Project not found" });
          continue;
        }

        let assigneeId: string | null = null;
        let assigneeLabel: string | undefined;
        if (override?.assigneeId) {
          assigneeId = override.assigneeId;
        } else if (action.assigneeHint?.trim()) {
          const assignee = await resolveUserHint(prisma, orgId, action.assigneeHint);
          if (!assignee.ok) {
            results.push({
              ...base,
              error: assignee.error,
              candidates: assignee.candidates
            });
            continue;
          }
          assigneeId = assignee.id;
          assigneeLabel = assignee.label;
        }

        const dueDate = parseActionDate(action.dueDate ?? action.scheduledAt, tomorrow);
        let estimated: Prisma.Decimal | null = null;
        if (action.estimatedHours != null && !Number.isNaN(action.estimatedHours)) {
          estimated = new Prisma.Decimal(Number(action.estimatedHours).toFixed(2));
        } else if (projectRow.status === "active") {
          estimated = new Prisma.Decimal("1.00");
        }

        const task = await prisma.task.create({
          data: {
            orgId,
            projectId: projectRow.id,
            title: action.title.trim(),
            description: action.notes?.trim() || null,
            assigneeId,
            dueDate,
            estimatedHours: estimated,
            priority: "medium",
            status: "todo"
          }
        });

        if (assigneeId) {
          await createScheduleItem(prisma, {
            orgId,
            userId: assigneeId,
            title: task.title,
            type: "task",
            scheduledAt: dueDate,
            notes: `Assigned from project: ${projectRow.name}`,
            reminderMinutesBefore: DEFAULT_REMINDER_MINUTES
          });
        }

        await logExecutedEvent(prisma, orgId, actorUserId, "task", task.id, {
          actionKind: action.kind,
          projectId: projectRow.id,
          assigneeId,
          dueDate: dueDate.toISOString()
        });

        results.push({
          ...base,
          success: true,
          taskId: task.id,
          resolvedProject: projectResolved.label,
          resolvedAssignee: assigneeLabel
        });
        continue;
      }

      results.push({ ...base, error: `Unknown action kind` });
    } catch (e) {
      results.push({
        ...base,
        error: e instanceof Error ? e.message : "Execution failed"
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return { results, succeeded, failed: results.length - succeeded };
}
