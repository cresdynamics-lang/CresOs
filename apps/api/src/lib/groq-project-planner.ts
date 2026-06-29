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

function normalizeSprints(parsed: Record<string, unknown>): ProjectAiPlanSprint[] {
  const sprintsRaw = Array.isArray(parsed.sprints) ? parsed.sprints : [];
  return sprintsRaw.map((s, si) => {
    const sprint = s as Record<string, unknown>;
    const milestonesRaw = Array.isArray(sprint.milestones) ? sprint.milestones : [];
    const milestones = milestonesRaw.map((m, mi) => {
      const mile = m as Record<string, unknown>;
      const tasksRaw = Array.isArray(mile.tasks) ? mile.tasks : [];
      const tasks = tasksRaw.map((t, ti) => {
        const task = t as Record<string, unknown>;
        const hours = task.estimatedHours ?? task.estimated_hours;
        return {
          title: asString(task.title) || `Task ${mi + 1}.${ti + 1}`,
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
}

export function normalizePlan(parsed: Record<string, unknown>): ProjectAiPlan {
  const base = emptyProjectAiPlan();
  base.projectSummary = asString(parsed.projectSummary) || asString(parsed.summary);
  base.projectDetails =
    asString(parsed.projectDetails) ||
    asString(parsed.project_details) ||
    base.projectSummary;
  base.documentUnderstanding =
    asString(parsed.documentUnderstanding) || asString(parsed.document_understanding) || undefined;
  base.projectType = asString(parsed.projectType) || asString(parsed.project_type) || undefined;
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

  base.sprints = normalizeSprints(parsed);
  return base;
}

const DOMAIN_PLAYBOOKS = `
Domain playbooks — infer projectType and enumerate concrete deliverables in projectDetails, then mirror them in tasks:

WEBSITE / marketing site (projectType: website):
- List every page/section from the brief (Home, About, Services, Portfolio, Blog, Contact, FAQ, etc.).
- Per page: layout, content blocks, forms, SEO, responsive behavior.
- Shared: header/nav, footer, CMS or static content, analytics, hosting/deploy.

ECOMMERCE (projectType: ecommerce):
- Storefront: home, category listing, product detail, search/filter.
- Cart & checkout: add to cart, quantity, coupons, shipping, payment gateway.
- Customer: register/login, order history, addresses.
- Admin: dashboard, product CRUD, categories/tags, inventory, orders, customers, promotions.
- Backend: product catalog API, stock sync, payment webhooks, email notifications.

MOBILE APP (projectType: mobile_app):
- Screens/flows from brief; auth; offline; push; app store release.

SAAS / web app (projectType: saas):
- Modules, roles/permissions, billing, onboarding, settings, integrations.

API / backend (projectType: api_backend):
- Endpoints, auth, data models, webhooks, docs, monitoring.
`.trim();

const PLAN_SYSTEM = `You are a senior delivery analyst and agile planner for Cres Dynamics (software agency).

WORKFLOW (follow in order):
1) UNDERSTAND the source — what kind of document/brief is this? Who is it for? What is being built?
2) DRAFT projectDetails — a rich, structured brief developers and PM can execute from. This is the PRIMARY output.
3) From projectDetails, derive agile sprints, milestones, and MANY granular developer tasks.

${DOMAIN_PLAYBOOKS}

Rules:
- Output ONLY valid JSON — no markdown outside JSON.
- projectDetails MUST use clear section headings with ## (markdown inside the string), e.g.:
  ## What this project is
  ## Business context
  ## Scope & modules
  ## Pages / features (enumerate ALL mentioned or logically required)
  ## User roles
  ## Integrations & data
  ## Technical notes
  ## Success metrics
  ## Out of scope
  ## Assumptions
- For websites: list every page. For ecommerce: list storefront + admin + cart/checkout flows explicitly.
- projectSummary = 1–3 sentence executive summary only.
- documentUnderstanding = 2–4 sentences on what the source material is about.
- projectType = one of: website, ecommerce, mobile_app, saas, api_backend, custom
- Prefer 25–80 developer tasks for real projects; each task = one concrete unit of work a dev can complete in a day or less.
- Task titles must be specific (e.g. "Build product category listing page", not "Do frontend").
- Group tasks under milestones; milestones under 1–3 week sprints.
- Each task: title, description (acceptance hints), priority, dueDate (YYYY-MM-DD when possible), estimatedHours, dayHint.
- successCriteria = measurable definition of done.
- agileSprintNotes = risks, dependencies, cadence for PM.
- roleBriefs: plain language for developers (daily sync focus), sales, director, projectManager.
- Do not invent budgets or client names not in the source.
- If existing project context is provided, MERGE and extend — do not duplicate identical tasks.

JSON schema:
{
  "suggestedProjectName": "string optional",
  "documentUnderstanding": "string",
  "projectType": "website|ecommerce|mobile_app|saas|api_backend|custom",
  "projectSummary": "string short",
  "projectDetails": "string long structured markdown sections",
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
    "developers": "string",
    "sales": "string",
    "director": "string",
    "projectManager": "string"
  }
}`;

const DELIVERY_FROM_DETAILS_SYSTEM = `You are an agile delivery planner for Cres Dynamics.
The user has approved projectDetails (scope brief). Generate ONLY the delivery breakdown: sprints, milestones, tasks, timeline, successCriteria, agileSprintNotes, roleBriefs.

${DOMAIN_PLAYBOOKS}

Rules:
- Output ONLY valid JSON.
- Every page, module, and feature listed in projectDetails must appear as at least one task (often several).
- Ecommerce: separate tasks for admin, catalog, cart, checkout, payments, categories.
- Website: one or more tasks per page/section.
- 25–80 granular developer tasks; specific titles; day-level scheduling hints.
- Do not repeat projectDetails in the output — only sprints/milestones/tasks and supporting fields.
- Merge with existing context if provided — no duplicate task titles.

JSON schema:
{
  "successCriteria": "string optional — refine if needed",
  "agileSprintNotes": "string optional",
  "timeline": [{ "date": "YYYY-MM-DD optional", "title": "string" }],
  "sprints": [{ "name", "goal", "startDate", "endDate", "milestones": [{ "name", "dueDate", "acceptanceCriteria", "tasks": [...] }] }],
  "roleBriefs": { "developers", "sales", "director", "projectManager" }
}`;

function buildContextBlock(ctx?: {
  projectName?: string;
  projectDetails?: string | null;
  successCriteria?: string | null;
  agileSprintNotes?: string | null;
  existingMilestones?: string[];
  existingTaskTitles?: string[];
}): string {
  if (!ctx) return "";
  return (
    `\nExisting project context (merge, do not duplicate tasks):\n` +
    `- Name: ${ctx.projectName ?? "—"}\n` +
    `- Details: ${ctx.projectDetails ?? "—"}\n` +
    `- Success criteria: ${ctx.successCriteria ?? "—"}\n` +
    `- Sprint notes: ${ctx.agileSprintNotes ?? "—"}\n` +
    `- Milestones: ${(ctx.existingMilestones ?? []).join("; ") || "—"}\n` +
    `- Tasks: ${(ctx.existingTaskTitles ?? []).slice(0, 40).join("; ") || "—"}\n`
  );
}

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
  isDocument?: boolean;
}): Promise<{ plan: ProjectAiPlan; transcript: string }> {
  const brief = input.brief.trim();
  if (!brief) {
    return { plan: emptyProjectAiPlan(), transcript: "" };
  }

  const client = getGroq();
  if (!client) {
    const fallback = emptyProjectAiPlan();
    fallback.projectDetails = brief.slice(0, 8000);
    fallback.projectSummary = brief.slice(0, 400);
    fallback.successCriteria = "Deliver per client brief (AI unavailable — refine manually).";
    fallback.roleBriefs.developers = brief.slice(0, 2000);
    return { plan: fallback, transcript: brief };
  }

  const contextBlock = buildContextBlock(input.existingContext);
  const docHint = input.isDocument
    ? "\nThe source is an uploaded document. First infer documentUnderstanding and projectType, then build projectDetails from the full text.\n"
    : "";

  const userPrompt = input.clientRemark
    ? `Client remark (${input.sourceLabel}). Update understanding, projectDetails sections, and add milestones/tasks for anything new:\n\n${brief}${contextBlock}`
    : `Project planning brief (${input.sourceLabel}).${docHint}\n\n${brief}${contextBlock}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 8192,
      temperature: 0.2,
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
    fallback.projectDetails = brief.slice(0, 8000);
    fallback.projectSummary = brief.slice(0, 400);
    fallback.roleBriefs.developers = brief.slice(0, 2000);
    return { plan: fallback, transcript: brief };
  }
}

/** Regenerate sprints/milestones/tasks from an edited projectDetails draft. */
export async function generateDeliveryPlanFromDetails(input: {
  projectDetails: string;
  projectType?: string;
  successCriteria?: string;
  existingContext?: {
    projectName?: string;
    projectDetails?: string | null;
    successCriteria?: string | null;
    agileSprintNotes?: string | null;
    existingMilestones?: string[];
    existingTaskTitles?: string[];
  };
}): Promise<Pick<ProjectAiPlan, "sprints" | "timeline" | "successCriteria" | "agileSprintNotes" | "roleBriefs">> {
  const details = input.projectDetails.trim();
  if (!details) {
    return { sprints: [], timeline: [], successCriteria: "", agileSprintNotes: "", roleBriefs: emptyProjectAiPlan().roleBriefs };
  }

  const client = getGroq();
  if (!client) {
    return { sprints: [], timeline: [], successCriteria: input.successCriteria ?? "", agileSprintNotes: "", roleBriefs: emptyProjectAiPlan().roleBriefs };
  }

  const contextBlock = buildContextBlock(input.existingContext);
  const typeLine = input.projectType ? `\nprojectType: ${input.projectType}\n` : "";

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: DELIVERY_FROM_DETAILS_SYSTEM },
        {
          role: "user",
          content:
            `Approved projectDetails (generate milestones and developer tasks from this):${typeLine}\n\n${details}` +
            (input.successCriteria ? `\n\nKnown success criteria: ${input.successCriteria}` : "") +
            contextBlock
        }
      ],
      max_tokens: 8192,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty model response");
    const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
    const normalized = normalizePlan({ ...parsed, projectDetails: details, projectSummary: "" });
    return {
      sprints: normalized.sprints,
      timeline: normalized.timeline,
      successCriteria: normalized.successCriteria || input.successCriteria || "",
      agileSprintNotes: normalized.agileSprintNotes,
      roleBriefs: normalized.roleBriefs
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[project-planner] delivery from details failed:", e);
    return { sprints: [], timeline: [], successCriteria: input.successCriteria ?? "", agileSprintNotes: "", roleBriefs: emptyProjectAiPlan().roleBriefs };
  }
}
