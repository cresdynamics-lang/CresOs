export type AdminAssistantMode = "execute" | "intelligence";

export type IntelligenceFocus = "projects" | "person" | "hours" | "services" | "general";

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
  userId?: string;
  roleHints?: string[];
  summary: string;
  reportDaysLast30?: number;
  estimatedHours?: number;
  actualHours?: number;
};

export type HoursInsight = {
  subject: string;
  daysMentioned?: number;
  estimatedHours?: number;
  actualHours?: number;
  summary: string;
};

export type AdminAssistantResponse = {
  mode: AdminAssistantMode;
  reply: string;
  aiGenerated: boolean;
  focus?: IntelligenceFocus;
  sessionId?: string;
  transcript?: string;
  proposedActions?: ProposedAction[];
  projectBriefs?: ProjectBrief[];
  personInsights?: PersonInsight[];
  hoursInsights?: HoursInsight[];
};

export type ActionOverride = {
  assigneeId?: string;
  projectId?: string;
};

export type ExecutedActionResult = {
  actionId: string;
  kind: ProposedActionKind;
  success: boolean;
  error?: string;
  candidates?: { id: string; label: string }[];
  scheduleItemId?: string;
  taskId?: string;
  resolvedAssignee?: string;
  resolvedProject?: string;
};

export type ExecuteActionsResponse = {
  results: ExecutedActionResult[];
  succeeded: number;
  failed: number;
};
