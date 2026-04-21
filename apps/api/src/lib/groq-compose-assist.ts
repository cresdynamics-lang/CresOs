import Groq from "groq-sdk";

const GROQ_MODEL =
  process.env.GROQ_REMINDER_MODEL?.trim() ||
  process.env.GROQ_DIRECTOR_MODEL?.trim() ||
  "llama-3.1-8b-instant";

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

export async function composeAssistText(input: {
  action: "proofread" | "translate";
  text: string;
  targetLanguage?: string;
}): Promise<string | null> {
  const trimmed = input.text.trim();
  if (!trimmed || trimmed.length > 4000) return null;

  const client = getGroq();
  if (!client) return null;

  let system: string;
  if (input.action === "proofread") {
    system =
      "You are a writing assistant. Fix grammar, spelling, and light punctuation only. Keep the same meaning, tone, and language. Do not add greetings or explanations. Output only the corrected message text, with no surrounding quotes.";
  } else {
    const lang = (input.targetLanguage || "").trim();
    if (!lang) return null;
    system = `Translate the user's message to ${lang}. Preserve intent and tone. Output only the translated text, with no surrounding quotes or notes.`;
  }

  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: trimmed }
      ],
      max_tokens: Math.min(2048, trimmed.length + 512),
      temperature: 0.2
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    return raw.replace(/^["']|["']$/g, "").trim() || null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[compose-assist] Groq failed:", e);
    return null;
  }
}
