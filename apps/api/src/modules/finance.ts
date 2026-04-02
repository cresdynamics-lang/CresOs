// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { logAdminActivity, logEmailSent } from "./admin-activity";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { enforceApprovalConflicts, enforcePaymentConfirmationConflicts } from "./conflict-engine";

export default function financeRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Get finance dashboard with invoice approvals
  router.get(
    "/dashboard",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director_admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;

        const [
          pendingInvoices,
          approvedInvoices,
          rejectedInvoices,
          totalRevenue,
          recentInvoices
        ] = await Promise.all([
          prisma.invoice.count({
            where: { 
              orgId,
              status: "PENDING"
            }
          }),
          prisma.invoice.count({
            where: { 
              orgId,
              status: "APPROVED"
            }
          }),
          prisma.invoice.count({
            where: { 
              orgId,
              status: "REJECTED"
            }
          }),
          prisma.invoice.aggregate({
            where: { 
              orgId,
              status: "APPROVED"
            },
            _sum: {
              totalAmount: true
            }
          }),
          prisma.invoice.findMany({
            where: { 
              orgId,
              status: "PENDING"
            },
            include: {
              client: true,
              project: true,
              createdBy: {
                select: { displayName: true }
              }
            },
            orderBy: { createdAt: "asc" },
            take: 10
          })
        ]);

        res.json({
          success: true,
          data: {
            stats: {
              pending: pendingInvoices,
              approved: approvedInvoices,
              rejected: rejectedInvoices,
              totalRevenue: totalRevenue._sum.totalAmount || 0
            },
            pendingInvoices: recentInvoices
          }
        });

      } catch (error) {
        console.error("Error fetching finance dashboard:", error);
        res.status(500).json({ 
          error: "Failed to fetch finance dashboard", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoices pending approval
  router.get(
    "/invoices/pending",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director_admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const { page = 1, limit = 20 } = req.query;

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where: { 
              orgId,
              status: "PENDING"
            },
            include: {
              client: true,
              project: true,
              items: true,
              createdBy: {
                select: { displayName: true }
              }
            },
            orderBy: { createdAt: "asc" },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
          }),
          prisma.invoice.count({
            where: { 
              orgId,
              status: "PENDING"
            }
          })
        ]);

        res.json({
          success: true,
          data: {
            invoices,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total,
              pages: Math.ceil(total / parseInt(limit))
            }
          }
        });

      } catch (error) {
        console.error("Error fetching pending invoices:", error);
        res.status(500).json({ 
          error: "Failed to fetch pending invoices", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Approve invoice
  router.post(
    "/invoices/:id/approve",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director_admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const approverId = req.auth!.userId;
        const { id } = req.params;
        const { notes } = req.body;

        // Check if invoice exists and is pending
        const invoice = await prisma.invoice.findFirst({
          where: {
            id,
            orgId,
            status: "PENDING"
          },
          include: {
            createdBy: {
              select: { id: true, displayName: true }
            }
          }
        });

        if (!invoice) {
          return res.status(404).json({ 
            error: "Invoice not found or already processed" 
          });
        }

        // Update invoice status
        const updatedInvoice = await prisma.invoice.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: {
              connect: { userId: approverId }
            },
            approvalNotes: notes || null
          },
          include: {
            client: true,
            project: true,
            items: true,
            approvedBy: {
              select: { displayName: true }
            },
            createdBy: {
              select: { displayName: true }
            }
          }
        });

        // Create notification for invoice creator
        await prisma.notification.create({
          data: {
            userId: invoice.createdBy.id,
            title: "Invoice Approved",
            message: `Invoice ${invoice.invoiceNumber} has been approved`,
            type: "INVOICE_APPROVED",
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              approvedBy: req.auth!.userName
            }
          }
        });

        res.json({
          success: true,
          message: "Invoice approved successfully",
          data: updatedInvoice
        });

      } catch (error) {
        console.error("Error approving invoice:", error);
        res.status(500).json({ 
          error: "Failed to approve invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Reject invoice
  router.post(
    "/invoices/:id/reject",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director_admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const approverId = req.auth!.userId;
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
          return res.status(400).json({ 
            error: "Rejection reason is required" 
          });
        }

        // Check if invoice exists and is pending
        const invoice = await prisma.invoice.findFirst({
          where: {
            id,
            orgId,
            status: "PENDING"
          },
          include: {
            createdBy: {
              select: { id: true, displayName: true }
            }
          }
        });

        if (!invoice) {
          return res.status(404).json({ 
            error: "Invoice not found or already processed" 
          });
        }

        // Update invoice status
        const updatedInvoice = await prisma.invoice.update({
          where: { id },
          data: {
            status: "REJECTED",
            approvedAt: new Date(),
            approvedBy: {
              connect: { userId: approverId }
            },
            rejectionReason: reason.trim()
          },
          include: {
            client: true,
            project: true,
            items: true,
            approvedBy: {
              select: { displayName: true }
            },
            createdBy: {
              select: { displayName: true }
            }
          }
        });

        // Create notification for invoice creator
        await prisma.notification.create({
          data: {
            userId: invoice.createdBy.id,
            title: "Invoice Rejected",
            message: `Invoice ${invoice.invoiceNumber} has been rejected`,
            type: "INVOICE_REJECTED",
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              rejectionReason: reason.trim(),
              rejectedBy: req.auth!.userName
            }
          }
        });

        res.json({
          success: true,
          message: "Invoice rejected successfully",
          data: updatedInvoice
        });

      } catch (error) {
        console.error("Error rejecting invoice:", error);
        res.status(500).json({ 
          error: "Failed to reject invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Generate approved invoice PDF
  router.post(
    "/invoices/:id/generate",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director_admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const { id } = req.params;

        // Check if invoice exists and is approved
        const invoice = await prisma.invoice.findFirst({
          where: {
            id,
            orgId,
            status: "APPROVED"
          },
          include: {
            client: true,
            project: true,
            items: true,
            approvedBy: {
              select: { displayName: true }
            }
          }
        });

        if (!invoice) {
          return res.status(404).json({ 
            error: "Invoice not found or not approved" 
          });
        }

        // Mark invoice as generated
        const updatedInvoice = await prisma.invoice.update({
          where: { id },
          data: {
            generatedAt: new Date(),
            generatedBy: {
              connect: { userId: req.auth!.userId }
            }
          }
        });

        // TODO: Generate actual PDF here
        // For now, just return success
        res.json({
          success: true,
          message: "Invoice generated successfully",
          data: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            downloadUrl: `/api/finance/invoices/${id}/pdf`
          }
        });

      } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).json({ 
          error: "Failed to generate invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

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
              status: { in: ["approved", "paid"] },
              spentAt: { gte: startOfMonth }
            }
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: { in: ["approved", "paid"] }
            }
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

  // Excel-style finance sheet for documenting money in/out with dynamic columns/rows
  router.get(
    "/sheet",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const latest = await prisma.adminActivityMessage.findFirst({
        where: { orgId, type: "finance_sheet_v1" },
        orderBy: { createdAt: "desc" }
      });

      // Default sheet template if none saved yet
      const defaultSheet = {
        status: "draft",
        columns: [
          { id: "date", label: "Date" },
          { id: "direction", label: "Money In/Out" },
          { id: "amount", label: "Amount" },
          { id: "currency", label: "Currency" },
          { id: "purpose", label: "Purpose" },
          { id: "reason", label: "Reason / Notes" },
          { id: "receipt", label: "Receipt / Proof" },
          { id: "counterparty", label: "From/To (Client, Vendor, Project)" }
        ],
        rows: [
          {
            id: "row-1",
            cells: {
              date: "",
              direction: "",
              amount: "",
              currency: "",
              purpose: "",
              reason: "",
              receipt: "",
              counterparty: ""
            }
          }
        ]
      };

      if (!latest || !latest.metadata) {
        res.json(defaultSheet);
        return;
      }

      const meta: any = latest.metadata;
      const sheet = meta.sheet ?? meta;

      res.json({
        status: meta.status ?? "draft",
        columns: Array.isArray(sheet.columns) ? sheet.columns : defaultSheet.columns,
        rows: Array.isArray(sheet.rows) ? sheet.rows : defaultSheet.rows
      });
    }
  );

  router.post(
    "/sheet",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;

      const { status, columns, rows } = (req.body || {}) as {
        status?: string;
        columns?: Array<{ id: string; label: string }>;
        rows?: Array<{ id: string; cells: Record<string, string> }>;
      };

      const safeStatus = status === "submitted" ? "submitted" : "draft";

      await logAdminActivity(prisma, {
        orgId,
        type: "finance_sheet_v1",
        summary: safeStatus === "submitted" ? "Finance sheet submitted" : "Finance sheet saved",
        actorId: userId,
        metadata: {
          status: safeStatus,
          sheet: {
            columns: columns ?? [],
            rows: rows ?? []
          }
        }
      });

      res.status(204).end();
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

      const client = await prisma.client.findFirst({
        where: { id: clientId, orgId, deletedAt: null },
        select: { id: true, name: true, email: true }
      });
      if (!client) {
        res.status(404).json({ error: "Client not found" });
        return;
      }

      const clientEmail = client.email?.trim() || "";

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

        if (clientEmail) {
          const greeting = client.name ? `Hello ${client.name},` : "Hello,";
          const body = `${greeting}\n\nInvoice ${invoice.number} has been issued.\nTotal: ${invoice.currency} ${totalAmount.toFixed(2)}.\n\nThank you.`;
          await tx.notification.create({
            data: {
              orgId,
              channel: "email",
              to: clientEmail,
              subject: `Invoice ${invoice.number}`,
              body,
              status: "queued",
              type: "invoice.sent",
              tier: "financial"
            }
          });
        }

        return invoice;
      });

      if (clientEmail) {
        await logEmailSent(prisma, {
          orgId,
          to: clientEmail,
          subject: `Invoice ${result.number}`,
          body: `Invoice ${result.number} queued for ${clientEmail}.`,
          type: "invoice.sent"
        });
      }
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
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, name: true, email: true } }
      }
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

  // Add invoice side panel functionality
  router.get(
    "/invoices",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        
        // Get invoice statistics
        const [
          totalInvoices,
          sentInvoices,
          paidInvoices,
          pendingInvoices,
          overdueInvoices,
          draftInvoices,
          totalRevenue,
          outstandingAmount
        ] = await Promise.all([
          prisma.invoice.count({
            where: { orgId, deletedAt: null }
          }),
          
          prisma.invoice.count({
            where: { orgId, deletedAt: null, status: "sent" }
          }),
          
          prisma.invoice.count({
            where: { orgId, deletedAt: null, status: "paid" }
          }),
          
          prisma.invoice.count({
            where: { 
              orgId, 
              deletedAt: null, 
              OR: [{ status: "sent" }, { status: "partial" }] 
            }
          }),
          
          prisma.invoice.count({
            where: { orgId, deletedAt: null, status: "overdue" }
          }),
          
          prisma.invoice.count({
            where: { orgId, deletedAt: null, status: "draft" }
          }),
          
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: { 
              orgId, 
              deletedAt: null, 
              status: "confirmed" 
            }
          }),
          
          prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: { 
              orgId, 
              deletedAt: null, 
              OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }] 
            }
          })
        ]);

        // Get recent invoices
        const recentInvoices = await prisma.invoice.findMany({
          where: { orgId, deletedAt: null },
          include: { 
            client: { select: { name: true } },
            project: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        });

        // Get monthly statistics for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const monthlyInvoices = await prisma.invoice.findMany({
          where: { 
            orgId, 
            deletedAt: null,
            createdAt: { gte: sixMonthsAgo }
          },
          select: {
            createdAt: true,
            totalAmount: true,
            status: true
          }
        });

        const monthlyStats = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          
          const monthInvoices = monthlyInvoices.filter(inv => 
            inv.createdAt >= monthStart && inv.createdAt <= monthEnd
          );
          
          monthlyStats.push({
            month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            invoices: monthInvoices.length,
            revenue: monthInvoices
              .filter(inv => inv.status === 'paid')
              .reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
          });
        }

        res.json({
          success: true,
          data: {
            totalInvoices,
            sentInvoices,
            paidInvoices,
            pendingInvoices,
            overdueInvoices,
            draftInvoices,
            totalRevenue: totalRevenue._sum.amount?.toNumber() || 0,
            outstandingAmount: outstandingAmount._sum.totalAmount?.toNumber() || 0,
            recentInvoices: recentInvoices.map(inv => ({
              id: inv.id,
              number: inv.number,
              clientName: inv.client.name,
              amount: Number(inv.totalAmount),
              status: inv.status,
              issueDate: inv.issueDate.toISOString().split('T')[0],
              dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : '',
              projectName: inv.project?.name || ''
            })),
            monthlyStats
          }
        });

      } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ 
          error: "Failed to fetch invoices", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoices by status
  router.get(
    "/invoices/:status",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const { status } = req.params;
        const orgId = req.auth!.orgId;
        const { page = 1, limit = 20, search = '' } = req.query;

        const whereClause: any = { orgId, deletedAt: null };
        
        // Filter by status
        if (status !== 'all') {
          if (status === 'pending') {
            whereClause.OR = [{ status: "sent" }, { status: "partial" }];
          } else {
            whereClause.status = status;
          }
        }

        // Add search filter
        if (search) {
          whereClause.OR = [
            { number: { contains: search, mode: 'insensitive' } },
            { client: { name: { contains: search, mode: 'insensitive' } } },
            { project: { name: { contains: search, mode: 'insensitive' } } }
          ];
        }

        const [invoices, totalCount] = await Promise.all([
          prisma.invoice.findMany({
            where: whereClause,
            include: {
              client: { select: { name: true, email: true, phone: true } },
              project: { select: { name: true } },
              items: { select: { description: true, quantity: true, unitPrice: true } },
              payments: {
                where: { deletedAt: null },
                select: { amount: true, status: true, receivedAt: true }
              }
            },
            orderBy: { createdAt: "desc" },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit)
          }),
          prisma.invoice.count({ where: whereClause })
        ]);

        // Calculate paid amount for each invoice
        const invoicesWithCalculations = invoices.map(invoice => {
          const paidAmount = invoice.payments
            .filter(p => p.status === 'confirmed')
            .reduce((sum, p) => sum + Number(p.amount), 0);
          
          return {
            ...invoice,
            paidAmount,
            balanceDue: Number(invoice.totalAmount) - paidAmount,
            totalAmount: Number(invoice.totalAmount)
          };
        });

        res.json({
          success: true,
          data: {
            invoices: invoicesWithCalculations,
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total: totalCount,
              pages: Math.ceil(totalCount / Number(limit))
            }
          }
        });

      } catch (error) {
        console.error("Error fetching invoices by status:", error);
        res.status(500).json({ 
          error: "Failed to fetch invoices", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Create new invoice
  router.post(
    "/invoices",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const createdBy = req.auth!.userId;
        const invoiceData = req.body;

        // Generate unique invoice number
        const { DocxTemplateParser } = require("../services/invoice/docx-parser");
        const docxParser = new DocxTemplateParser(
          '/Users/airm1/Projects/CresOs/apps/api/src/services/invoice/Invoice.docx'
        );
        
        const invoiceNumber = docxParser.generateInvoiceNumber(
          invoiceData.projectId || invoiceData.clientId,
          orgId
        );

        // Create invoice in database
        const invoice = await prisma.invoice.create({
          data: {
            orgId,
            clientId: invoiceData.clientId,
            projectId: invoiceData.projectId || null,
            number: invoiceNumber,
            status: "sent",
            issueDate: new Date(invoiceData.issueDate),
            dueDate: new Date(invoiceData.dueDate),
            currency: invoiceData.currency || "KES",
            totalAmount: invoiceData.items.reduce(
              (sum: number, item: any) => sum + (Number(item.unitPrice) * item.quantity), 
              0
            ),
            createdAt: new Date(),
            updatedAt: new Date()
          },
          include: {
            client: { select: { name: true, email: true, phone: true } },
            project: { select: { name: true } }
          }
        });

        // Create invoice items
        await prisma.invoiceItem.createMany({
          data: invoiceData.items.map((item: any, index: number) => ({
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            total: Number(item.unitPrice) * item.quantity
          }))
        });

        // Generate PDF
        const { PDFGenerator } = require("../services/invoice/pdf-generator");
        const { FinanceInvoiceService } = require("../services/invoice/finance-integration");
        
        const financeService = new FinanceInvoiceService(prisma);
        const { pdfBuffer } = await financeService.generateInvoicePDF({
          invoice_number: invoice.number,
          invoice_date: invoice.issueDate.toISOString().split('T')[0],
          due_date: invoice.dueDate.toISOString().split('T')[0],
          status: invoice.status,
          currency: invoice.currency,
          client: {
            id: invoice.clientId,
            name: invoice.client.name,
            email: invoice.client.email,
            phone: invoice.client.phone
          },
          company: {
            name: "CresOS Solutions Ltd",
            email: "info@cresos.com",
            phone: "+254-700-123456"
          },
          project: invoice.project ? {
            id: invoice.projectId!,
            name: invoice.project.name
          } : undefined,
          items: invoiceData.items.map((item: any) => ({
            id: `item-${index}`,
            name: item.description,
            description: item.description,
            quantity: item.quantity,
            unit_price: Number(item.unitPrice),
            total_price: Number(item.unitPrice) * item.quantity,
            type: 'service' as const,
            category: 'general'
          })),
          summary: {
            subtotal: Number(invoice.totalAmount),
            tax_rate: 0,
            tax_amount: 0,
            total_amount: Number(invoice.totalAmount),
            balance_due: Number(invoice.totalAmount)
          },
          payment_terms: {
            due_in_days: 7
          },
          notes: {
            client_message: "Thank you for your business! Payment is due within 7 days."
          },
          automation: {
            auto_reminders_enabled: true,
            reminder_schedule: [3, 1],
            late_fee_enabled: false
          },
          created_at: invoice.createdAt.toISOString(),
          updated_at: invoice.updatedAt.toISOString(),
          created_by: createdBy,
          organization_id: orgId
        } as any);

        res.status(201).json({
          success: true,
          message: `Invoice ${invoice.number} created successfully`,
          data: {
            invoice,
            pdfGenerated: true,
            pdfSize: `${(pdfBuffer.length / 1024).toFixed(2)} KB`
          }
        });

      } catch (error) {
        console.error("Error creating invoice:", error);
        res.status(500).json({ 
          error: "Failed to create invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoice PDF
  router.get(
    "/invoices/:invoiceId/pdf",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const invoiceIdStr = Array.isArray(invoiceId) ? invoiceId[0] : invoiceId;
        const orgId = req.auth!.orgId;

        const invoice = await prisma.invoice.findFirst({
          where: { id: invoiceIdStr, orgId, deletedAt: null },
          include: {
            client: { select: { name: true, email: true, phone: true } },
            project: { select: { name: true } },
            items: true
          }
        });

        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }

        // Generate PDF
        const { PDFGenerator } = require("../services/invoice/pdf-generator");
        const pdfGenerator = new PDFGenerator({
          filename: `${invoice.number}.pdf`,
          format: 'A4',
          margin: { top: 40, right: 40, bottom: 40, left: 40 }
        });

        const pdfBuffer = await pdfGenerator.generatePDF({
          invoice_number: invoice.number,
          invoice_date: invoice.issueDate.toISOString().split('T')[0],
          due_date: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : '',
          status: invoice.status,
          currency: invoice.currency,
          client: {
            id: invoice.clientId,
            name: invoice.client.name,
            email: invoice.client.email,
            phone: invoice.client.phone
          },
          company: {
            name: "CresOS Solutions Ltd",
            email: "info@cresos.com",
            phone: "+254-700-123456"
          },
          project: invoice.project ? {
            id: invoice.projectId!,
            name: invoice.project.name
          } : undefined,
          items: invoice.items.map((item, index) => ({
            id: item.id,
            name: item.description,
            description: item.description,
            quantity: item.quantity,
            unit_price: Number(item.unitPrice),
            total_price: Number(item.total),
            type: 'service' as const,
            category: 'general'
          })),
          summary: {
            subtotal: Number(invoice.totalAmount),
            tax_rate: 0,
            tax_amount: 0,
            total_amount: Number(invoice.totalAmount),
            balance_due: Number(invoice.totalAmount)
          },
          payment_terms: {
            due_in_days: 7
          },
          notes: {
            client_message: "Thank you for your business! Payment is due within 7 days."
          },
          automation: {
            auto_reminders_enabled: true,
            reminder_schedule: [3, 1],
            late_fee_enabled: false
          },
          created_at: invoice.createdAt.toISOString(),
          updated_at: invoice.updatedAt.toISOString(),
          created_by: 'system',
          organization_id: orgId
        } as any);

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);

      } catch (error) {
        console.error("Error generating invoice PDF:", error);
        res.status(500).json({ 
          error: "Failed to generate PDF", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  return router;
}

