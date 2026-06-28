import Groq from "groq-sdk";
import { resolveGroqModel } from "./groq-model";
import type { PmIntelligencePayload, PmProjectHealth } from "./pm-delivery-intelligence";

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

function fallbackBrief(intel: Omit<PmIntelligencePayload, "generatedAt"> & { generatedAt: string }): string {
  const { orgSummary, priorities } = intel;
  if (priorities.length === 0) {
    return `Delivery looks steady — average health ${orgSummary.averageHealth}/100 across active work. Keep daily check-ins and milestone dates current.`;
  }
  const top = priorities[0];
  return `Focus today: **${top.projectName}** (health ${top.healthScore}/100). ${top.signals[0]?.message ?? "Review milestones and tasks."} ${top.recommendedActions[0] ?? ""}`.trim();
}

export async function generatePmDeliveryBrief(
  intel: Omit<PmIntelligencePayload, "generatedAt"> & { generatedAt: string },
  pmName?: string | null
): Promise<{ brief: string; aiGenerated: boolean }> {
  const client = getGroq();
  if (!client) {
    return { brief: fallbackBrief(intel), aiGenerated: false };
  }

  const lines = intel.priorities.slice(0, 5).map((p: PmProjectHealth) => {
    const sig = p.signals.map((s) => s.message).join("; ");
    return `- ${p.projectName}: health ${p.healthScore}, risk ${p.riskLevel}. ${sig}`;
  });

  const system = `You are a senior agile project manager writing a morning delivery brief for one PM.
Tone: crisp, actionable, human. No financial data. No client names unless in project title.
Format: 2-4 short paragraphs or bullets. Lead with what needs attention today, then one encouraging line if something is healthy.
Never mention AI. Use agile language (sprint, milestone, unblock, scope).`;

  const user = `PM: ${pmName?.trim() || "Pat"}.
Org average health: ${intel.orgSummary.averageHealth}/100.
At-risk projects: ${intel.orgSummary.atRiskCount}. Overdue milestones: ${intel.orgSummary.overdueMilestones}.
Priority projects:
${lines.join("\n") || "No urgent items."}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 420,
      temperature: 0.7
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return { brief: fallbackBrief(intel), aiGenerated: false };
    return { brief: raw, aiGenerated: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[pm-ai-brief] Groq failed:", e);
    return { brief: fallbackBrief(intel), aiGenerated: false };
  }
}

export async function generatePmSprintSuggestion(input: {
  projectName: string;
  successCriteria?: string | null;
  agileSprintNotes?: string | null;
  overdueMilestoneNames: string[];
  blockedTaskCount: number;
  healthScore: number;
}): Promise<string | null> {
  const client = getGroq();
  if (!client) return null;

  const system = `You advise project managers on agile recovery when delivery slips.
Output: 3-5 bullet points. Concrete actions only (re-scope, split milestone, daily sync, definition of done).
No money, no blame. Short lines.`;

  const user = `Project: ${input.projectName}.
Health score: ${input.healthScore}/100.
Success criteria: ${input.successCriteria?.slice(0, 300) || "not set"}.
Sprint notes: ${input.agileSprintNotes?.slice(0, 300) || "none"}.
Overdue milestones: ${input.overdueMilestoneNames.join(", ") || "none"}.
Blocked tasks: ${input.blockedTaskCount}.`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 320,
      temperature: 0.65
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
