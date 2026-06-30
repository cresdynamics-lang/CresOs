import Groq from "groq-sdk";
import type { PrismaClient } from "@prisma/client";
import { resolveGroqModel } from "./groq-model";
import { buildKnowledgeContextBlock, getKnowledgePoolStats } from "./knowledge-context";
import type { PmIntelligencePayload } from "./pm-delivery-intelligence";

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

function fallbackInsights(stats: { total: number; recent30Days: number }, intel?: PmIntelligencePayload): string {
  const risk = intel?.orgSummary?.atRiskCount ?? 0;
  return (
    `CresOS knowledge pool holds ${stats.total} indexed items (${stats.recent30Days} in the last 30 days). ` +
    `${risk} project${risk === 1 ? "" : "s"} need attention. ` +
    `Review recent conversations, check-ins, and developer reports in the knowledge feed to see how work is actually getting done.`
  );
}

export async function generateKnowledgeInsights(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    projectId?: string;
    intel?: PmIntelligencePayload;
    audience?: "pm" | "director" | "sales";
  }
): Promise<{ insights: string; aiGenerated: boolean; stats: Awaited<ReturnType<typeof getKnowledgePoolStats>> }> {
  const stats = await getKnowledgePoolStats(prisma, orgId);
  const knowledgeBlock = await buildKnowledgeContextBlock(prisma, orgId, {
    projectId: options?.projectId,
    sinceDays: 21,
    limit: 30
  });

  const client = getGroq();
  if (!client || stats.total === 0) {
    return {
      insights: fallbackInsights(stats, options?.intel),
      aiGenerated: false,
      stats
    };
  }

  const intel = options?.intel;
  const audience = options?.audience ?? "pm";

  const system = `You are CresOS delivery intelligence — you analyze the org knowledge pool (actions, chats, reports, plans) and explain HOW work gets done.
Audience: ${audience}.
Write 3-5 short paragraphs or bullets:
1) Patterns in how teams communicate and unblock work
2) What changed recently (from conversations + actions)
3) Concrete recommendations for project management (cadence, risks, who to follow up with)
4) How delivery connects to milestones/tasks in flight
No financial data. No invented facts. If knowledge is thin, say what to sync or ask the team.`;

  const user = `Knowledge pool stats: ${JSON.stringify(stats)}
${intel ? `PM health snapshot: avg ${intel.orgSummary.averageHealth}/100, at-risk ${intel.orgSummary.atRiskCount}, overdue milestones ${intel.orgSummary.overdueMilestones}` : ""}

Recent knowledge entries:
${knowledgeBlock}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 700,
      temperature: 0.45
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return { insights: fallbackInsights(stats, intel), aiGenerated: false, stats };
    }
    return { insights: raw, aiGenerated: true, stats };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[knowledge-ai] Groq failed:", e);
    return { insights: fallbackInsights(stats, intel), aiGenerated: false, stats };
  }
}
