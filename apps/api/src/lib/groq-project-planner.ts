import Groq from "groq-sdk";
import { resolveGroqModel } from "./groq-model";
import { transcribeReportAudio } from "./groq-voice-report";
import {
  emptyProjectAiPlan,
  type ProjectAiPlan,
  type ProjectAiPlanSprint
} from "./project-ai-plan-types";

const CHAT_MODEL = resolveGroqModel(
  process.env.GROQ_DIRECTOR_MODEL,
  process.env.GROQ_REMINDER_MODEL,
  process.env.GROQ_EMAIL_MODEL
);

let groqClient: Groq | null = null;
let groqKey: string | null = null;

function getGroq(): Groq | null {
  const candidates = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
    process.env.GROQ_API_KEY_TERTIARY
  ];
  const key = candidates.find((k) => typeof k === "string" && k.trim().length > 0)?.trim();
  if (!key) return null;
  if (!groqClient || groqKey !== key) {
    groqClient = new Groq({ apiKey: key });
    groqKey = key;
  }
  return groqClient;
}

function parseJsonFromModel(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() || trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1));
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizePlan(parsed: Record<string, unknown>): ProjectAiPlan {
  const base = emptyProjectAiPlan();
  base.projectSummary = asString(parsed.projectSummary) || asString(parsed.summary);
  base.successCriteria = asString(parsed.successCriteria);
  base.agileSprintNotes = asString(parsed.agileSprintNotes) || asString(parsed.sprintNotes);
  base.suggestedProjectName = asString(parsed.suggestedProjectName) || undefined;

  const timeline = Array.isArray(parsed.timeline) ? parsed.timeline : [];
  base.timeline = timeline
    .map((t) => {
      const row = t as Record<string, unknown>;
      return { date: asString(row.date) || undefined, title: asString(row.title) };
    })
    .filter((t) => t.title);

  const briefs = (parsed.roleBriefs ?? parsed.role_briefs) as Record<string, unknown> | undefined;
  if (briefs) {
    base.roleBriefs = {
      developers: asString(briefs.developers) || base.roleBriefs.developers,
      sales: asString(briefs.sales) || base.roleBriefs.sales,
      director: asString(briefs.director) || base.roleBriefs.director,
      projectManager: asString(briefs.projectManager ?? briefs.project_manager) || base.roleBriefs.projectManager
    };
  }

  const sprintsRaw = Array.isArray(parsed.sprints) ? parsed.sprints : [];
  base.sprints = sprintsRaw.map((s, si) => {
    const sprint = s as Record<string, unknown>;
    const milestonesRaw = Array.isArray(sprint.milestones) ? sprint.milestones : [];
    const milestones = milestonesRaw.map((m, mi) => {
      const mile = m as Record<string, unknown>;
      const tasksRaw = Array.isArray(mile.tasks) ? mile.tasks : [];
      const tasks = tasksRaw.map((t) => {
        const task = t as Record<string, unknown>;
        const hours = task.estimatedHours ?? task.estimated_hours;
        return {
          title: asString(task.title) || `Task ${mi + 1}.${tasksRaw.indexOf(t) + 1}`,
          description: asString(task.description) || undefined,
          priority: (asString(task.priority) || "medium") as ProjectAiPlan["sprints"][0]["milestones"][0]["tasks"][0]["priority"],
          dueDate: asString(task.dueDate ?? task.due_date) || undefined,
          estimatedHours: typeof hours === "number" ? hours : Number(hours) || undefined,
          dayHint: asString(task.dayHint ?? task.day_hint) || undefined
        };
      });
      return {
        name: asString(mile.name) || `Milestone ${mi + 1}`,
        dueDate: asString(mile.dueDate ?? mile.due_date) || undefined,
        acceptanceCriteria: asString(mile.acceptanceCriteria ?? mile.acceptance_criteria) || undefined,
        tasks
      };
    });
    return {
      name: asString(sprint.name) || `Sprint ${si + 1}`,
      goal: asString(sprint.goal) || "",
      startDate: asString(sprint.startDate ?? sprint.start_date) || undefined,
      endDate: asString(sprint.endDate ?? sprint.end_date) || undefined,
      milestones
    } satisfies ProjectAiPlanSprint;
  });

  return base;
}

