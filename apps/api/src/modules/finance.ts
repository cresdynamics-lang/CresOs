import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function financeRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Invoices
  router.get(
    "/invoices",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const invoices = await prisma.invoice.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { issueDate: "desc" }
    });
    res.json(invoices);
    }
  );

  router.post(
    "/invoices",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { clientId, projectId, number, issueDate, dueDate, currency, items } =
        req.body as {
          clientId: string;
          projectId?: string;
          number: string;
          issueDate: string;
          dueDate?: string;
          currency?: string;
          items: { description: string; quantity: number; unitPrice: string }[];
        };

      if (!clientId || !number || !issueDate || !items?.length) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const totalAmount = items.reduce((sum, item) => {
          const value =
            Number(item.unitPrice) * (item.quantity || 1);
          return sum + value;
        }, 0);

        const invoice = await tx.invoice.create({
          data: {
            orgId,
            clientId,
            projectId,
            number,
            status: "sent",
            issueDate: new Date(issueDate),
            dueDate: dueDate ? new Date(dueDate) : null,
            currency: currency ?? "USD",
            totalAmount: new Prisma.Decimal(totalAmount.toFixed(2))
          }
        });

        await tx.invoiceItem.createMany({
          data: items.map((item) => ({
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: new Prisma.Decimal(item.unitPrice)
          }))
        });

        await tx.eventLog.create({
          data: {
            orgId,
            type: "invoice.sent",
            entityType: "invoice",
            entityId: invoice.id,
            metadata: { number: invoice.number, clientId: invoice.clientId }
          }
        });

        await tx.notification.create({
          data: {
            orgId,
            channel: "email",
            to: "client-email", // placeholder
            subject: `Invoice ${invoice.number}`,
            body: `Invoice ${invoice.number} has been sent.`,
            status: "queued",
            type: "invoice.sent",
            tier: "financial"
          }
        });

        return invoice;
      });

      res.status(201).json(result);
    }
  );

  // Payments
  router.get(
    "/payments",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const payments = await prisma.payment.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { receivedAt: "desc" }
    });
    res.json(payments);
    }
  );

  router.post(
    "/payments",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const {
        invoiceId,
        amount,
        currency,
        method,
        reference,
        mpesaRef,
        receivedAt
      } = req.body as {
        invoiceId?: string;
        amount: string;
        currency?: string;
        method: string;
        reference?: string;
        mpesaRef?: string;
        receivedAt: string;
      };

      if (!amount || !method || !receivedAt) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      const payment = await prisma.payment.create({
        data: {
          orgId,
          invoiceId,
          amount: new Prisma.Decimal(amount),
          currency: currency ?? "USD",
          method,
          reference,
          mpesaRef,
          receivedAt: new Date(receivedAt)
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "payment.received",
          entityType: "payment",
          entityId: payment.id,
          metadata: { invoiceId: payment.invoiceId, method: payment.method }
        }
      });

      res.status(201).json(payment);
    }
  );

  // Expenses
  router.get(
    "/expenses",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const expenses = await prisma.expense.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { spentAt: "desc" }
    });
    res.json(expenses);
    }
  );

  router.post(
    "/expenses",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { category, description, amount, currency, spentAt } = req.body as {
        category: string;
        description?: string;
        amount: string;
        currency?: string;
        spentAt: string;
      };

      if (!category || !amount || !spentAt) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      const expense = await prisma.expense.create({
        data: {
          orgId,
          category,
          description,
          amount: new Prisma.Decimal(amount),
          currency: currency ?? "USD",
          spentAt: new Date(spentAt)
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "expense.recorded",
          entityType: "expense",
          entityId: expense.id
        }
      });

      res.status(201).json(expense);
    }
  );

  // Payouts
  router.get(
    "/payouts",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const payouts = await prisma.payout.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    res.json(payouts);
    }
  );

  router.post(
    "/payouts",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { recipientId, description, amount, currency, scheduledAt } =
        req.body as {
          recipientId?: string;
          description?: string;
          amount: string;
          currency?: string;
          scheduledAt?: string;
        };

      if (!amount) {
        res.status(400).json({ error: "Missing amount" });
        return;
      }

      const payout = await prisma.payout.create({
        data: {
          orgId,
          recipientId,
          description,
          amount: new Prisma.Decimal(amount),
          currency: currency ?? "USD",
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "payout.created",
          entityType: "payout",
          entityId: payout.id
        }
      });

      res.status(201).json(payout);
    }
  );

  // Approvals for finance-related entities
  router.get(
    "/approvals",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const approvals = await prisma.approval.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" }
    });
    res.json(approvals);
    }
  );

  router.post(
    "/approvals",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { entityType, entityId, reason } = req.body as {
        entityType: string;
        entityId: string;
        reason?: string;
      };

      if (!entityType || !entityId) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      const approval = await prisma.approval.create({
        data: {
          orgId,
          requesterId: userId,
          entityType,
          entityId,
          status: "pending",
          reason
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "approval.requested",
          entityType,
          entityId,
          metadata: { approvalId: approval.id }
        }
      });

      res.status(201).json(approval);
    }
  );

  router.post(
    "/approvals/:id/decision",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { status, note } = req.body as {
        status: "approved" | "rejected" | "cancelled";
        note?: string;
      };

      if (!status) {
        res.status(400).json({ error: "Missing status" });
        return;
      }

      const approval = await prisma.approval.update({
        where: { id },
        data: {
          status,
          approverId: userId,
          decisionNote: note,
          decidedAt: new Date()
        }
      });

      // Enforce: Finance cannot approve own payouts
      if (approval.entityType === "payout" && status === "approved") {
        const payout = await prisma.payout.findUnique({
          where: { id: approval.entityId }
        });
        if (payout && payout.recipientId && payout.recipientId === approval.approverId) {
          // revert approval
          await prisma.approval.update({
            where: { id: approval.id },
            data: { status: "rejected", decisionNote: "Auto-rejected: approver is payout recipient" }
          });
          res.status(403).json({ error: "Approver cannot be payout recipient" });
          return;
        }
      }

      await prisma.eventLog.create({
        data: {
          orgId,
          type: `approval.${status}`,
          entityType: approval.entityType,
          entityId: approval.entityId,
          metadata: { approvalId: approval.id }
        }
      });

      res.json(approval);
    }
  );

  return router;
}

