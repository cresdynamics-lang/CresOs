export type ProjectAiPlanTask = {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  estimatedHours?: number;
  dayHint?: string;
};

export type ProjectAiPlanMilestone = {
  name: string;
  dueDate?: string;
  acceptanceCriteria?: string;
  tasks: ProjectAiPlanTask[];
};

export type ProjectAiPlanSprint = {
  name: string;
  goal: string;
  startDate?: string;
  endDate?: string;
  milestones: ProjectAiPlanMilestone[];
};

export type ProjectAiRoleBriefs = {
  developers: string;
  sales: string;
  director: string;
  projectManager: string;
};

export type ProjectAiPlan = {
  projectSummary: string;
  projectDetails: string;
  documentUnderstanding?: string;
  projectType?: string;
  successCriteria: string;
  agileSprintNotes: string;
  timeline: { date?: string; title: string }[];
  sprints: ProjectAiPlanSprint[];
  roleBriefs: ProjectAiRoleBriefs;
  suggestedProjectName?: string;
};

export type PlanningNote = {
  id: string;
  source: string;
  authorRole: string;
  aiSummary: string | null;
  roleBriefs: ProjectAiRoleBriefs | null;
  fileName: string | null;
  createdAt: string;
  author?: { id: string; name: string | null; email: string } | null;
};

export function countPlanTasks(plan: ProjectAiPlan): number {
  return plan.sprints.reduce(
    (sum, s) => sum + s.milestones.reduce((mSum, m) => mSum + m.tasks.length, 0),
    0
  );
}

export function countPlanMilestones(plan: ProjectAiPlan): number {
  return plan.sprints.reduce((sum, s) => sum + s.milestones.length, 0);
}

export function resolvePlanProjectDetails(plan: ProjectAiPlan): string {
  const details = plan.projectDetails?.trim();
  if (details) return details;
  return plan.projectSummary?.trim() ?? "";
}
