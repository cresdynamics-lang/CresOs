/**
 * One-off: split legacy ai_auto sales comments (questions embedded in body)
 * into a review comment + separate answerable question rows.
 * Run inside API container: node /app/scripts/backfill-sales-ai-questions.js
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
      "Thanks for the update — I have reviewed your report. Please answer the questions below so we can stay aligned on pipeline and next actions.";
  }

  return afterMarked ? `${body}\n\n${afterMarked}` : ensureMarkedReviewed(body);
}

async function main() {
  const prisma = new PrismaClient();
  const results = [];

  try {
    const reports = await prisma.salesReport.findMany({
      where: { status: "submitted" },
      include: {
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    for (const report of reports) {
      const aiComment = report.comments.find((c) => c.source === "ai_auto" && c.kind === "comment");
      const existingAiQuestions = report.comments.filter((c) => c.source === "ai_auto" && c.kind === "question");
      if (!aiComment || existingAiQuestions.length > 0) {
        results.push({ reportId: report.id, title: report.title, action: "skip" });
        continue;
      }

      const questions = extractQuestionSentences(aiComment.content);
      if (questions.length === 0) {
        results.push({ reportId: report.id, title: report.title, action: "skip_no_questions" });
        continue;
      }

      const commentBody = stripQuestionSentences(aiComment.content);

      await prisma.$transaction([
        prisma.salesReportComment.update({
          where: { id: aiComment.id },
          data: { content: commentBody }
        }),
        ...questions.map((q) =>
          prisma.salesReportComment.create({
            data: {
              reportId: report.id,
              authorId: aiComment.authorId,
              kind: "question",
              content: q.slice(0, 4000),
              source: "ai_auto"
            }
          })
        )
      ]);

      results.push({
        reportId: report.id,
        title: report.title,
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
