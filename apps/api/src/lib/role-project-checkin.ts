import Groq from "groq-sdk";
import { resolveGroqModel } from "./groq-model";

const CHAT_MODEL = resolveGroqModel(
  process.env.GROQ_REMINDER_MODEL,
  process.env.GROQ_DIRECTOR_MODEL
);

export type SenderRole = "project_manager" | "director_admin";

export type CheckInQuestion = {
  id: string;
  text: string;
  placeholder?: string;
};

export type RoleCheckInPayload = {
  intro: string;
  questions: CheckInQuestion[];
  aiGenerated: boolean;
};

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

const PM_FOCUS = `You are a project manager doing a daily agile delivery check-in.
Focus ONLY on: milestones, tasks, blockers, sprint progress, success criteria, handover readiness.
Do NOT ask about company strategy, sales, or finances. Sound like a teammate on Slack — never mention AI.`;

const DIRECTOR_FOCUS = `You are the company director checking in on project delivery.
Focus on: strategic impact of delays, cross-team dependencies, quality and client readiness, accountability, risk escalation.
Do NOT micromanage individual task lists or repeat stand-up trivia — that is the PM's job.
Sound personal and leadership-minded — never mention AI.`;

function roleSystem(role: SenderRole): string {
  const base = role === "project_manager" ? PM_FOCUS : DIRECTOR_FOCUS;
  return `${base}

Output valid JSON only (no markdown):
{
  "intro": "1-2 sentence warm opener referencing the project",
  "questions": [
    { "id": "q1", "text": "specific question ending with ?", "placeholder": "short hint for answer field" }
  ]
}

Rules:
- Exactly 2 or 3 questions (3 if milestones/tasks are overdue).
- Each question must be different in topic from the others.
- Do NOT repeat or closely paraphrase any question listed under "Already asked recently".
- Questions must reference project name, milestone, or success criteria when provided.
- Each question text must end with ?`;
}

function fallbackPayload(role: SenderRole, projectName: string, devName: string): RoleCheckInPayload {
  if (role === "director_admin") {
    return {
      intro: `${devName}, quick leadership check-in on ${projectName}.`,
      questions: [
        {
          id: "q1",
          text: `What is the single biggest delivery risk on ${projectName} right now?`,
          placeholder: "Risk and impact…"
        },
        {
          id: "q2",
          text: "What do you need from leadership to keep the client promise on track?",
          placeholder: "Support or decision needed…"
        }
      ],
      aiGenerated: false
    };
  }
  return {
    intro: `Hey ${devName} — daily pulse on ${projectName}.`,
    questions: [
      {
        id: "q1",
        text: "What did you ship since yesterday on this project?",
        placeholder: "Concrete deliverable or PR…"
      },
      {
        id: "q2",
        text: "What is blocking you today on milestones or tasks?",
        placeholder: "Blocker or none…"
      }
    ],
    aiGenerated: false
  };
}

function normalizeQuestions(raw: unknown): CheckInQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CheckInQuestion[] = [];
  let i = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const text = String((item as { text?: string }).text ?? "").trim();
    if (!text || !text.includes("?")) continue;
    const id = String((item as { id?: string }).id ?? `q${++i}`);
    const placeholder = String((item as { placeholder?: string }).placeholder ?? "").trim() || undefined;
    out.push({ id, text, placeholder });
    if (out.length >= 3) break;
  }
  return out;
}

export function formatCheckInDisplayText(intro: string, questions: CheckInQuestion[]): string {
  const lines = [intro.trim(), ""];
  questions.forEach((q, idx) => {
    lines.push(`${idx + 1}. ${q.text}`);
  });
  return lines.join("\n").trim();
}

export function formatAnswersAsResponse(
  questions: CheckInQuestion[],
  answers: Record<string, string>
): string {
  return questions
    .map((q, idx) => {
      const a = (answers[q.id] ?? "").trim();
      return `Q${idx + 1}: ${q.text}\nA: ${a || "—"}`;
    })
    .join("\n\n");
}

export async function generateRoleProjectCheckIn(input: {
  senderRole: SenderRole;
  projectName: string;
  successCriteria?: string | null;
  developerName?: string | null;
  milestoneName?: string | null;
  overdueMilestones?: number;
  openTasks?: number;
  priorQuestions?: string[];
}): Promise<RoleCheckInPayload> {
  const client = getGroq();
  const dev = input.developerName?.trim() || "there";
  const fallback = fallbackPayload(input.senderRole, input.projectName, dev);

  if (!client) return fallback;

  const prior = (input.priorQuestions ?? [])
    .slice(0, 25)
    .map((q) => `- ${q}`)
    .join("\n");

  const user = `Role: ${input.senderRole === "project_manager" ? "Project Manager" : "Director"}.
Project: ${input.projectName}.
Developer: ${dev}.
${input.milestoneName ? `Active milestone: ${input.milestoneName}.` : ""}
${input.successCriteria?.trim() ? `Success criteria: ${input.successCriteria.slice(0, 400)}.` : ""}
Overdue milestones: ${input.overdueMilestones ?? 0}. Open tasks: ${input.openTasks ?? 0}.

Already asked recently (do NOT repeat):
${prior || "(none)"}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: roleSystem(input.senderRole) },
        { role: "user", content: user }
      ],
      max_tokens: 520,
      temperature: 0.82,
      response_format: { type: "json_object" }
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { intro?: string; questions?: unknown };
    const intro = String(parsed.intro ?? fallback.intro).trim();
    let questions = normalizeQuestions(parsed.questions);
    if (questions.length < 2) {
      questions = fallback.questions;
    }
    return { intro, questions, aiGenerated: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[role-project-checkin] Groq failed:", e);
    return fallback;
  }
}

export function resolveSenderRole(roleKeys: string[]): SenderRole {
  if (roleKeys.includes("project_manager")) return "project_manager";
  if (roleKeys.includes("director_admin") || roleKeys.includes("director")) return "director_admin";
  return "project_manager";
}

export function extractPriorQuestionsFromRows(
  rows: { questionsJson?: unknown; message?: string }[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const json = row.questionsJson;
    if (Array.isArray(json)) {
      for (const q of json) {
        const text = typeof q === "object" && q && "text" in q ? String((q as { text: string }).text) : "";
        const key = text.toLowerCase().trim();
        if (text && !seen.has(key)) {
          seen.add(key);
          out.push(text);
        }
      }
    } else if (row.message) {
      const matches = row.message.match(/[^.!?\n]+(?:\?+)/g) ?? [];
      for (const m of matches) {
        const key = m.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(m.trim());
        }
      }
    }
  }
  return out;
}
