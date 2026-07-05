export type AdminAssistantMode = "execute" | "intelligence";

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

export const EXECUTE_PROMPTS = [
  "Friday 2pm meet Salim about Pantry Masters proposal",
  "Next Monday assign Wilson 4 hours to prepare ERP scope doc for Pantry Masters",
  "Schedule check-in with director tomorrow 10am"
];

export const INTELLIGENCE_PROMPTS = [
  "Summarize all active projects and flag risks",
  "How is Wilson doing in the last 30 days?",
  "Convert latest developer reports from days to hours estimates",
  "Which projects map to CresOS vs website services?"
];
