import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { logEmailSent } from "./admin-activity";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { enforceApprovalConflicts, enforcePaymentConfirmationConflicts } from "./conflict-engine";

export default function financeRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Real-time financial report (on request) — admin, director, finance
  router.get(
    "/report",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      try {
        const [
          revenueThisMonth,
          revenueAllTime,
          outstandingInvoices,
          overdueInvoicesCount,
          expensesThisMonth,
          expensesAllTime,
          pendingPayoutsSum,
          invoiceCountByStatus
        ] = await Promise.all([
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: "confirmed",
              receivedAt: { gte: startOfMonth }
            }
          }),
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: { orgId, deletedAt: null, status: "confirmed" }
          }),
          prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: {
              orgId,
              deletedAt: null,
              OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
            }
          }),
          prisma.invoice.count({
            where: { orgId, deletedAt: null, status: "overdue" }
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              spentAt: { gte: startOfMonth }
            }
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: { orgId, deletedAt: null }
          }),
          prisma.payout.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              paidAt: null
            }
          }),
          prisma.invoice.groupBy({
            by: ["status"],
            _count: { id: true },
            where: { orgId, deletedAt: null }
          })
        ]);

        const revMonth = revenueThisMonth._sum.amount?.toNumber() ?? 0;
        const revAll = revenueAllTime._sum.amount?.toNumber() ?? 0;
        const outVal = outstandingInvoices._sum.totalAmount?.toNumber() ?? 0;
        const expMonth = expensesThisMonth._sum.amount?.toNumber() ?? 0;
        const expAll = expensesAllTime._sum.amount?.toNumber() ?? 0;
        const pendingPayouts = pendingPayoutsSum._sum.amount?.toNumber() ?? 0;

        res.json({
          generatedAt: now.toISOString(),
          period: { startOfMonth: startOfMonth.toISOString(), endOfMonth: now.toISOString() },
          revenue: { thisMonth: revMonth, allTime: revAll },
          invoices: {
            outstandingAmount: outVal,
            overdueCount: overdueInvoicesCount,
            byStatus: invoiceCountByStatus.map((g) => ({ status: g.status, count: g._count.id }))
          },
          expenses: { thisMonth: expMonth, allTime: expAll },
          payouts: { pendingAmount: pendingPayouts },
          cashFlow: {
            revenueThisMonth: revMonth,
            expensesThisMonth: expMonth,
            netThisMonth: revMonth - expMonth
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ error: "Failed to generate financial report" });
      }
    }
  );

  // Invoices
  router.get(
    "/invoices",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const invoices = await prisma.invoice.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { issueDate: "desc" },
      include: { project: { select: { id: true, name: true } } }
    });
    res.json(invoices);
    }
  );

  router.post(
    "/invoices",
    requireRoles([ROLE_KEYS.finance]),
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
            currency: currency ?? "KES",
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

      await logEmailSent(prisma, {
        orgId,
        to: "client",
        subject: `Invoice ${result.number}`,
        body: `Invoice ${result.number} has been sent.`,
        type: "invoice.sent"
      });
      res.status(201).json(result);
    }
  );

  // Payments
  router.get(
    "/payments",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const payments = await prisma.payment.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { receivedAt: "desc" },
      include: { invoice: { include: { project: { select: { id: true, name: true } } } } }
    });
    res.json(payments);
    }
  );

  const PAYMENT_METHODS = ["bank", "card", "mpesa", "cash"] as const;

  router.post(
    "/payments",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const {
        invoiceId,
        amount,
        currency,
        method: rawMethod,
        reference,
        mpesaRef,
        receivedAt,
        notes,
        source
      } = req.body as {
        invoiceId?: string;
        amount: string;
        currency?: string;
        method: string;
        reference?: string;
        mpesaRef?: string;
        receivedAt: string;
        notes?: string;
        source?: string;
      };

      if (!amount || !rawMethod || !receivedAt) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }
      const method = rawMethod === "bank_transfer" ? "bank" : rawMethod.toLowerCase();
      if (!PAYMENT_METHODS.includes(method as typeof PAYMENT_METHODS[number])) {
        res.status(400).json({ error: "method must be one of: bank, card, mpesa, cash" });
        return;
      }

      const userId = req.auth!.userId;
      const payment = await prisma.payment.create({
        data: {
          orgId,
          invoiceId,
          createdByUserId: userId,
          amount: new Prisma.Decimal(amount),
          currency: currency ?? "KES",
          method,
          reference,
          mpesaRef,
          notes: notes ?? null,
          source: source ?? null,
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

  // Update payment confirmation details (before confirming)
  router.patch(
    "/payments/:id",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { source, account, reference, mpesaRef, howToProceed, notes } = req.body as {
        source?: string;
        account?: string;
        reference?: string;
        mpesaRef?: string;
        howToProceed?: string;
        notes?: string;
      };
      const payment = await prisma.payment.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }
      if (payment.status !== "pending") {
        res.status(400).json({ error: "Only pending payments can be updated" });
        return;
      }
      const updated = await prisma.payment.update({
        where: { id },
        data: {
          ...(source !== undefined && { source: source || null }),
          ...(account !== undefined && { account: account || null }),
          ...(reference !== undefined && { reference: reference || null }),
          ...(mpesaRef !== undefined && { mpesaRef: mpesaRef || null }),
          ...(howToProceed !== undefined && { howToProceed: howToProceed || null }),
          ...(notes !== undefined && { notes: notes || null })
        }
      });
      res.json(updated);
    }
  );

  // Confirm payment: require where from, transaction code, which account, how to proceed
  router.post(
    "/payments/:id/confirm",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { source, account, reference, howToProceed } = req.body as {
        source?: string;
        account?: string;
        reference?: string;
        howToProceed?: string;
      };

      try {
        await enforcePaymentConfirmationConflicts(prisma, {
          orgId,
          userId,
          paymentId: id
        });
      } catch {
        res.status(403).json({ error: "Payment confirmation blocked due to conflict of interest" });
        return;
      }

      const payment = await prisma.payment.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }
      if (payment.status !== "pending") {
        res.status(400).json({ error: "Payment is not pending" });
        return;
      }

      const sourceVal = (source ?? payment.source ?? "").trim();
      const accountVal = (account ?? payment.account ?? "").trim();
      const referenceVal = (reference ?? payment.reference ?? "").trim();
      if (!sourceVal || !accountVal || !referenceVal) {
        res.status(400).json({
          error: "Confirmation requires: where from (source), transaction code (reference), and which account. Provide source, account, and reference."
        });
        return;
      }

      const amountNum = Number(payment.amount);

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id },
          data: {
            source: sourceVal,
            account: accountVal,
            reference: referenceVal,
            howToProceed: (howToProceed ?? payment.howToProceed) ?? null,
            status: "confirmed"
          }
        });

        if (payment.invoiceId) {
          const inv = await tx.invoice.findUnique({
            where: { id: payment.invoiceId },
            select: { projectId: true }
          });
          if (inv?.projectId) {
            const project = await tx.project.findUnique({
              where: { id: inv.projectId },
              select: { amountReceived: true }
            });
            const current = project?.amountReceived != null ? Number(project.amountReceived) : 0;
            await tx.project.update({
              where: { id: inv.projectId },
              data: { amountReceived: new Prisma.Decimal(current + amountNum) }
            });
          }
        }
      });

      const updated = await prisma.payment.findUnique({
        where: { id },
        include: { invoice: { include: { project: { select: { id: true, name: true } } } } }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "payment.confirmed",
          entityType: "payment",
          entityId: id,
          metadata: { source: sourceVal, account: accountVal, reference: referenceVal }
        }
      });

      res.json(updated);
    }
  );

  // Expenses
  router.get(
    "/expenses",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst]),
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
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const {
        category,
        description,
        amount,
        currency,
        spentAt,
        notes,
        source,
        transactionCode,
        account,
        paymentMethod
      } = req.body as {
        category: string;
        description?: string;
        amount: string;
        currency?: string;
        spentAt: string;
        notes?: string;
        source?: string;
        transactionCode?: string;
        account?: string;
        paymentMethod?: string;
      };

      if (!category || !amount || !spentAt) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      const expense = await prisma.expense.create({
        data: {
          orgId,
          category,
          description: description ?? null,
          notes: notes ?? null,
          source: source ?? null,
          transactionCode: transactionCode ?? null,
          account: account ?? null,
          paymentMethod: paymentMethod ?? null,
          amount: new Prisma.Decimal(amount),
          currency: currency ?? "KES",
          spentAt: new Date(spentAt),
          status: "pending" // expenses need admin approval
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
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst]),
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
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { recipientId, description, amount, currency, scheduledAt, notes } =
        req.body as {
          recipientId?: string;
          description?: string;
          amount: string;
          currency?: string;
          scheduledAt?: string;
          notes?: string;
        };

      if (!amount) {
        res.status(400).json({ error: "Missing amount" });
        return;
      }

      const payout = await prisma.payout.create({
        data: {
          orgId,
          recipientId,
          description: description ?? null,
          notes: notes ?? null,
          amount: new Prisma.Decimal(amount),
          currency: currency ?? "KES",
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

  // Project financials for finance: allocated, received, remaining, and management (per month, duration)
  router.get(
    "/projects",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const projects = await prisma.project.findMany({
        where: { orgId, deletedAt: null, approvalStatus: "approved" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          price: true,
          amountReceived: true,
          managementMonthlyAmount: true,
          managementMonths: true
        }
      });
      const list = projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        allocated: p.price != null ? Number(p.price) : null,
        received: p.amountReceived != null ? Number(p.amountReceived) : 0,
        remaining: p.price != null ? Math.max(0, Number(p.price) - (p.amountReceived != null ? Number(p.amountReceived) : 0)) : null,
        managementMonthlyAmount: p.managementMonthlyAmount != null ? Number(p.managementMonthlyAmount) : null,
        managementMonths: p.managementMonths
      }));
      res.json(list);
    }
  );

  // Recalc project amountReceived from confirmed payments (for backfill / consistency)
  router.post(
    "/projects/recalc-received",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const payments = await prisma.payment.findMany({
        where: { orgId, deletedAt: null, status: "confirmed", invoiceId: { not: null } },
        include: { invoice: { select: { projectId: true } } }
      });
      const byProject = new Map<string, number>();
      for (const p of payments) {
        const pid = p.invoice?.projectId;
        if (pid) {
          byProject.set(pid, (byProject.get(pid) ?? 0) + Number(p.amount));
        }
      }
      for (const [projectId, total] of byProject) {
        await prisma.project.update({
          where: { id: projectId },
          data: { amountReceived: new Prisma.Decimal(total) }
        });
      }
      const projectsWithPrice = await prisma.project.findMany({
        where: { orgId, deletedAt: null, price: { not: null } },
        select: { id: true }
      });
      const zeroIds = projectsWithPrice
        .map((p) => p.id)
        .filter((id) => !byProject.has(id));
      if (zeroIds.length > 0) {
        await prisma.project.updateMany({
          where: { id: { in: zeroIds } },
          data: { amountReceived: new Prisma.Decimal(0) }
        });
      }
      res.json({ updated: byProject.size, zeroed: zeroIds.length });
    }
  );

  // Amount due per client (outstanding invoices) and reminder config
  router.get(
    "/clients/due",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const clients = await prisma.client.findMany({
        where: { orgId, deletedAt: null },
        include: {
          invoices: {
            where: {
              deletedAt: null,
              OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
            }
          }
        }
      });
      const paymentsByInvoice = await prisma.payment.findMany({
        where: { orgId, invoiceId: { not: null }, deletedAt: null, status: "confirmed" },
        select: { invoiceId: true, amount: true }
      });
      const paidByInvoice = new Map<string, number>();
      for (const p of paymentsByInvoice) {
        if (p.invoiceId) {
          const prev = paidByInvoice.get(p.invoiceId) ?? 0;
          paidByInvoice.set(p.invoiceId, prev + Number(p.amount));
        }
      }
      const list = clients.map((c) => {
        let amountDue = 0;
        for (const inv of c.invoices) {
          const paid = paidByInvoice.get(inv.id) ?? 0;
          amountDue += Number(inv.totalAmount) - paid;
        }
        return {
          clientId: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          amountDue,
          reminderDayOfMonth: c.reminderDayOfMonth,
          lastReminderAt: c.lastReminderAt?.toISOString() ?? null
        };
      }).filter((c) => c.amountDue > 0);
      list.sort((a, b) => b.amountDue - a.amountDue);
      res.json(list);
    }
  );

  router.patch(
    "/clients/:id/reminder",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { reminderDayOfMonth } = req.body as { reminderDayOfMonth?: number | null };
      const client = await prisma.client.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!client) {
        res.status(404).json({ error: "Client not found" });
        return;
      }
      const day = reminderDayOfMonth === null || reminderDayOfMonth === undefined
        ? null
        : Math.min(28, Math.max(1, Math.floor(Number(reminderDayOfMonth))));
      const updated = await prisma.client.update({
        where: { id },
        data: { reminderDayOfMonth: day }
      });
      res.json(updated);
    }
  );

  router.get(
    "/reminders",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const day = req.query.day != null ? Math.min(28, Math.max(1, Number(req.query.day))) : new Date().getDate();
      const clients = await prisma.client.findMany({
        where: { orgId, deletedAt: null, reminderDayOfMonth: day },
        include: {
          invoices: {
            where: {
              deletedAt: null,
              OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }]
            }
          }
        }
      });
      const paymentsByInvoice = await prisma.payment.findMany({
        where: { orgId, invoiceId: { not: null }, deletedAt: null, status: "confirmed" },
        select: { invoiceId: true, amount: true }
      });
      const paidByInvoice = new Map<string, number>();
      for (const p of paymentsByInvoice) {
        if (p.invoiceId) {
          const prev = paidByInvoice.get(p.invoiceId) ?? 0;
          paidByInvoice.set(p.invoiceId, prev + Number(p.amount));
        }
      }
      const list = clients.map((c) => {
        let amountDue = 0;
        for (const inv of c.invoices) {
          const paid = paidByInvoice.get(inv.id) ?? 0;
          amountDue += Number(inv.totalAmount) - paid;
        }
        return {
          clientId: c.id,
          name: c.name,
          email: c.email,
          amountDue,
          lastReminderAt: c.lastReminderAt?.toISOString() ?? null
        };
      }).filter((c) => c.amountDue > 0);
      res.json(list);
    }
  );

  router.post(
    "/reminders/send",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const day = new Date().getDate();
      const clients = await prisma.client.findMany({
        where: { orgId, deletedAt: null, reminderDayOfMonth: day }
      });
      const clientIds = clients.map((c) => c.id);
      if (clientIds.length === 0) {
        res.json({ sent: 0, message: "No clients due for reminder today" });
        return;
      }
      await prisma.client.updateMany({
        where: { id: { in: clientIds } },
        data: { lastReminderAt: new Date() }
      });
      res.json({ sent: clientIds.length, message: "Reminders marked as sent" });
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
    requireRoles([ROLE_KEYS.director]),
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

      const existing = await prisma.approval.findUnique({ where: { id } });
      if (!existing || existing.orgId !== orgId) {
        res.status(404).json({ error: "Approval not found" });
        return;
      }
      if (existing.entityType === "expense" || existing.entityType === "payout") {
        res.status(403).json({ error: "Only admin can approve payment/expense submissions. Director can view only." });
        return;
      }

      if (status === "approved") {
        try {
          await enforceApprovalConflicts(prisma, {
            orgId,
            userId,
            approval: existing
          });
        } catch {
          res.status(403).json({ error: "Approval blocked due to financial conflict of interest" });
          return;
        }
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

