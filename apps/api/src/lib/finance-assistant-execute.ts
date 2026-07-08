import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  sendExpenseAdminApprovalRequest,
  sendExpenseReceiptToBeneficiary
} from "./finance-workflow";
import type {
  FinanceExecutedAction,
  FinanceExecuteResponse,
  FinanceProposedAction
} from "./finance-assistant-types";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./finance-assistant-types";
import { parseActionDate, resolveProjectHint, resolveUserHint } from "./admin-assistant-resolve";
import {
  exceedsFinanceAmountCap,
  financeAssistantMaxAmount,
  findDuplicateExpense,
  findDuplicatePayment
} from "./finance-assistant-guardrails";
import { confirmAssistantPayment } from "./finance-payment-confirm";
import { ingestKnowledgeFromEventLog } from "./knowledge-from-event";
import { sendPaymentReceiptToClient } from "./finance-workflow";

const DEFAULT_ACCOUNT = process.env.FINANCE_DEFAULT_ACCOUNT?.trim() || "Operations";

function defaultTransactionCode(): string {
  return `AI-${Date.now()}`;
}

async function resolveInvoiceHint(
  prisma: PrismaClient,
  orgId: string,
  hint: string | null | undefined
): Promise<{ ok: true; id: string; label: string } | { ok: false; error: string }> {
  const trimmed = hint?.trim();
  if (!trimmed) return { ok: false, error: "No invoice specified" };
  const num = trimmed.replace(/^INV-?/i, "");
  const invoice = await prisma.invoice.findFirst({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { number: { contains: num, mode: "insensitive" } },
        { id: trimmed }
      ]
    },
    select: { id: true, number: true }
  });
  if (!invoice) return { ok: false, error: `No invoice matched "${trimmed}"` };
  return { ok: true, id: invoice.id, label: `INV-${invoice.number}` };
}

