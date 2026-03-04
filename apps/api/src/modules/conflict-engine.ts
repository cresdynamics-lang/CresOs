import type { PrismaClient, Approval } from "@prisma/client";

export async function logConflict(
  prisma: PrismaClient,
  params: {
    orgId: string;
    userId: string;
    type: string;
    context?: Record<string, unknown>;
    createAlert?: boolean;
  }
): Promise<void> {
  const { orgId, userId, type, context, createAlert } = params;

  await prisma.$transaction(async (tx) => {
    await tx.conflictLog.create({
      data: {
        orgId,
        userId,
        type,
        context: context ?? {}
      }
    });

    if (createAlert) {
      await tx.adminAlert.create({
        data: {
          orgId,
          type,
          severity: "critical",
          details: context ?? {}
        }
      });
    }
  });
}

export async function enforceApprovalConflicts(
  prisma: PrismaClient,
  params: {
    orgId: string;
    userId: string;
    approval: Approval;
  }
): Promise<void> {
  const { orgId, userId, approval } = params;

  if (approval.orgId !== orgId) {
    throw new Error("Cross-org approval access is not allowed");
  }

  // Payout: approver must not be payout recipient
  if (approval.entityType === "payout") {
    const payout = await prisma.payout.findUnique({
      where: { id: approval.entityId }
    });
    if (payout && payout.recipientId === userId) {
      await logConflict(prisma, {
        orgId,
        userId,
        type: "financial_conflict_payout_self",
        context: {
          approvalId: approval.id,
          payoutId: payout.id
        },
        createAlert: true
      });
      throw new Error("User cannot approve payout where they are recipient");
    }
  }

  // Expense: approver must not be original requester
  if (approval.entityType === "expense") {
    if (approval.requesterId && approval.requesterId === userId) {
      await logConflict(prisma, {
        orgId,
        userId,
        type: "financial_conflict_expense_self",
        context: {
          approvalId: approval.id,
          expenseId: approval.entityId
        },
        createAlert: true
      });
      throw new Error("User cannot approve an expense they requested");
    }
  }
}

export async function enforcePaymentConfirmationConflicts(
  prisma: PrismaClient,
  params: {
    orgId: string;
    userId: string;
    paymentId: string;
  }
): Promise<void> {
  const { orgId, userId, paymentId } = params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });

  if (!payment || payment.orgId !== orgId) {
    throw new Error("Payment not found");
  }

  if (payment.createdByUserId && payment.createdByUserId === userId) {
    await logConflict(prisma, {
      orgId,
      userId,
      type: "payment_confirm_self",
      context: { paymentId },
      createAlert: true
    });
    throw new Error("User cannot confirm a payment they created");
  }
}


