import Groq from "groq-sdk";
import { resolveGroqModel } from "./groq-model";

const CHAT_MODEL = resolveGroqModel(
  process.env.GROQ_REMINDER_MODEL,
  process.env.GROQ_DIRECTOR_MODEL
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

const HUMAN_STYLES = [
  "casual and direct, like a teammate checking in",
  "curious and specific about yesterday's progress",
  "focused on blockers and what ships next",
  "brief stand-up tone — one clear question",
  "friendly but accountable — delivery-minded",
  "asking about milestone risk without sounding formal"
] as const;

export async function generatePmDailyCheckIn(input: {
  projectName: string;
  successCriteria?: string | null;
  developerName?: string | null;
  milestoneName?: string | null;
  priorToneIndex?: number;
}): Promise<string | null> {
  const client = getGroq();
  if (!client) return null;

  const style = HUMAN_STYLES[(input.priorToneIndex ?? Math.floor(Math.random() * HUMAN_STYLES.length)) % HUMAN_STYLES.length];
  const dev = input.developerName?.trim() || "there";
  const milestone = input.milestoneName?.trim() ? `Current milestone: ${input.milestoneName}.` : "";
  const success = input.successCriteria?.trim()
    ? `Success criteria: ${input.successCriteria.slice(0, 400)}.`
    : "";

  const system = `You write short daily check-in messages as a project manager on Slack. Sound human — never mention AI.
Style for today: ${style}.
Rules:
- One or two sentences max, optionally a single follow-up question.
- Vary phrasing daily; avoid robotic templates.
- Reference the project naturally.
- Output only the message text.`;

  const user = `Project: ${input.projectName}. Developer first name or label: ${dev}. ${milestone} ${success}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 180,
      temperature: 0.85
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    return raw?.replace(/^["']|["']$/g, "") || null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[pm-ai-checkin] Groq failed:", e);
    return null;
  }
}