export async function executeFinanceProposedActions(
  prisma: PrismaClient,
  orgId: string,
  actorUserId: string,
  actions: FinanceProposedAction[],
  overrides?: Record<string, { beneficiaryId?: string; projectId?: string; invoiceId?: string }>
): Promise<FinanceExecuteResponse> {
  const results: FinanceExecutedAction[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (const action of actions) {
    const override = overrides?.[action.id];
    const base: FinanceExecutedAction = {
      actionId: action.id,
      kind: action.kind,
      success: false
    };

    try {
      if (action.kind === "create_expense") {
        const amount = action.amount;
        if (amount == null || amount <= 0) {
          results.push({ ...base, error: "Valid amount is required" });
          continue;
        }
        if (exceedsFinanceAmountCap(amount)) {
          results.push({
            ...base,
            error: `Amount exceeds Finance AI cap of ${financeAssistantMaxAmount().toLocaleString()} KES`
          });
          continue;
        }

        const category = action.category?.trim() || "other";
        if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
          results.push({ ...base, error: `Invalid category: ${category}` });
          continue;
        }

        const beneficiary = override?.beneficiaryId
          ? await prisma.user.findFirst({
              where: { id: override.beneficiaryId, orgId, deletedAt: null },
              select: { id: true, name: true, email: true }
            })
          : null;
        const beneficiaryResolved = beneficiary
          ? { ok: true as const, id: beneficiary.id, label: beneficiary.name || beneficiary.email }
          : await resolveUserHint(prisma, orgId, action.beneficiaryHint);
        if (!beneficiaryResolved.ok) {
          results.push({
            ...base,
            error: beneficiaryResolved.error,
            candidates: beneficiaryResolved.candidates
          });
          continue;
        }

        const spentAt = parseActionDate(action.spentAt, today);
        const duplicateExpense = await findDuplicateExpense(prisma, orgId, {
          amount,
          spentAt,
          beneficiaryUserId: beneficiaryResolved.id,
          description: action.title
        });
        if (duplicateExpense) {
          results.push({
            ...base,
            error: "Similar expense already recorded for this beneficiary today — skipped duplicate"
          });
          continue;
        }

        const source = action.source?.trim() || "Finance AI entry";
        const transactionCode = action.transactionCode?.trim() || defaultTransactionCode();
        const account = action.account?.trim() || DEFAULT_ACCOUNT;

        const expense = await prisma.expense.create({
          data: {
            orgId,
            category,
            description: action.title.trim(),
            notes: action.notes?.trim() || null,
            source,
            transactionCode,
            account,
            paymentMethod: action.method?.trim() || "bank",
            amount: new Prisma.Decimal(Number(amount).toFixed(2)),
            currency: action.currency?.trim() || "KES",
            spentAt,
            status: "pending",
            beneficiaryUserId: beneficiaryResolved.id
          }
        });

        await prisma.eventLog.create({
          data: {
            orgId,
            type: "expense.recorded",
            entityType: "expense",
            entityId: expense.id,
            metadata: { source: "finance_assistant" }
          }
        });

        const existingApproval = await prisma.approval.findFirst({
          where: { orgId, entityType: "expense", entityId: expense.id, status: "pending" }
        });
        if (!existingApproval) {
          await prisma.approval.create({
            data: {
              orgId,
              requesterId: actorUserId,
              entityType: "expense",
              entityId: expense.id,
              status: "pending",
              reason: "Expense recorded via Finance AI — pending admin approval"
            }
          });
        }

        await prisma.eventLog.create({
          data: {
            orgId,
            actorId: actorUserId,
            type: "finance.assistant.action_executed",
            entityType: "expense",
            entityId: expense.id,
            metadata: { source: "finance_assistant", actionKind: "create_expense" }
          }
        }).then((ev) => ingestKnowledgeFromEventLog(prisma, ev.id).catch(() => undefined));

        await sendExpenseAdminApprovalRequest(prisma, {
          orgId,
          expenseId: expense.id,
          category,
          amount: Number(amount),
          currency: action.currency ?? "KES",
          description: action.title,
          spentAt,
          recordedByUserId: actorUserId,
          source,
          transactionCode,
          account,
          paymentMethod: action.method ?? null
        }).catch(() => undefined);

        await sendExpenseReceiptToBeneficiary(prisma, {
          orgId,
          expenseId: expense.id
        }).catch(() => undefined);

        results.push({
          ...base,
          success: true,
          expenseId: expense.id,
          resolvedBeneficiary: beneficiaryResolved.label
        });
        continue;
      }

      if (action.kind === "create_payment") {
        const amount = action.amount;
        if (amount == null || amount <= 0) {
          results.push({ ...base, error: "Valid amount is required" });
          continue;
        }
        if (exceedsFinanceAmountCap(amount)) {
          results.push({
            ...base,
            error: `Amount exceeds Finance AI cap of ${financeAssistantMaxAmount().toLocaleString()} KES`
          });
          continue;
        }

        const methodRaw = (action.method?.trim() || "mpesa").toLowerCase();
        const method = methodRaw === "bank_transfer" ? "bank" : methodRaw;
        if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
          results.push({ ...base, error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` });
          continue;
        }

        const receivedAt = parseActionDate(action.receivedAt, today);
        let invoiceId: string | null = null;
        let invoiceLabel: string | undefined;
        if (override?.invoiceId) {
          invoiceId = override.invoiceId;
        } else if (action.invoiceHint?.trim()) {
          const inv = await resolveInvoiceHint(prisma, orgId, action.invoiceHint);
          if (!inv.ok) {
            results.push({ ...base, error: inv.error });
            continue;
          }
          invoiceId = inv.id;
          invoiceLabel = inv.label;
        }

        let projectId: string | null = override?.projectId ?? null;
        if (!projectId && action.projectHint?.trim()) {
          const proj = await resolveProjectHint(prisma, orgId, action.projectHint);
          if (proj.ok) projectId = proj.id;
        }

        const reference = action.transactionCode?.trim() || defaultTransactionCode();
        const source = action.source?.trim() || null;
        const account = action.account?.trim() || null;

        const duplicatePayment = await findDuplicatePayment(prisma, orgId, {
          amount,
          receivedAt,
          reference,
          source
        });
        if (duplicatePayment) {
          results.push({
            ...base,
            error: "Similar payment already recorded today — skipped duplicate"
          });
          continue;
        }

        const payment = await prisma.payment.create({
          data: {
            orgId,
            invoiceId,
            createdByUserId: actorUserId,
            amount: new Prisma.Decimal(Number(amount).toFixed(2)),
            currency: action.currency?.trim() || "KES",
            method,
            reference,
            mpesaRef: method === "mpesa" ? reference : null,
            notes: action.notes?.trim() || (invoiceLabel ? `Payment for ${invoiceLabel}` : null),
            source,
            account,
            howToProceed: invoiceLabel ? `Matched to ${invoiceLabel}` : "Recorded via Finance AI",
            receivedAt,
            status: "pending"
          }
        });

        const confirmResult = await confirmAssistantPayment(prisma, payment.id, {
          source: source || "Finance AI",
          account: account || DEFAULT_ACCOUNT,
          reference,
          howToProceed: invoiceLabel ? `Matched to ${invoiceLabel}` : "Auto-confirmed via Finance AI",
          projectId
        });

        await sendPaymentReceiptToClient(prisma, orgId, payment.id).catch(() => undefined);

        const confirmEvent = await prisma.eventLog.create({
          data: {
            orgId,
            actorId: actorUserId,
            type: "payment.confirmed",
            entityType: "payment",
            entityId: payment.id,
            metadata: {
              source: "finance_assistant",
              actionKind: "create_payment",
              invoiceId,
              projectId,
              invoiceStatus: confirmResult.invoiceStatus ?? null,
              projectReceivedDelta: confirmResult.projectReceivedDelta ?? null
            }
          },
          select: { id: true }
        });
        void ingestKnowledgeFromEventLog(prisma, confirmEvent.id).catch(() => undefined);

        results.push({
          ...base,
          success: true,
          paymentId: payment.id,
          resolvedProject: projectId ?? undefined
        });
        continue;
      }

      results.push({ ...base, error: "Unknown action kind" });
    } catch (e) {
      results.push({
        ...base,
        error: e instanceof Error ? e.message : "Execution failed"
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return { results, succeeded, failed: results.length - succeeded };
}
