import Groq from "groq-sdk";
import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";
import { resolveGroqModel } from "./groq-model";
import {
  fetchKnowledgeChunks,
  fetchKnowledgeChunksForUsers,
  type KnowledgeChunkRow
} from "./knowledge-context";
import {
  findOrgUsersForKnowledgeSearch,
  formatTeamUsersBlock,
  parseRoleFromQuery,
  type KnowledgeTeamUser
} from "./knowledge-team-index";

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

function dedupeChunks(chunks: KnowledgeChunkRow[]): KnowledgeChunkRow[] {
  const seen = new Set<string>();
  const out: KnowledgeChunkRow[] = [];
  for (const c of chunks) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

function formatChunksBlock(chunks: KnowledgeChunkRow[], actorMap: Map<string, string>): string {
  if (chunks.length === 0) return "No matching indexed entries.";
  return chunks
    .slice(0, 40)
    .map((c) => {
      const when = c.occurredAt.toISOString().slice(0, 16).replace("T", " ");
      const who = c.actorId ? actorMap.get(c.actorId) ?? "someone" : "system";
      const label = c.title?.trim() || c.kind;
      const body = c.content.length > 350 ? `${c.content.slice(0, 350)}…` : c.content;
      return `[${when}] (${c.kind}/${c.sourceType}) ${who} — ${label}: ${body}`;
    })
    .join("\n");
}

async function fetchLiveRoleSnapshot(
  prisma: PrismaClient,
  orgId: string,
  roleKey: string
): Promise<string> {
  const users = await findOrgUsersForKnowledgeSearch(prisma, orgId, roleKey);
  if (users.length === 0) return "";

  const lines: string[] = [`Live ${roleKey} roster (${users.length}):`, formatTeamUsersBlock(users)];

  if (roleKey === ROLE_KEYS.developer) {
    const reports = await prisma.developerReport.findMany({
      where: { orgId, submittedById: { in: users.map((u) => u.id) } },
      orderBy: { reportDate: "desc" },
      take: 15,
      include: { submittedBy: { select: { name: true, email: true } } }
    });
    if (reports.length) {
      lines.push("\nRecent developer reports:");
      for (const r of reports) {
        const who = r.submittedBy?.name?.trim() || r.submittedBy?.email || "Developer";
        const body = [r.implemented, r.pending, r.blockers, r.needsAttention].filter(Boolean).join(" | ");
        lines.push(`- ${who} ${r.reportDate.toISOString().slice(0, 10)}: ${body.slice(0, 280)}`);
      }
    }
  }

  return lines.join("\n");
}

function fallbackAnswer(q: string, users: KnowledgeTeamUser[], chunks: KnowledgeChunkRow[]): string {
  if (users.length > 0) {
    const list = users.map((u) => formatTeamUsersBlock([u]).replace(/^- /, "")).join("\n");
    return `Found ${users.length} team member${users.length === 1 ? "" : "s"} matching "${q}":\n${list}${
      chunks.length ? `\n\nAlso found ${chunks.length} related knowledge entries below.` : ""
    }`;
  }
  if (chunks.length > 0) {
    return `Found ${chunks.length} knowledge entries matching "${q}". Review the feed below for details.`;
  }
  return `No team members or knowledge entries matched "${q}". Run **Sync full history** to index actions, reports, and communications.`;
}

export async function answerKnowledgeSearch(
  prisma: PrismaClient,
  orgId: string,
  q: string,
  options?: { audience?: "pm" | "director" | "sales" }
): Promise<{
  answer: string;
  aiGenerated: boolean;
  matchedUsers: KnowledgeTeamUser[];
  chunkCount: number;
}> {
  const query = q.trim();
  if (!query) {
    return { answer: "Enter a search query — e.g. a developer name, project, or topic.", aiGenerated: false, matchedUsers: [], chunkCount: 0 };
  }

  const matchedUsers = await findOrgUsersForKnowledgeSearch(prisma, orgId, query);
  const userIds = matchedUsers.map((u) => u.id);

  let chunks = await fetchKnowledgeChunks(prisma, orgId, { q: query, sinceDays: 0, limit: 100 });

  if (userIds.length > 0) {
    const byUser = await fetchKnowledgeChunksForUsers(prisma, orgId, userIds, { sinceDays: 0, limit: 80 });
    chunks = dedupeChunks([...chunks, ...byUser]);
  }

  const roleKey = parseRoleFromQuery(query);
  let liveSnapshot = "";
  if (roleKey) {
    liveSnapshot = await fetchLiveRoleSnapshot(prisma, orgId, roleKey);
  }

  const actorIds = [...new Set(chunks.map((c) => c.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true }
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.id, a.name?.trim() || a.email || "User"]));

  const teamBlock = formatTeamUsersBlock(matchedUsers);
  const chunksBlock = formatChunksBlock(chunks, actorMap);

  const client = getGroq();
  if (!client) {
    return {
      answer: fallbackAnswer(query, matchedUsers, chunks),
      aiGenerated: false,
      matchedUsers,
      chunkCount: chunks.length
    };
  }

  const audience = options?.audience ?? "pm";
  const system = `You are CresOS knowledge search — you answer questions using ONLY the retrieved team roster and knowledge pool excerpts below.
Audience: ${audience}.
Rules:
- Answer the user's search query directly and concisely (bullets or short paragraphs).
- For "developers" / role queries: list names, roles, projects, and recent activity when present in the data.
- Cite who did what and when when the excerpts include it.
- If data is thin, say what was found and suggest syncing the knowledge pool — do not invent people or events.
- No financial figures unless explicitly in the excerpts.`;

  const user = `Search query: ${query}

Matched team members:
${teamBlock || "(none)"}

${liveSnapshot ? `Live database snapshot:\n${liveSnapshot}\n` : ""}

Knowledge pool excerpts (${chunks.length} items):
${chunksBlock}`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 800,
      temperature: 0.35
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return {
        answer: fallbackAnswer(query, matchedUsers, chunks),
        aiGenerated: false,
        matchedUsers,
        chunkCount: chunks.length
      };
    }
    return { answer: raw, aiGenerated: true, matchedUsers, chunkCount: chunks.length };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[knowledge-ai-search] Groq failed:", e);
    return {
      answer: fallbackAnswer(query, matchedUsers, chunks),
      aiGenerated: false,
      matchedUsers,
      chunkCount: chunks.length
    };
  }
}
