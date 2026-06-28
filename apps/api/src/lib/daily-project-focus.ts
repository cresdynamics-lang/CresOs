import type { PrismaClient } from "@prisma/client";
import { DEFAULT_ORG_DAY_TZ, getUtcRangeForZonedDate, getZonedDateKey } from "../modules/org-zoned-day";

export const DAILY_FOCUS_DESC_PREFIX = "cresos:daily-focus:";

export function dailyFocusDescriptionMarker(dateKey: string, userId: string): string {
  return `${DAILY_FOCUS_DESC_PREFIX}${dateKey}:${userId}`;
}

export type DailyFocusSyncResult = {
  dateKey: string;
  taskId: string | null;
  taskCreated: boolean;
  taskTitle: string | null;
  milestoneId: string | null;
  milestoneName: string | null;
  milestoneCriteriaUpdated: boolean;
};

/** Create or update today's focus task and append note to active milestone acceptance criteria. */
export async function syncDailyFocusDelivery(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  projectId: string,
  note: string | null
): Promise<DailyFocusSyncResult> {
  const dateKey = getZonedDateKey(new Date(), DEFAULT_ORG_DAY_TZ);
  const marker = dailyFocusDescriptionMarker(dateKey, userId);
  const { end: dayEnd } = await getUtcRangeForZonedDate(prisma, dateKey, DEFAULT_ORG_DAY_TZ);
  const dueDate = new Date(dayEnd.getTime() - 60_000);

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null },
    select: { id: true, name: true }
  });

  const focusLabel = note?.trim() || `Work on ${project?.name ?? "project"} today`;
  const taskTitle = focusLabel.length > 120 ? `${focusLabel.slice(0, 117)}…` : focusLabel;

  const existingTask = await prisma.task.findFirst({
    where: {
      orgId,
      projectId,
      assigneeId: userId,
      deletedAt: null,
      description: { contains: marker }
    },
    select: { id: true, title: true, status: true }
  });

  let taskId: string | null = existingTask?.id ?? null;
  let taskCreated = false;

  if (existingTask) {
    await prisma.task.update({
      where: { id: existingTask.id },
      data: {
        title: taskTitle,
        dueDate,
        status: existingTask.status === "done" ? "done" : "in_progress"
      }
    });
  } else {
    const created = await prisma.task.create({
      data: {
        orgId,
        projectId,
        title: taskTitle,
        description: `${marker}\nDaily project focus set from developer workspace.`,
        status: "in_progress",
        priority: "high",
        assigneeId: userId,
        dueDate
      }
    });
    taskId = created.id;
    taskCreated = true;
    await prisma.eventLog.create({
      data: {
        orgId,
        actorId: userId,
        type: "task.created",
        entityType: "task",
        entityId: created.id,
        metadata: { projectId, source: "daily_project_focus", dateKey }
      }
    });
  }

  const activeMilestone = await prisma.milestone.findFirst({
    where: {
      orgId,
      projectId,
      deletedAt: null,
      status: { in: ["in_progress", "pending"] }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, acceptanceCriteria: true }
  });

  let milestoneCriteriaUpdated = false;
  if (activeMilestone && note?.trim()) {
    const criteriaLine = `[Focus ${dateKey}]: ${note.trim()}`;
    const existing = activeMilestone.acceptanceCriteria?.trim() ?? "";
    if (!existing.includes(criteriaLine)) {
      const nextCriteria = existing ? `${existing}\n${criteriaLine}` : criteriaLine;
      await prisma.milestone.update({
        where: { id: activeMilestone.id },
        data: { acceptanceCriteria: nextCriteria }
      });
      milestoneCriteriaUpdated = true;
    }
  }

  return {
    dateKey,
    taskId,
    taskCreated,
    taskTitle,
    milestoneId: activeMilestone?.id ?? null,
    milestoneName: activeMilestone?.name ?? null,
    milestoneCriteriaUpdated
  };
}

/** Find today's auto-created focus task for a user on a project. */
export async function findTodayFocusTask(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  projectId: string
): Promise<{ id: string; status: string; title: string } | null> {
  const dateKey = getZonedDateKey(new Date(), DEFAULT_ORG_DAY_TZ);
  const marker = dailyFocusDescriptionMarker(dateKey, userId);
  return prisma.task.findFirst({
    where: {
      orgId,
      projectId,
      assigneeId: userId,
      deletedAt: null,
      description: { contains: marker }
    },
    select: { id: true, status: true, title: true }
  });
}

/** True if user updated focus for the current org day. */
export function isFocusSetToday(updatedAt: Date | null | undefined, dateKey: string): boolean {
  if (!updatedAt) return false;
  return getZonedDateKey(updatedAt, DEFAULT_ORG_DAY_TZ) === dateKey;
}
