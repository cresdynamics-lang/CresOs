const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/** Groq model IDs never start with "gsk_" — reject API keys mis-set as model env vars. */
export function resolveGroqModel(...candidates: Array<string | undefined>): string {
  for (const raw of candidates) {
    const v = raw?.trim();
    if (!v) continue;
    if (v.toLowerCase().startsWith("gsk_")) continue;
    if (v.length > 80) continue;
    return v;
  }
  return DEFAULT_GROQ_MODEL;
}
