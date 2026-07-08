const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/** Default chain when primary model hits TPD/RPM limits — each model has separate quotas. */
export const DEFAULT_GROQ_MODEL_FALLBACK_CHAIN = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile"
] as const;

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

function isValidGroqModelId(raw: string | undefined): raw is string {
  const v = raw?.trim();
  if (!v) return false;
  if (v.toLowerCase().startsWith("gsk_")) return false;
  if (v.length > 80) return false;
  return true;
}

/** Ordered unique models — try each when the prior hits rate/TPD limits. */
export function resolveGroqModelChain(...primaryCandidates: Array<string | undefined>): string[] {
  const fromEnv =
    process.env.GROQ_ASSISTANT_MODEL_FALLBACK?.split(",")
      .map((s) => s.trim())
      .filter(isValidGroqModelId) ?? [];

  const candidates = [
    ...primaryCandidates,
    ...fromEnv,
    process.env.GROQ_REMINDER_MODEL,
    process.env.GROQ_EMAIL_MODEL,
    ...DEFAULT_GROQ_MODEL_FALLBACK_CHAIN
  ];

  const chain: string[] = [];
  for (const raw of candidates) {
    const v = raw?.trim();
    if (!isValidGroqModelId(v)) continue;
    if (!chain.includes(v)) chain.push(v);
  }
  return chain.length ? chain : [DEFAULT_GROQ_MODEL];
}

export function listGroqApiKeys(): string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
    process.env.GROQ_API_KEY_TERTIARY
  ]
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim());
}
