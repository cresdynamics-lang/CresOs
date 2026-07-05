import Groq from "groq-sdk";
import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { resolveGroqModel } from "./groq-model";
import { buildAdminAssistantContextBlock } from "./admin-assistant-context";
import type {
  AdminAssistantMode,
  AdminAssistantResponse,
  PersonInsight,
  ProjectBrief,
  ProposedAction
} from "./admin-assistant-types";

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

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function normalizeActions(raw: unknown): ProposedAction[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set(["schedule_meeting", "create_task", "create_project_task"]);
  const out: ProposedAction[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const kind = asString(o.kind);
    if (!kinds.has(kind)) continue;
    const title = asString(o.title);
    if (!title) continue;
    out.push({
      id: randomUUID(),
      kind: kind as ProposedAction["kind"],
      title,
      scheduledAt: asString(o.scheduledAt ?? o.scheduled_at) || null,
      dueDate: asString(o.dueDate ?? o.due_date) || null,
      assigneeHint: asString(o.assigneeHint ?? o.assignee_hint) || null,
      projectHint: asString(o.projectHint ?? o.project_hint) || null,
      estimatedHours: asNumber(o.estimatedHours ?? o.estimated_hours),
      notes: asString(o.notes) || null
    });
  }
  return out;
}

function normalizeProjectBriefs(raw: unknown): ProjectBrief[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectBrief[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const projectName = asString(o.projectName ?? o.project_name);
    if (!projectName) continue;
    out.push({
      projectId: asString(o.projectId ?? o.project_id) || "",
      projectName,
      status: asString(o.status) || "unknown",
      healthScore: asNumber(o.healthScore ?? o.health_score) ?? 0,
      riskLevel: asString(o.riskLevel ?? o.risk_level) || "unknown",
      summary: asString(o.summary) || ""
    });
  }
  return out;
}

function normalizePersonInsights(raw: unknown): PersonInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: PersonInsight[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const personHint = asString(o.personHint ?? o.person_hint);
    if (!personHint) continue;
    const roles = o.roleHints ?? o.role_hints;
    out.push({
      personHint,
      ...(Array.isArray(roles) ? { roleHints: roles.map((r) => asString(r)).filter(Boolean) } : {}),
      summary: asString(o.summary) || ""
    });
  }
  return out;
}

function fallbackResponse(mode: AdminAssistantMode, message: string): AdminAssistantResponse {
  return {
    mode,
    reply:
      mode === "execute"
        ? `I understood: "${message.slice(0, 200)}". Groq is not configured — set GROQ_API_KEY to preview tasks and meetings. Execution is not available in Phase 1.`
        : `I would analyze org data for: "${message.slice(0, 200)}". Configure GROQ_API_KEY for AI answers. Try syncing the knowledge pool for richer context.`,
    aiGenerated: false
  };
}

export async function runAdminAssistant(
  prisma: PrismaClient,
  orgId: string,
  options: { message: string; mode: AdminAssistantMode; transcript?: string }
): Promise<AdminAssistantResponse> {
  const message = options.message.trim();
  if (!message) {
    return {
      mode: options.mode,
      reply: "Say or type what you need — meetings, tasks, or ask about projects and people.",
      aiGenerated: false
    };
  }

  const contextBlock = await buildAdminAssistantContextBlock(prisma, orgId, message);
  const client = getGroq();
  if (!client) return fallbackResponse(options.mode, message);

  const isExecute = options.mode === "execute";

  const system = isExecute
    ? `You are CresOS Admin Command — parse the admin's request into PREVIEW actions only (nothing is executed yet).
Use org context, knowledge pool, and Cres Dynamics capabilities from cresdynamics.com.
Return JSON only:
{
  "reply": "short confirmation of what you understood",
  "proposedActions": [
    {
      "kind": "schedule_meeting" | "create_task" | "create_project_task",
      "title": "string",
      "scheduledAt": "ISO datetime or null",
      "dueDate": "ISO date or null",
      "assigneeHint": "person name or role",
      "projectHint": "project name if relevant",
      "estimatedHours": number or null,
      "notes": "optional"
    }
  ]
}
Rules:
- schedule_meeting → personal calendar / schedule items with a specific time
- create_task → admin schedule task without project
- create_project_task → delivery task tied to a project
- Parse natural dates (tomorrow, next Monday) to ISO using Africa/Nairobi context when possible
- Split multiple meetings/tasks into separate proposedActions
- Do not invent people or projects not suggested by context`
    : `You are CresOS Admin Intelligence — answer the admin using ONLY org context below.
Return JSON only:
{
  "reply": "detailed markdown-friendly answer",
  "projectBriefs": [{ "projectId", "projectName", "status", "healthScore", "riskLevel", "summary" }],
  "personInsights": [{ "personHint", "roleHints", "summary" }]
}
Cover when asked: project status, who is working on what, days active, hours vs days on tasks/reports, risks, and how needs map to Cres Dynamics services.
If knowledge is thin, say what to sync. No invented facts.`;

  const user = `Admin message:\n${message}\n\n--- ORG CONTEXT ---\n${contextBlock}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: isExecute ? 1200 : 1600,
      temperature: 0.35,
      response_format: { type: "json_object" }
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return fallbackResponse(options.mode, message);

    const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
    const reply = asString(parsed.reply) || "Here is what I found.";
    const base: AdminAssistantResponse = {
      mode: options.mode,
      reply,
      aiGenerated: true,
      ...(options.transcript ? { transcript: options.transcript } : {})
    };

    if (isExecute) {
      base.proposedActions = normalizeActions(parsed.proposedActions ?? parsed.proposed_actions);
    } else {
      base.projectBriefs = normalizeProjectBriefs(parsed.projectBriefs ?? parsed.project_briefs);
      base.personInsights = normalizePersonInsights(parsed.personInsights ?? parsed.person_insights);
    }

    return base;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[admin-assistant] Groq failed:", e);
    return {
      ...fallbackResponse(options.mode, message),
      reply: `AI temporarily unavailable: ${e instanceof Error ? e.message : "unknown error"}. ${fallbackResponse(options.mode, message).reply}`
    };
  }
}
