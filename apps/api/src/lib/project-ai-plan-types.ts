export type ProjectAiPlanTask = {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
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
  /** Short executive summary (1–3 sentences). */
  projectSummary: string;
  /** Full structured brief — this becomes the project’s projectDetails field. */
  projectDetails: string;
  /** What the source document/brief is about (type, audience, intent). */
  documentUnderstanding?: string;
  /** Detected domain: website, ecommerce, mobile_app, saas, api_backend, custom, etc. */
  projectType?: string;
  successCriteria: string;
  agileSprintNotes: string;
  timeline: { date?: string; title: string }[];
  sprints: ProjectAiPlanSprint[];
  roleBriefs: ProjectAiRoleBriefs;
  suggestedProjectName?: string;
};

export function emptyProjectAiPlan(): ProjectAiPlan {
  return {
    projectSummary: "",
    projectDetails: "",
    successCriteria: "",
    agileSprintNotes: "",
    timeline: [],
    sprints: [],
    roleBriefs: {
      developers: "",
      sales: "",
      director: "",
      projectManager: ""
    }
  };
}

/** Canonical text stored on Project.projectDetails. */
export function resolvePlanProjectDetails(plan: ProjectAiPlan): string {
  const details = plan.projectDetails?.trim();
  if (details) return details;
  return plan.projectSummary?.trim() ?? "";
}

export function countPlanTasks(plan: ProjectAiPlan): number {
  return plan.sprints.reduce(
    (sum, s) => sum + s.milestones.reduce((mSum, m) => mSum + m.tasks.length, 0),
    0
  );
}

export function countPlanMilestones(plan: ProjectAiPlan): number {
  return plan.sprints.reduce((sum, s) => sum + s.milestones.length, 0);
}
