import Groq from "groq-sdk";
import { resolveGroqModel } from "./groq-model";

const WHISPER_MODEL =
  process.env.GROQ_WHISPER_MODEL?.trim() || "whisper-large-v3-turbo";
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

/** True when at least one Groq API key is configured (required for Whisper transcription). */
export function isTranscriptionConfigured(): boolean {
  return getGroq() !== null;
}

export async function transcribeReportAudio(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  const client = getGroq();
  if (!client) return null;

  const safeName = filename?.trim() || "recording.webm";
  const type = mimeType?.trim() || "audio/webm";

  try {
    const bytes = new Uint8Array(buffer);
    const file = new File([bytes], safeName, { type });
    const transcription = await client.audio.transcriptions.create({
      file,
      model: WHISPER_MODEL,
      response_format: "text",
      temperature: 0
    });
    const text =
      typeof transcription === "string"
        ? transcription
        : (transcription as { text?: string }).text;
    return text?.trim() || null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[voice-report] Whisper transcription failed:", e);
    return null;
  }
}

export async function polishReportSection(input: {
  sectionKey: string;
  sectionLabel: string;
  transcript: string;
  existingText?: string;
}): Promise<string> {
  const transcript = input.transcript.trim();
  if (!transcript) return input.existingText?.trim() || "";

  const client = getGroq();
  if (!client) return mergeSectionText(input.existingText, transcript);

  const existing = input.existingText?.trim();
  const system = `You help developers file daily status reports. Convert spoken notes into clear, concise prose for the "${input.sectionLabel}" section only.
- Keep facts and specifics; remove filler words and false starts.
- Use short sentences or bullet-style lines when it reads better.
- Do not invent details not in the transcript.
- Output only the section text with no headings, quotes, or commentary.`;

  const user = existing
    ? `Existing text for this section:\n${existing}\n\nNew spoken notes to merge:\n${transcript}`
    : `Spoken notes:\n${transcript}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 1024,
      temperature: 0.2
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return mergeSectionText(input.existingText, transcript);
    return raw.replace(/^["']|["']$/g, "").trim() || mergeSectionText(input.existingText, transcript);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[voice-report] section polish failed:", e);
    return mergeSectionText(input.existingText, transcript);
  }
}

function mergeSectionText(existing: string | undefined, addition: string): string {
  const prev = existing?.trim();
  const next = addition.trim();
  if (!prev) return next;
  if (!next) return prev;
  return `${prev}\n${next}`;
}
