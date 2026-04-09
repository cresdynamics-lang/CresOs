/**
 * AI-generated reminder copy for sales (meetings, calls, tasks) using Groq.
 * Prompts are centralized in src/prompts/groq-prompts.ts.
 *
 * Env:
 *   GROQ_API_KEY       - Required for AI reminders; if unset, static fallback is used.
 *   GROQ_REMINDER_MODEL - Optional; default "llama-3.1-8b-instant".
 */

import Groq from "groq-sdk";
import {
  MEETING_REMINDER_SYSTEM,
  CALL_REMINDER_SYSTEM,
  TASK_REMINDER_SYSTEM,
  CLIENT_PROJECT_UPDATE_SYSTEM,
  CURATE_CLIENT_MESSAGE_SYSTEM,
  buildCurateClientMessageUser,
  USER_REMINDER_EMAIL_SYSTEM,
  buildUserReminderEmailUser
} from "../prompts/groq-prompts";

const GROQ_MODEL = process.env.GROQ_REMINDER_MODEL ?? "llama-3.1-8b-instant";

let groqClient: Groq | null = null;
let groqKey: string | null = null;

function getClient(): Groq | null {
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

export type ReminderCopy = { subject: string; body: string };

async function generateReminder(systemPrompt: string, userMessage: string): Promise<ReminderCopy | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 256,
      temperature: 0.3
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    // Try to parse JSON (model may wrap in markdown code block)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr) as { subject?: string; body?: string };
    if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
      return {
        subject: parsed.subject.slice(0, 200),
        body: parsed.body.slice(0, 1000)
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Meeting reminder ----

export type MeetingReminderContext = {
  leadTitle: string;
  minutesUntil: number;
  name?: string | null;
  business?: string | null;
  reason?: string | null;
  phone?: string | null;
  scheduledAt: Date;
};

export async function generateMeetingReminder(ctx: MeetingReminderContext): Promise<ReminderCopy | null> {
  const timeDesc =
    ctx.minutesUntil === 0
      ? "starting now"
      : ctx.minutesUntil < 60
        ? `in ${ctx.minutesUntil} minutes`
        : ctx.minutesUntil < 1440
          ? `in ${Math.round(ctx.minutesUntil / 60)} hour(s)`
          : `in ${Math.round(ctx.minutesUntil / 1440)} day(s)`;
  const userMessage = [
    `Lead: ${ctx.leadTitle}`,
    `Meeting ${timeDesc}.`,
    ctx.name ? `Contact/name: ${ctx.name}` : "",
    ctx.business ? `Business: ${ctx.business}` : "",
    ctx.reason ? `Reason: ${ctx.reason}` : "",
    ctx.phone ? `Phone: ${ctx.phone}` : "",
    `Scheduled at: ${ctx.scheduledAt.toISOString()}`
  ]
    .filter(Boolean)
    .join("\n");

  return generateReminder(MEETING_REMINDER_SYSTEM, userMessage);
}

// ---- Call reminder ----

export type CallReminderContext = {
  leadTitle: string;
  minutesUntil: number;
  name?: string | null;
  business?: string | null;
  reason?: string | null;
  phone?: string | null;
  scheduledAt: Date;
};

export async function generateCallReminder(ctx: CallReminderContext): Promise<ReminderCopy | null> {
  const timeDesc =
    ctx.minutesUntil === 0
      ? "now"
      : ctx.minutesUntil < 60
        ? `in ${ctx.minutesUntil} minutes`
        : ctx.minutesUntil < 1440
          ? `in ${Math.round(ctx.minutesUntil / 60)} hour(s)`
          : `in ${Math.round(ctx.minutesUntil / 1440)} day(s)`;
  const userMessage = [
    `Lead: ${ctx.leadTitle}`,
    `Call scheduled ${timeDesc}.`,
    ctx.name ? `Contact: ${ctx.name}` : "",
    ctx.business ? `Business: ${ctx.business}` : "",
    ctx.reason ? `Reason: ${ctx.reason}` : "",
    ctx.phone ? `Phone: ${ctx.phone}` : "",
    `Scheduled at: ${ctx.scheduledAt.toISOString()}`
  ]
    .filter(Boolean)
    .join("\n");

  return generateReminder(CALL_REMINDER_SYSTEM, userMessage);
}

// ---- Task due reminder ----

export type TaskReminderContext = {
  taskTitle: string;
  projectName: string;
  dueIn: "1d" | "1h" | "overdue";
  dueDate: Date;
};

export async function generateTaskReminder(ctx: TaskReminderContext): Promise<ReminderCopy | null> {
  const timeDesc =
    ctx.dueIn === "overdue"
      ? "was due and is now overdue"
      : ctx.dueIn === "1d"
        ? "is due in 1 day"
        : "is due in 1 hour";
  const userMessage = [
    `Task: ${ctx.taskTitle}`,
    `Project: ${ctx.projectName}`,
    timeDesc,
    `Due: ${ctx.dueDate.toISOString()}`
  ].join("\n");

  return generateReminder(TASK_REMINDER_SYSTEM, userMessage);
}

// ---- Client project update message (for sales to send to client) ----

export type ClientMessageTask = {
  title: string;
  status: string;
  dueDate?: Date | null;
  blockedReason?: string | null;
};

export type ClientMessageContext = {
  projectName: string;
  projectStatus: string;
  tasks: ClientMessageTask[];
  /** If provided, the message should be accompanied by this link (we append it after the message). */
  link?: string | null;
};

/**
 * Generate a client-facing project update message using Groq. Uses task status and condition.
 * If link is provided, it is appended after the generated message so sales can send both together.
 */
export async function generateClientProjectMessage(ctx: ClientMessageContext): Promise<{
  message: string;
  link?: string | null;
} | null> {
  const client = getClient();
  if (!client) return null;
  const taskLines = ctx.tasks.length
    ? ctx.tasks
        .map(
          (t) =>
            `- ${t.title}: ${t.status}${t.dueDate ? ` (due ${t.dueDate.toISOString().slice(0, 10)})` : ""}${t.blockedReason ? ` [blocked: ${t.blockedReason}]` : ""}`
        )
        .join("\n")
    : "No tasks yet.";
  const userMessage = [
    `Project: ${ctx.projectName}`,
    `Project status: ${ctx.projectStatus}`,
    "Tasks:",
    taskLines,
    ctx.link ? `\nA link will be appended after your message for the client to view status; write only the update text.` : ""
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: CLIENT_PROJECT_UPDATE_SYSTEM },
        { role: "user", content: userMessage }
      ],
      max_tokens: 512,
      temperature: 0.4
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const message = raw.slice(0, 2000);
    return { message, link: ctx.link ?? null };
  } catch {
    return null;
  }
}

// ---- Curate draft message to client ----

/**
 * Improve a draft message to a client using Groq: clearer, more professional, client-ready.
 */
export async function curateClientMessage(draft: string): Promise<string | null> {
  const client = getClient();
  if (!client || !draft?.trim()) return null;
  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: CURATE_CLIENT_MESSAGE_SYSTEM },
        { role: "user", content: buildCurateClientMessageUser(draft) }
      ],
      max_tokens: 512,
      temperature: 0.3
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    return raw.slice(0, 2000);
  } catch {
    return null;
  }
}

// ---- Generic user reminder email ----

export type UserReminderEmailContext = {
  reminderType: string;
  title: string;
  context?: string | null;
  dueOrScheduled?: string | null;
};

/**
 * Generate subject + body for a user-facing reminder email (e.g. task due, meeting soon).
 */
export async function generateUserReminderEmail(ctx: UserReminderEmailContext): Promise<ReminderCopy | null> {
  const userMessage = buildUserReminderEmailUser({
    reminderType: ctx.reminderType,
    title: ctx.title,
    context: ctx.context ?? undefined,
    dueOrScheduled: ctx.dueOrScheduled ?? undefined
  });
  return generateReminder(USER_REMINDER_EMAIL_SYSTEM, userMessage);
}
