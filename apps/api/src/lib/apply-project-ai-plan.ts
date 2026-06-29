import { Prisma, type PrismaClient } from "@prisma/client";
import type { ProjectAiPlan } from "./project-ai-plan-types";

function parseDate(value?: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function appendText(prev: string | null | undefined, addition: string): string {
  const p = prev?.trim() ?? "";
  const a = addition.trim();
  if (!a) return p;
  return p ? `${p}\n\n${a}` : a;
}

function taskDescription(task: {
  description?: string;
  dayHint?: string;
  priority?: string;
  sprintName?: string;
}): string | null {
  const parts: string[] = [];
  if (task.sprintName) parts.push(`Sprint: ${task.sprintName}`);
  if (task.dayHint) parts.push(`Schedule: ${task.dayHint}`);
  if (task.priority) parts.push(`Priority: ${task.priority}`);
  if (task.description?.trim()) parts.push(task.description.trim());
  return parts.length ? parts.join("\n") : null;
}

export async function applyProjectAiPlan(
  prisma: PrismaClient,
  input: {
    orgId: string;
    projectId: string;
    plan: ProjectAiPlan;
    merge?: boolean;
  }
): Promise<{ milestonesCreated: number; tasksCreated: number }> {
  const { orgId, projectId, plan, merge = true } = input;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null }
  });
  if (!project) throw new Error("Project not found");

  let milestonesCreated = 0;
  let tasksCreated = 0;

  await prisma.$transaction(async (tx) => {
    const timeline = plan.timeline?.length
      ? (merge && Array.isArray(project.timeline)
          ? [...(project.timeline as object[]), ...plan.timeline]
          : plan.timeline)
      : project.timeline;

    await tx.project.update({
      where: { id: projectId },
      data: {
        projectDetails: merge
          ? appendText(project.projectDetails, plan.projectSummary)
          : plan.projectSummary || project.projectDetails,
        successCriteria: merge
          ? appendText(project.successCriteria, plan.successCriteria)
          : plan.successCriteria || project.successCriteria,
        agileSprintNotes: merge
          ? appendText(project.agileSprintNotes, plan.agileSprintNotes)
          : plan.agileSprintNotes || project.agileSprintNotes,
        timeline: timeline as Prisma.InputJsonValue
      }
    });

    for (const sprint of plan.sprints) {
      for (const milestone of sprint.milestones) {
        const createdMilestone = await tx.milestone.create({
          data: {
            orgId,
            projectId,
            name: milestone.name,
            dueDate: parseDate(milestone.dueDate),
            status: "pending",
            acceptanceCriteria: milestone.acceptanceCriteria
              ? `[${sprint.name}] ${milestone.acceptanceCriteria}`
              : sprint.goal
                ? `[${sprint.name}] ${sprint.goal}`
                : null
          }
        });
        milestonesCreated += 1;

        for (const task of milestone.tasks) {
          await tx.task.create({
            data: {
              orgId,
              projectId,
              milestoneId: createdMilestone.id,
              title: task.title,
              description: taskDescription({
                description: task.description,
                dayHint: task.dayHint,
                priority: task.priority,
                sprintName: sprint.name
              }),
              status: "todo",
              priority: task.priority ?? "medium",
              dueDate: parseDate(task.dueDate),
              estimatedHours:
                task.estimatedHours != null && !Number.isNaN(Number(task.estimatedHours))
                  ? new Prisma.Decimal(Number(task.estimatedHours))
                  : undefined
            }
          });
          tasksCreated += 1;
        }
      }
    }
  });

  return { milestonesCreated, tasksCreated };
}
