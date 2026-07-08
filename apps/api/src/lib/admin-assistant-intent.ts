import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { groqChatWithFallback } from "./groq-chat-fallback";
import { listGroqApiKeys } from "./groq-model";
import { buildAdminAssistantContextBlock } from "./admin-assistant-context";
import {
  detectIntelligenceFocus,
  intelligenceSystemAddon,
  parseIntelligenceFocus,
  type IntelligenceFocus
} from "./admin-assistant-focus";
import { buildIntelligenceFocusBlock } from "./admin-assistant-intelligence-context";
import type {
  AdminAssistantMode,
  AdminAssistantResponse,
  HoursInsight,
  PersonInsight,
  ProjectBrief,
  ProposedAction
} from "./admin-assistant-types";

function hasGroqKeys(): boolean {
  return listGroqApiKeys().length > 0;
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
      userId: asString(o.userId ?? o.user_id) || undefined,
      ...(Array.isArray(roles) ? { roleHints: roles.map((r) => asString(r)).filter(Boolean) } : {}),
      summary: asString(o.summary) || "",
      reportDaysLast30: asNumber(o.reportDaysLast30 ?? o.report_days_last_30) ?? undefined,
      estimatedHours: asNumber(o.estimatedHours ?? o.estimated_hours) ?? undefined,
      actualHours: asNumber(o.actualHours ?? o.actual_hours) ?? undefined
    });
  }
  return out;
}

function normalizeHoursInsights(raw: unknown): HoursInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: HoursInsight[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const subject = asString(o.subject ?? o.personHint ?? o.person_hint);
    if (!subject) continue;
    out.push({
      subject,
      daysMentioned: asNumber(o.daysMentioned ?? o.days_mentioned) ?? undefined,
      estimatedHours: asNumber(o.estimatedHours ?? o.estimated_hours) ?? undefined,
      actualHours: asNumber(o.actualHours ?? o.actual_hours) ?? undefined,
      summary: asString(o.summary) || ""
    });
  }
  return out;
}

function fallbackResponse(
  mode: AdminAssistantMode,
  message: string,
  poolEmpty?: boolean
): AdminAssistantResponse {
  const poolHint = poolEmpty
    ? " Knowledge pool is empty — sync PM → Knowledge pool for richer context."
    : "";
  const isExecute = mode === "execute";
  return {
    mode,
    reply:
      isExecute
        ? `I understood: "${message.slice(0, 200)}". Groq is not configured — set GROQ_API_KEY to preview tasks and meetings.${poolHint}`
        : `I would analyze org data for: "${message.slice(0, 200)}". Configure GROQ_API_KEY for AI answers.${poolHint}`,
    aiGenerated: false,
    ...(isExecute
      ? { proposedActions: [] as ProposedAction[] }
      : {
          projectBriefs: [] as ProjectBrief[],
          personInsights: [] as PersonInsight[],
          hoursInsights: [] as HoursInsight[]
        })
  };
}

function enrichResponse(
  response: AdminAssistantResponse,
  options: {
    mode: AdminAssistantMode;
    focus?: IntelligenceFocus;
    transcript?: string;
  }
): AdminAssistantResponse {
  return {
    ...response,
    ...(options.mode !== "execute" && options.focus ? { focus: options.focus } : {}),
    ...(options.transcript ? { transcript: options.transcript } : {})
  };
}

export async function runAdminAssistant(
  prisma: PrismaClient,
  orgId: string,
  options: {
    message: string;
    mode: AdminAssistantMode;
    transcript?: string;
    focus?: IntelligenceFocus;
  }
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
  const poolEmpty = contextBlock.includes("KNOWLEDGE POOL (0 indexed items)");
  const isExecute = options.mode === "execute";
  const focus = !isExecute
    ? detectIntelligenceFocus(message, parseIntelligenceFocus(options.focus))
    : undefined;
  const enrichOpts = { mode: options.mode, focus, transcript: options.transcript };

  if (!hasGroqKeys()) return enrichResponse(fallbackResponse(options.mode, message, poolEmpty), enrichOpts);

  const focusBlock =
    focus && focus !== "general"
      ? await buildIntelligenceFocusBlock(prisma, orgId, focus, message)
      : "";

  const system = isExecute
    ? `You are CresOS Admin Command — parse the admin's request into actions to schedule meetings, tasks, or project tasks.
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
${focus ? intelligenceSystemAddon(focus) : ""}
Return JSON only:
{
  "reply": "detailed markdown-friendly answer",
  "projectBriefs": [{ "projectId", "projectName", "status", "healthScore", "riskLevel", "summary" }],
  "personInsights": [{ "personHint", "userId", "roleHints", "summary", "reportDaysLast30", "estimatedHours", "actualHours" }],
  "hoursInsights": [{ "subject", "daysMentioned", "estimatedHours", "actualHours", "summary" }]
}
Cover when asked: project status, who is working on what, days active, hours vs days on tasks/reports, risks, and how needs map to Cres Dynamics services.
If knowledge is thin, suggest syncing the knowledge pool at PM → Knowledge pool. No invented facts.`;

  const user = `Admin message:\n${message}\n\n--- ORG CONTEXT ---\n${contextBlock}${focusBlock ? `\n\n--- FOCUS DATA ---\n${focusBlock}` : ""}`;

  try {
    const { raw } = await groqChatWithFallback({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: isExecute ? 1200 : 1600,
      temperature: 0.35,
      response_format: { type: "json_object" }
    });
    if (!raw) return enrichResponse(fallbackResponse(options.mode, message, poolEmpty), enrichOpts);

    const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
    const reply = asString(parsed.reply) || "Here is what I found.";
    const base: AdminAssistantResponse = {
      mode: options.mode,
      reply,
      aiGenerated: true,
      ...(focus ? { focus } : {}),
      ...(options.transcript ? { transcript: options.transcript } : {})
    };

    if (isExecute) {
      base.proposedActions = normalizeActions(parsed.proposedActions ?? parsed.proposed_actions);
    } else {
      base.projectBriefs = normalizeProjectBriefs(parsed.projectBriefs ?? parsed.project_briefs);
      base.personInsights = normalizePersonInsights(parsed.personInsights ?? parsed.person_insights);
      base.hoursInsights = normalizeHoursInsights(parsed.hoursInsights ?? parsed.hours_insights);
    }

    return base;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[admin-assistant] Groq failed:", e);
    const fallback = fallbackResponse(options.mode, message, poolEmpty);
    return enrichResponse(
      {
        ...fallback,
        reply: `AI temporarily unavailable: ${e instanceof Error ? e.message : "unknown error"}. ${fallback.reply}`
      },
      enrichOpts
    );
  }
}
