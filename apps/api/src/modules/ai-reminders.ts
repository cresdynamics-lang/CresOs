/**
 * AI-generated reminder copy for sales (meetings, calls, tasks) using Groq.
 *
 * Env:
 *   GROQ_API_KEY       - Required for AI reminders; if unset, static fallback is used.
 *   GROQ_REMINDER_MODEL - Optional; default "llama-3.1-8b-instant".
 */

import Groq from "groq-sdk";

const GROQ_MODEL = process.env.GROQ_REMINDER_MODEL ?? "llama-3.1-8b-instant";

let groqClient: Groq | null = null;

function getClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key || !key.trim()) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: key });
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

const MEETING_SYSTEM_PROMPT = `You are a sales reminder assistant. Generate a short, professional reminder for a sales person about an upcoming meeting.

Reply with a JSON object only, no other text:
{ "subject": "Short subject line (under 60 chars)", "body": "One or two sentence reminder. Be direct and actionable." }

Rules: subject and body must be plain text, no markdown. Body should mention the lead and timing. Keep tone professional and concise.`;

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

  return generateReminder(MEETING_SYSTEM_PROMPT, userMessage);
}

// ---- Call reminder ----

const CALL_SYSTEM_PROMPT = `You are a sales reminder assistant. Generate a short, professional reminder for a sales person about an upcoming call.

Reply with a JSON object only, no other text:
{ "subject": "Short subject line (under 60 chars)", "body": "One or two sentence reminder. Be direct and actionable. Mention the lead and that they should be ready to call." }

Rules: subject and body must be plain text, no markdown. Keep tone professional and concise.`;

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

  return generateReminder(CALL_SYSTEM_PROMPT, userMessage);
}

// ---- Task due reminder ----

const TASK_SYSTEM_PROMPT = `You are a task reminder assistant. Generate a short, professional reminder for someone about a task deadline.

Reply with a JSON object only, no other text:
{ "subject": "Short subject line (under 60 chars)", "body": "One or two sentence reminder. Be direct and actionable." }

Rules: subject and body must be plain text, no markdown. Mention the task and project. Keep tone professional and concise.`;

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

  return generateReminder(TASK_SYSTEM_PROMPT, userMessage);
}

// ---- Client project update message (for sales to send to client) ----

const CLIENT_MESSAGE_SYSTEM_PROMPT = `You are a professional sales assistant. Given a project's current status and its tasks, write a short, friendly message that a sales person can send to the client to update them on the project.

Rules:
- Write in second person to the client (e.g. "Your project...", "We have completed...").
- Be concise: 2–4 sentences. Mention overall progress and any notable task statuses (done, in progress, blocked).
- If there are blocked tasks, acknowledge briefly without oversharing internal detail.
- Tone: professional, reassuring, client-ready. No internal jargon.
- Output only the message body. Do not add links or "view status" — we will append a link separately when one is provided. Plain text only, no markdown.`;

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
        { role: "system", content: CLIENT_MESSAGE_SYSTEM_PROMPT },
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
