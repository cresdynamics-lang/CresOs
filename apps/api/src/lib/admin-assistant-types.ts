export type AdminAssistantMode = "execute" | "intelligence";

export type ProposedActionKind = "schedule_meeting" | "create_task" | "create_project_task";

export type ProposedAction = {
  id: string;
  kind: ProposedActionKind;
  title: string;
  scheduledAt?: string | null;
  dueDate?: string | null;
  assigneeHint?: string | null;
  projectHint?: string | null;
  estimatedHours?: number | null;
  notes?: string | null;
};

export type ProjectBrief = {
  projectId: string;
  projectName: string;
  status: string;
  healthScore: number;
  riskLevel: string;
  summary: string;
};

export type PersonInsight = {
  personHint: string;
  roleHints?: string[];
  summary: string;
};

export type AdminAssistantResponse = {
  mode: AdminAssistantMode;
  reply: string;
  aiGenerated: boolean;
  transcript?: string;
  proposedActions?: ProposedAction[];
  projectBriefs?: ProjectBrief[];
  personInsights?: PersonInsight[];
};