const PLAN_SYSTEM = `You are a senior agile delivery planner for Cres Dynamics (software agency).
Turn briefs into actionable delivery plans developers can execute daily.

Rules:
- Output ONLY valid JSON matching the schema below — no markdown outside JSON.
- Prefer MANY small tasks (aim 20–60 tasks for a real project; more for large scopes).
- Use agile sprints (1–3 weeks each) with clear goals.
- Each task needs a concrete title, optional description, priority, dueDate (YYYY-MM-DD when possible), estimatedHours, dayHint (e.g. "Day 1", "Week 2 Tue").
- Group tasks under milestones; milestones under sprints.
- successCriteria = measurable definition of done for the whole project.
- agileSprintNotes = risks, dependencies, retro notes for PM.
- roleBriefs: tailored plain-language summaries for developers, sales, director, projectManager.
- Do not invent client names or budgets not in the source.
- If existing project context is provided, MERGE and extend — do not duplicate identical tasks.

JSON schema:
{
  "suggestedProjectName": "string optional",
  "projectSummary": "string",
  "successCriteria": "string",
  "agileSprintNotes": "string",
  "timeline": [{ "date": "YYYY-MM-DD optional", "title": "string" }],
  "sprints": [{
    "name": "Sprint 1",
    "goal": "string",
    "startDate": "YYYY-MM-DD optional",
    "endDate": "YYYY-MM-DD optional",
    "milestones": [{
      "name": "string",
      "dueDate": "YYYY-MM-DD optional",
      "acceptanceCriteria": "string optional",
      "tasks": [{
        "title": "string",
        "description": "string optional",
        "priority": "low|medium|high|critical",
        "dueDate": "YYYY-MM-DD optional",
        "estimatedHours": number optional,
        "dayHint": "string optional"
      }]
    }]
  }],
  "roleBriefs": {
    "developers": "string — daily execution focus",
    "sales": "string — client comms & scope",
    "director": "string — oversight & approvals",
    "projectManager": "string — sprint cadence & blockers"
  }
}`;

export async function transcribeProjectPlanningAudio(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  return transcribeReportAudio(buffer, mimeType, filename);
}

export async function generateProjectPlanFromBrief(input: {
  brief: string;
  sourceLabel: string;
  existingContext?: {
    projectName?: string;
    projectDetails?: string | null;
    successCriteria?: string | null;
    agileSprintNotes?: string | null;
    existingMilestones?: string[];
    existingTaskTitles?: string[];
  };
  clientRemark?: boolean;
}): Promise<{ plan: ProjectAiPlan; transcript: string }> {
  const brief = input.brief.trim();
  if (!brief) {
    return { plan: emptyProjectAiPlan(), transcript: "" };
  }

  const client = getGroq();
  if (!client) {
    const fallback = emptyProjectAiPlan();
    fallback.projectSummary = brief.slice(0, 2000);
    fallback.successCriteria = "Deliver per client brief (AI unavailable — refine manually).";
    fallback.roleBriefs.developers = brief;
    return { plan: fallback, transcript: brief };
  }

  const ctx = input.existingContext;
  const contextBlock = ctx
    ? `\nExisting project context (merge, do not duplicate tasks):\n` +
      `- Name: ${ctx.projectName ?? "—"}\n` +
      `- Details: ${ctx.projectDetails ?? "—"}\n` +
      `- Success criteria: ${ctx.successCriteria ?? "—"}\n` +
      `- Sprint notes: ${ctx.agileSprintNotes ?? "—"}\n` +
      `- Milestones: ${(ctx.existingMilestones ?? []).join("; ") || "—"}\n` +
      `- Tasks: ${(ctx.existingTaskTitles ?? []).slice(0, 40).join("; ") || "—"}\n`
    : "";

  const userPrompt = input.clientRemark
    ? `Client remark (${input.sourceLabel}). Distribute updates to all roles and add any new milestones/tasks implied:\n\n${brief}${contextBlock}`
    : `Project planning brief (${input.sourceLabel}):\n\n${brief}${contextBlock}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 8192,
      temperature: 0.25,
      response_format: { type: "json_object" }
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty model response");
    const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
    return { plan: normalizePlan(parsed), transcript: brief };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[project-planner] Groq plan failed:", e);
    const fallback = emptyProjectAiPlan();
    fallback.projectSummary = brief.slice(0, 2000);
    fallback.roleBriefs.developers = brief;
    return { plan: fallback, transcript: brief };
  }
}
