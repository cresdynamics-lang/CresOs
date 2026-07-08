import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { groqChatWithFallback } from "./groq-chat-fallback";
import { listGroqApiKeys } from "./groq-model";
import { buildFinanceAssistantContextBlock } from "./finance-assistant-context";
import type {
  FinanceAssistantMode,
  FinanceAssistantResponse,
  FinanceProposedAction,
  FinanceProposedActionKind
} from "./finance-assistant-types";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./finance-assistant-types";

function hasGroqKeys(): boolean {
  return listGroqApiKeys().length > 0;
}

function parseJsonFromModel(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() || trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1));
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function normalizeFinanceActions(raw: unknown): FinanceProposedAction[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set<FinanceProposedActionKind>(["create_expense", "create_payment"]);
  const out: FinanceProposedAction[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const kind = asString(o.kind) as FinanceProposedActionKind;
    if (!kinds.has(kind)) continue;
    const title = asString(o.title);
    if (!title) continue;
    out.push({
      id: randomUUID(),
      kind,
      title,
      amount: asNumber(o.amount),
      currency: asString(o.currency) || "KES",
      category: asString(o.category) || null,
      method: asString(o.method ?? o.paymentMethod) || null,
      beneficiaryHint: asString(o.beneficiaryHint ?? o.beneficiary_hint) || null,
      projectHint: asString(o.projectHint ?? o.project_hint) || null,
      invoiceHint: asString(o.invoiceHint ?? o.invoice_hint) || null,
      spentAt: asString(o.spentAt ?? o.spent_at) || null,
      receivedAt: asString(o.receivedAt ?? o.received_at) || null,
      source: asString(o.source) || null,
      transactionCode: asString(o.transactionCode ?? o.transaction_code) || null,
      account: asString(o.account) || null,
      notes: asString(o.notes) || null
    });
  }
  return out;
}

function fallbackResponse(
  mode: FinanceAssistantMode,
  message: string,
  poolEmpty?: boolean
): FinanceAssistantResponse {
  const poolHint = poolEmpty
    ? " Knowledge pool is empty — sync PM → Knowledge pool for richer finance context."
    : "";
  const isExecute = mode === "execute";
  return {
    mode,
    reply:
      isExecute
        ? `Parsed: "${message.slice(0, 200)}". Set GROQ_API_KEY for AI expense/payment previews.${poolHint}`
        : `Finance question: "${message.slice(0, 200)}". Configure GROQ_API_KEY for AI answers.${poolHint}`,
    aiGenerated: false,
    ...(isExecute ? { proposedActions: [] as FinanceProposedAction[] } : {})
  };
}

export async function runFinanceAssistant(
  prisma: PrismaClient,
  orgId: string,
  options: { message: string; mode: FinanceAssistantMode; transcript?: string }
): Promise<FinanceAssistantResponse> {
  const message = options.message.trim();
  if (!message) {
    return {
      mode: options.mode,
      reply: "Say or type an expense or payment to record, or ask about cash flow.",
      aiGenerated: false
    };
  }

  const contextBlock = await buildFinanceAssistantContextBlock(prisma, orgId, message);
  const poolEmpty = contextBlock.includes("Knowledge pool items: 0");
  if (!hasGroqKeys()) return fallbackResponse(options.mode, message, poolEmpty);

  const isExecute = options.mode === "execute";
  const categories = EXPENSE_CATEGORIES.join(", ");
  const methods = PAYMENT_METHODS.join(", ");

  const system = isExecute
    ? `You are CresOS Finance Command — parse finance requests into PREVIEW actions (user confirms before DB write).
Return JSON only:
{
  "reply": "short confirmation",
  "proposedActions": [{
    "kind": "create_expense" | "create_payment",
    "title": "string",
    "amount": number,
    "currency": "KES",
    "category": "${categories}" (expense only),
    "method": "${methods}" (payment only),
    "beneficiaryHint": "person name for expense beneficiary",
    "projectHint": "project name if relevant",
    "invoiceHint": "invoice number if payment linked to invoice",
    "spentAt": "ISO date",
    "receivedAt": "ISO date",
    "source": "vendor or payer name",
    "transactionCode": "receipt/ref if mentioned",
    "account": "bank account name if mentioned",
    "notes": "optional"
  }]
}
Rules:
- create_expense needs amount, category, beneficiaryHint, spentAt (default today Africa/Nairobi)
- create_payment needs amount, method, receivedAt; invoiceHint when client paid an invoice
- Use KES unless stated otherwise
- Split multiple items into separate proposedActions`
    : `You are CresOS Finance Intelligence — answer using ONLY org finance context below.
Return JSON only: { "reply": "markdown-friendly answer" }
Cover expenses, payments, invoices, project cash flow. No invented numbers.`;

  const user = `Finance message:\n${message}\n\n--- ORG FINANCE CONTEXT ---\n${contextBlock}`;

  try {
    const { raw } = await groqChatWithFallback({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: isExecute ? 1400 : 1200,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    if (!raw) return fallbackResponse(options.mode, message, poolEmpty);

    const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
    const reply = asString(parsed.reply) || "Here is what I found.";
    const base: FinanceAssistantResponse = {
      mode: options.mode,
      reply,
      aiGenerated: true,
      ...(options.transcript ? { transcript: options.transcript } : {})
    };

    if (isExecute) {
      base.proposedActions = normalizeFinanceActions(
        parsed.proposedActions ?? parsed.proposed_actions
      );
    }

    return base;
  } catch (e) {
    console.error("[finance-assistant] Groq failed:", e);
    const fallback = fallbackResponse(options.mode, message, poolEmpty);
    return {
      ...fallback,
      reply: `AI temporarily unavailable. ${fallback.reply}`
    };
  }
}
