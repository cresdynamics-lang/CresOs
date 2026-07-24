import { DEFAULT_ORG_DAY_TZ, getZonedDateKey } from "../modules/org-zoned-day";
import type { ProjectAiPlan } from "./project-ai-plan-types";

const MILESTONE_SPACING_DAYS = 2;

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isStalePlanDate(dateKey: string | undefined, anchorKey: string): boolean {
  if (!dateKey?.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return true;
  return dateKey < anchorKey;
}

/** Spread `count` task due dates across [startKey, endKey] (inclusive). */
function distributeTaskDates(startKey: string, endKey: string, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [endKey];
  const start = new Date(`${startKey}T12:00:00.000Z`).getTime();
  const end = new Date(`${endKey}T12:00:00.000Z`).getTime();
  const span = Math.max(0, end - start);
  return Array.from({ length: count }, (_, i) => {
    const frac = (i + 1) / count;
    const ms = start + span * frac;
    return new Date(ms).toISOString().slice(0, 10);
  });
}

/**
 * Replace AI-generated milestone/task dates (often stale e.g. 2024) with a schedule
 * anchored on the project-creation day: milestone 0 = today, each next milestone +2 days,
 * tasks distributed between milestone breakpoints.
 */
export function normalizeProjectAiPlanDates(
  plan: ProjectAiPlan,
  options?: { anchorDate?: Date; tz?: string; milestoneSpacingDays?: number }
): ProjectAiPlan {
  const tz = options?.tz ?? DEFAULT_ORG_DAY_TZ;
  const anchorKey = getZonedDateKey(options?.anchorDate ?? new Date(), tz);
  const spacing = options?.milestoneSpacingDays ?? MILESTONE_SPACING_DAYS;

  const out: ProjectAiPlan = {
    ...plan,
    timeline: [...(plan.timeline ?? [])],
    sprints: plan.sprints.map((s) => ({
      ...s,
      milestones: s.milestones.map((m) => ({
        ...m,
        tasks: m.tasks.map((t) => ({ ...t }))
      }))
    })),
    roleBriefs: { ...plan.roleBriefs }
  };

  let milestoneIndex = 0;
  let prevMilestoneDueKey = anchorKey;

  for (const sprint of out.sprints) {
    const firstMilestoneIdx = milestoneIndex;
    let lastMilestoneDueKey = anchorKey;

    for (const milestone of sprint.milestones) {
      const dueKey = addDaysToDateKey(anchorKey, milestoneIndex * spacing);
      milestone.dueDate = dueKey;
      lastMilestoneDueKey = dueKey;

      const windowStart = milestoneIndex === 0 ? anchorKey : prevMilestoneDueKey;
      const taskDates = distributeTaskDates(windowStart, dueKey, milestone.tasks.length);
      milestone.tasks.forEach((task, ti) => {
        const assigned = taskDates[ti] ?? dueKey;
        task.dueDate =
          task.dueDate && !isStalePlanDate(task.dueDate, anchorKey) ? task.dueDate : assigned;
        if (isStalePlanDate(task.dueDate, anchorKey)) {
          task.dueDate = assigned;
        }
      });

      prevMilestoneDueKey = dueKey;
      milestoneIndex += 1;
    }

    const sprintStartKey = addDaysToDateKey(anchorKey, firstMilestoneIdx * spacing);
    sprint.startDate =
      sprint.startDate && !isStalePlanDate(sprint.startDate, anchorKey)
        ? sprint.startDate
        : sprintStartKey;
    sprint.endDate =
      sprint.endDate && !isStalePlanDate(sprint.endDate, anchorKey)
        ? sprint.endDate
        : lastMilestoneDueKey;
  }

  out.timeline = (out.timeline ?? []).map((entry, i) => ({
    ...entry,
    date:
      entry.date && !isStalePlanDate(entry.date, anchorKey)
        ? entry.date
        : addDaysToDateKey(anchorKey, Math.max(0, milestoneIndex - 1) * spacing + i * spacing)
  }));

  return out;
}
