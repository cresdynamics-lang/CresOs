/**
 * Smoke: Finance AI stream + knowledge pool context.
 * Run: npx tsx scripts/smoke-finance-stream.ts
 */
import { PrismaClient } from "@prisma/client";
import { buildFinanceAssistantContextBlock } from "../src/lib/finance-assistant-context";
import { streamFinanceAssistant } from "../src/lib/finance-assistant-stream";
import type { AssistantSseWriter } from "../src/lib/assistant-sse";

async function main() {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.org.findFirst({ select: { id: true, name: true } });
    if (!org) {
      console.error("No org found");
      process.exit(1);
    }
    const user =
      (await prisma.user.findFirst({
        where: { orgId: org.id, deletedAt: null, roles: { some: { role: { key: "admin" } } } },
        select: { id: true, email: true }
      })) ||
      (await prisma.user.findFirst({
        where: { orgId: org.id, deletedAt: null },
        select: { id: true, email: true }
      }));
    if (!user) {
      console.error("No user found");
      process.exit(1);
    }

    console.log(`Org: ${org.name} (${org.id})`);
    console.log(`User: ${user.email}`);

    const ctx = await buildFinanceAssistantContextBlock(
      prisma,
      org.id,
      "How much did we spend recently and what invoices are open?"
    );
    const hasPool = /FINANCE-SCOPED KNOWLEDGE POOL/.test(ctx);
    const hasLedger = /RECENT EXPENSES/.test(ctx) && /OPEN INVOICES/.test(ctx);
    console.log(`Context has ledger: ${hasLedger}, has knowledge section: ${hasPool}`);
    console.log("--- context head ---");
    console.log(ctx.slice(0, 900));
    console.log("--- end head ---");

    const events: { event: string; data: unknown }[] = [];
    let reply = "";
    const sse: AssistantSseWriter = {
      status(phase, message) {
        events.push({ event: "status", data: { phase, message } });
        console.log(`[status] ${phase}: ${message}`);
      },
      token(text) {
        reply += text;
        process.stdout.write(text);
      },
      done(payload) {
        events.push({ event: "done", data: payload });
        console.log("\n[done]", {
          sessionId: (payload as { sessionId?: string }).sessionId,
          replyLen: reply.length
        });
      },
      error(message) {
        events.push({ event: "error", data: { message } });
        console.error("[error]", message);
      },
      end() {
        console.log("[end]");
      }
    };

    const question =
      "Summarize recent expenses and open invoices. Mention anything useful from the knowledge pool.";
    console.log(`\nAsking: ${question}\n`);
    await streamFinanceAssistant(
      prisma,
      org.id,
      user.id,
      { message: question, mode: "intelligence" },
      sse
    );

    const phases = events
      .filter((e) => e.event === "status")
      .map((e) => (e.data as { phase: string }).phase);
    console.log("\nPhases seen:", phases.join(" → "));
    if (!reply.trim()) {
      console.error("FAIL: empty reply");
      process.exit(1);
    }
    if (!phases.includes("analyzing") && !phases.includes("knowledge") && !phases.includes("writing")) {
      console.error("FAIL: missing analyzing/writing phases");
      process.exit(1);
    }
    console.log("\nPASS: finance stream answered with knowledge-aware context");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
