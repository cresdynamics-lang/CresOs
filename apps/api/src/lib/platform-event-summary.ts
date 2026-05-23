import type { PrismaClient } from "@prisma/client";

type EventRow = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: Date;
};

function metaString(metadata: unknown, key: string): string | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const v = (metadata as Record<string, unknown>)[key];
  return v != null ? String(v) : null;
}

/** Human-readable summary + actor label for director activity feed. */
export async function enrichPlatformEventSummaries(
  prisma: PrismaClient,
  events: EventRow[]
): Promise<Map<string, { summary: string; actorLabel: string | null }>> {
  const out = new Map<string, { summary: string; actorLabel: string | null }>();
  if (events.length === 0) return out;

  const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true }
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a.name?.trim() || a.email || "Developer"]));

  const taskIds = events.filter((e) => e.entityType === "task").map((e) => e.entityId);
  const milestoneIds = events.filter((e) => e.entityType === "milestone").map((e) => e.entityId);

  const tasks =
    taskIds.length > 0
      ? await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true, status: true, project: { select: { name: true } } }
        })
      : [];
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const milestones =
    milestoneIds.length > 0
      ? await prisma.milestone.findMany({
          where: { id: { in: milestoneIds } },
          select: { id: true, name: true, status: true, project: { select: { name: true } } }
        })
      : [];
  const milestoneById = new Map(milestones.map((m) => [m.id, m]));

  for (const ev of events) {
    const actorLabel = ev.actorId ? actorById.get(ev.actorId) ?? "Developer" : null;
    const devTag = actorLabel ? `[${actorLabel}]` : "";

    if (ev.type === "task.completed" || ev.type === "task.updated" || ev.type === "task.blocked") {
      const task = taskById.get(ev.entityId);
      const title = metaString(ev.metadata, "taskTitle") || task?.title || "Task";
      const projectName = metaString(ev.metadata, "projectName") || task?.project?.name;
      const status = metaString(ev.metadata, "status") || task?.status || "";
      const statusLabel =
        status === "done"
          ? "done"
          : status === "blocked"
            ? "blocked"
            : status === "in_progress"
              ? "in progress"
              : status.replace(/_/g, " ");
      const prefix =
        ev.type === "task.completed"
          ? `${devTag} Task done`.trim()
          : ev.type === "task.blocked"
            ? `${devTag} Task blocked`.trim()
            : `${devTag} Task updated`.trim();
      const summary = projectName
        ? `${prefix}: "${title}" (${statusLabel}) · ${projectName}`
        : `${prefix}: "${title}" (${statusLabel})`;
      out.set(ev.id, { summary, actorLabel });
      continue;
    }

    if (
      ev.type === "milestone.created" ||
      ev.type === "milestone.updated" ||
      ev.type === "milestone.completed"
    ) {
      const ms = milestoneById.get(ev.entityId);
      const name = metaString(ev.metadata, "milestoneName") || ms?.name || "Milestone";
      const projectName = metaString(ev.metadata, "projectName") || ms?.project?.name;
      const status = metaString(ev.metadata, "status") || ms?.status || "";
      const prefix =
        ev.type === "milestone.completed"
          ? `${devTag} Milestone completed`.trim()
          : ev.type === "milestone.created"
            ? `${devTag} Milestone added`.trim()
            : `${devTag} Milestone updated`.trim();
      const statusBit = status ? ` (${status.replace(/_/g, " ")})` : "";
      const summary = projectName
        ? `${prefix}: "${name}"${statusBit} · ${projectName}`
        : `${prefix}: "${name}"${statusBit}`;
      out.set(ev.id, { summary, actorLabel });
      continue;
    }

    let extra = "";
    if (ev.metadata != null && typeof ev.metadata === "object") {
      try {
        extra = JSON.stringify(ev.metadata).slice(0, 120);
      } catch {
        extra = "";
      }
    }
    const tail = extra ? ` — ${extra}` : "";
    out.set(ev.id, {
      summary: `${ev.type} · ${ev.entityType}${tail}`,
      actorLabel
    });
  }

  return out;
}
