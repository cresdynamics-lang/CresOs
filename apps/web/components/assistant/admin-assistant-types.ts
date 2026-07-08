export type AdminAssistantMode = "execute" | "intelligence";

export type IntelligenceFocus = "projects" | "person" | "hours" | "services" | "general";

export const INTELLIGENCE_FOCUS_OPTIONS: { id: IntelligenceFocus; label: string }[] = [
  { id: "general", label: "General" },
  { id: "projects", label: "Projects" },
  { id: "person", label: "People" },
  { id: "hours", label: "Hours vs days" },
  { id: "services", label: "Services fit" }
];

export type ProposedAction = {
  id: string;
  kind: "schedule_meeting" | "create_task" | "create_project_task";
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
  mode: "execute" | "intelligence";
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

export type ExecutedActionResult = {
  actionId: string;
  kind: ProposedAction["kind"];
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
  sessionId?: string;
};

export type AssistantSessionRow = {
  id: string;
  assistantKind: string;
  mode: string;
  focus: string | null;
  message: string;
  reply: string | null;
  aiGenerated: boolean;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

export const EXECUTE_PROMPTS = [
  "Friday 2pm meet Salim about Pantry Masters proposal",
  "Next Monday assign Wilson 4 hours to prepare ERP scope doc for Pantry Masters",
  "Schedule check-in with director tomorrow 10am"
];

export const INTELLIGENCE_PROMPTS = [
  "Summarize all active projects and flag risks",
  "How is Wilson doing in the last 30 days?",
  "Convert Wilson's latest report from days to hours estimates",
  "Which projects map to CresOS vs website services?"
];
