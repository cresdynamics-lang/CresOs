/**
 * One-off: migrate legacy developer report remarks (AI text with embedded questions)
 * into a review comment + separate answerable question rows.
 * Run inside API container: node /app/scripts/backfill-developer-ai-questions.js
 */
const { PrismaClient } = require("@prisma/client");

const MARKED = "Marked reviewed. ✓";

function ensureMarkedReviewed(text) {
  const t = text.trim();
  if (t.includes(MARKED)) return t;
  return `${t}\n\n${MARKED}`;
}

function extractQuestionSentences(text) {
  const withoutMarked = text.replace(MARKED, "").trim();
  const matches = withoutMarked.match(/[^.!?\n]+(?:\?+)/g) ?? [];
  const seen = new Set();
  const out = [];
  for (const raw of matches) {
    const q = raw.trim().replace(/\?+$/, "?");
    if (q.length < 12) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function stripQuestionSentences(text) {
  const withMarked = ensureMarkedReviewed(text.trim());
  const idx = withMarked.lastIndexOf(MARKED);
  const beforeMarked = idx === -1 ? withMarked : withMarked.slice(0, idx).trimEnd();
  const afterMarked = idx === -1 ? "" : withMarked.slice(idx).trimStart();

  let body = beforeMarked
    .replace(/[^.!?\n]+(?:\?+)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!body || body.length < 20) {
    body =
      "Thanks for the update — I have reviewed your report. Please answer the questions below so we can stay aligned on delivery and next actions.";
  }

  return afterMarked ? `${body}\n\n${afterMarked}` : ensureMarkedReviewed(body);
}

async function pickDirectorAuthorId(prisma, orgId) {
  const role = await prisma.role.findFirst({ where: { orgId, key: "director" }, select: { id: true } });
  if (!role) return null;
  const memberIds = new Set(
    (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId)
  );
  const userIds = (await prisma.userRole.findMany({ where: { roleId: role.id }, select: { userId: true } }))
    .map((r) => r.userId)
    .filter((id) => memberIds.has(id));
  if (!userIds.length) return null;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true, email: true },
    orderBy: { email: "asc" }
  });
  return users[0]?.id ?? null;
}

async function main() {
  const prisma = new PrismaClient();
  const results = [];

  try {
    const reports = await prisma.developerReport.findMany({
      where: { remarks: { not: null } },
      include: {
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    for (const report of reports) {
      const remarks = (report.remarks ?? "").trim();
      if (!remarks) {
        results.push({ reportId: report.id, action: "skip_no_remarks" });
        continue;
      }

      const existingAiQuestions = report.comments.filter((c) => c.source === "ai_auto" && c.kind === "question");
      const existingAiComment = report.comments.find((c) => c.source === "ai_auto" && c.kind === "comment");
      if (existingAiComment && existingAiQuestions.length > 0) {
        results.push({ reportId: report.id, action: "skip_already_migrated" });
        continue;
      }

      const questions = extractQuestionSentences(remarks);
      const authorId = report.reviewedById || (await pickDirectorAuthorId(prisma, report.orgId));
      if (!authorId) {
        results.push({ reportId: report.id, action: "skip_no_author" });
        continue;
      }

      const commentBody = stripQuestionSentences(remarks);

      await prisma.$transaction([
        ...(existingAiComment
          ? [
              prisma.developerReportComment.update({
                where: { id: existingAiComment.id },
                data: { content: commentBody }
              })
            ]
          : [
              prisma.developerReportComment.create({
                data: {
                  reportId: report.id,
                  authorId,
                  kind: "comment",
                  content: commentBody,
                  source: "ai_auto"
                }
              })
            ]),
        ...questions.map((q) =>
          prisma.developerReportComment.create({
            data: {
              reportId: report.id,
              authorId,
              kind: "question",
              content: q.slice(0, 4000),
              source: "ai_auto"
            }
          })
        ),
        prisma.developerReport.update({
          where: { id: report.id },
          data: { remarks: null }
        })
      ]);

      results.push({
        reportId: report.id,
        reportDate: report.reportDate.toISOString().slice(0, 10),
        action: "backfilled",
        questionsCreated: questions.length,
        questions
      });
    }

    console.log(JSON.stringify({ results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
