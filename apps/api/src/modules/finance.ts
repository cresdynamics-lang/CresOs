// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { logAdminActivity, logEmailSent } from "./admin-activity";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { enforceApprovalConflicts } from "./conflict-engine";
import { CRES_DYNAMICS_PDF_COMPANY } from "../lib/company-pdf";
import { generateInvoicePdfBuffer } from "../lib/invoice-pdf";
import { deliverFinanceInvoiceEmail } from "../lib/invoice-email";
import {
  notifyAdminsExpenseCreated,
  runPaymentConfirmedNotifications
} from "../lib/finance-workflow";

const INVOICE_PDF_COMPANY = CRES_DYNAMICS_PDF_COMPANY;
import { allocateInvoiceNumberForCreate } from "../services/invoice/invoice-number";
import { billableMonthsUtc, ymKey } from "../lib/management-billing";

/** Avoid Invalid Date from empty due-date strings (breaks Prisma / Postgres). */
function parseInvoiceDueDate(raw: string | undefined | null): Date | null {
  if (raw == null || String(raw).trim() === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePaymentAmount(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (Number.isNaN(n) || n <= 0) return null;
  return n.toFixed(2);
}

/** Avoid noon UTC for date-only inputs so payments fall in the intended calendar day across zones. */
function parsePaymentReceivedAt(raw: unknown): Date | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T12:00:00.000Z`);
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Confirm a pending payment and roll invoice/project side effects (run inside `prisma.$transaction`). */
async function confirmPaymentCore(
  tx: Prisma.TransactionClient,
  payment: {
    id: string;
    invoiceId: string | null;
    howToProceed: string | null;
    amount: Prisma.Decimal;
  },
  fields: { source: string; account: string; reference: string; howToProceed?: string | null }
): Promise<{ invoiceStatus?: string; invoiceNumber?: string; paidTotal?: number; invoiceTotal?: number }> {
  const sourceVal = fields.source.trim();
  const accountVal = fields.account.trim();
  const referenceVal = fields.reference.trim();
  const howToProceedVal =
    fields.howToProceed !== undefined ? fields.howToProceed : payment.howToProceed;
  const amountNum = Number(payment.amount);

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      source: sourceVal,
      account: accountVal,
      reference: referenceVal,
      howToProceed: howToProceedVal ?? null,
      status: "confirmed"
    }
  });

  if (!payment.invoiceId) return {};

  const inv = await tx.invoice.findUnique({
    where: { id: payment.invoiceId },
    select: { projectId: true, totalAmount: true, number: true, orgId: true }
  });
  if (!inv) return {};

  if (inv.projectId) {
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

  const paidOnInvoice = await tx.payment.aggregate({
    where: {
      invoiceId: payment.invoiceId,
      status: "confirmed",
      deletedAt: null
    },
    _sum: { amount: true }
  });
  const invoiceTotal = Number(inv.totalAmount);
  const paidTotal = Number(paidOnInvoice._sum.amount ?? 0);
  let nextStatus = "sent";
  if (invoiceTotal > 0 && paidTotal >= invoiceTotal - 0.01) nextStatus = "paid";
  else if (paidTotal > 0) nextStatus = "partial";

  await tx.invoice.update({
    where: { id: payment.invoiceId },
    data: { status: nextStatus }
  });

  if (nextStatus === "paid") {
    await tx.projectManagementMonth.updateMany({
      where: { orgId: inv.orgId, invoiceId: payment.invoiceId, paid: false },
      data: { paid: true, paidAt: new Date() }
    });
  }

  return {
    invoiceStatus: nextStatus,
    invoiceNumber: inv.number,
    paidTotal,
    invoiceTotal
  };
}

async function sumConfirmedPaymentsOnInvoice(
  client: PrismaClient | Prisma.TransactionClient,
  invoiceId: string
): Promise<number> {
  const paidOnInvoice = await client.payment.aggregate({
    where: { invoiceId, status: "confirmed", deletedAt: null },
    _sum: { amount: true }
  });
  return Number(paidOnInvoice._sum.amount ?? 0);
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    bank: "Bank",
    card: "Card",
    mpesa: "M-Pesa",
    cash: "Cash"
  };
  return labels[method] ?? method;
}

function resolveInvoicePaymentConfirmFields(
  payment: { method: string; id: string },
  invoice: { number: string },
  fields: {
    source?: string | null;
    account?: string | null;
    reference?: string | null;
    mpesaRef?: string | null;
    howToProceed?: string | null;
  }
): { source: string; account: string; reference: string; howToProceed: string | null } {
  const sourceVal = (fields.source ?? "").trim() || "Client payment";
  const accountVal = (fields.account ?? "").trim() || paymentMethodLabel(payment.method);
  const referenceVal =
    (fields.reference ?? "").trim() ||
    (fields.mpesaRef ?? "").trim() ||
    `INV-${invoice.number}-${payment.id.slice(-6).toUpperCase()}`;
  const howToProceedVal = (fields.howToProceed ?? "").trim() || `Matched to invoice ${invoice.number}`;
  return { source: sourceVal, account: accountVal, reference: referenceVal, howToProceed: howToProceedVal };
}

/** Create + confirm a payment for any remaining invoice balance (used when marking management month paid). */
async function recordConfirmedInvoicePayment(
  tx: Prisma.TransactionClient,
  orgId: string,
  userId: string,
  invoiceId: string,
  opts: { receivedAt?: Date; method?: string; reference?: string; notes?: string }
): Promise<{ created: boolean; paymentId?: string; amount?: number }> {
  const inv = await tx.invoice.findFirst({
    where: { id: invoiceId, orgId, deletedAt: null },
    select: { id: true, number: true, totalAmount: true, projectId: true }
  });
  if (!inv) return { created: false };

  const paidTotal = await sumConfirmedPaymentsOnInvoice(tx, invoiceId);
  const invoiceTotal = Number(inv.totalAmount);
  const remaining = Math.round((invoiceTotal - paidTotal) * 100) / 100;
  if (!(remaining > 0)) return { created: false };

  const receivedAt = opts.receivedAt ?? new Date();
  const method = opts.method ?? "bank";
  const payment = await tx.payment.create({
    data: {
      orgId,
      invoiceId,
      createdByUserId: userId,
      amount: new Prisma.Decimal(remaining.toFixed(2)),
      currency: "KES",
      method,
      reference: opts.reference?.trim() || `INV-${inv.number}`,
      notes: opts.notes ?? `Management month marked paid — invoice ${inv.number}`,
      source: "Client payment",
      account: paymentMethodLabel(method),
      howToProceed: `Matched to invoice ${inv.number}`,
      receivedAt,
      status: "pending"
    }
  });

  const confirmFields = resolveInvoicePaymentConfirmFields(
    payment,
    inv,
    {
      source: "Client payment",
      account: paymentMethodLabel(method),
      reference: opts.reference ?? `INV-${inv.number}`,
      howToProceed: `Matched to invoice ${inv.number}`
    }
  );

  await confirmPaymentCore(
    tx,
    {
      id: payment.id,
      invoiceId: payment.invoiceId,
      howToProceed: payment.howToProceed,
      amount: payment.amount
    },
    confirmFields
  );

  return { created: true, paymentId: payment.id, amount: remaining };
}

export default function financeRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Get finance dashboard with invoice approvals
  router.get(
    "/dashboard",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
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
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
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

  // Approve invoice (money matters — org admin only)
  router.post(
    "/invoices/:id/approve",
    requireRoles([ROLE_KEYS.admin]),
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

  // Reject invoice (money matters — org admin only)
  router.post(
    "/invoices/:id/reject",
    requireRoles([ROLE_KEYS.admin]),
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

  // Generate approved invoice PDF (money matters — org admin only)
  router.post(
    "/invoices/:id/generate",
    requireRoles([ROLE_KEYS.admin]),
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

  // Real-time financial report — finance & admin only (aggregate money stats)
  router.get(
    "/report",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      /** Calendar month boundaries in UTC so period revenue/expenses match stored timestamps reliably. */
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const startOfMonthUtc = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const startOfNextMonthUtc = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));

      try {
        const [
          revenueThisMonth,
          revenueAllTime,
          overdueInvoicesCount,
          expensesThisMonth,
          expensesAllTime,
          pendingPayoutsSum,
          payoutsPaidThisMonth,
          payoutsPaidAllTime,
          invoiceCountByStatus,
          approvedProjects,
          openInvoicesForAr,
          pendingApprovalQueue,
          pendingPaymentsCount
        ] = await Promise.all([
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              status: "confirmed",
              receivedAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
            }
          }),
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: { orgId, deletedAt: null, status: "confirmed" }
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
              spentAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
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
          prisma.payout.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              paidAt: { gte: startOfMonthUtc, lt: startOfNextMonthUtc }
            }
          }),
          prisma.payout.aggregate({
            _sum: { amount: true },
            where: {
              orgId,
              deletedAt: null,
              paidAt: { not: null }
            }
          }),
          prisma.invoice.groupBy({
            by: ["status"],
            _count: { id: true },
            where: { orgId, deletedAt: null }
          }),
          prisma.project.findMany({
            where: { orgId, deletedAt: null, approvalStatus: "approved" },
            select: { price: true, amountReceived: true }
          }),
          prisma.invoice.findMany({
            where: {
              orgId,
              deletedAt: null,
              status: { in: ["sent", "partial", "overdue"] }
            },
            select: {
              totalAmount: true,
              payments: {
                where: { deletedAt: null, status: "confirmed" },
                select: { amount: true }
              }
            }
          }),
          prisma.approval.count({
            where: {
              orgId,
              status: "pending",
              entityType: { in: ["expense", "payout"] }
            }
          }),
          prisma.payment.count({
            where: { orgId, deletedAt: null, status: "pending" }
          })
        ]);

        const revMonth = revenueThisMonth._sum.amount?.toNumber() ?? 0;
        const revAll = revenueAllTime._sum.amount?.toNumber() ?? 0;
        const expMonth = expensesThisMonth._sum.amount?.toNumber() ?? 0;
        const expAll = expensesAllTime._sum.amount?.toNumber() ?? 0;
        const pendingPayouts = pendingPayoutsSum._sum.amount?.toNumber() ?? 0;
        const payoutPaidMonth = payoutsPaidThisMonth._sum.amount?.toNumber() ?? 0;
        const payoutPaidAll = payoutsPaidAllTime._sum.amount?.toNumber() ?? 0;
        const totalOutMonth = expMonth + payoutPaidMonth;
        const totalOutAll = expAll + payoutPaidAll;

        let projectsTotalContract = 0;
        let projectsTotalReceived = 0;
        let projectsRemaining = 0;
        for (const p of approvedProjects) {
          if (p.price != null) {
            const price = Number(p.price);
            const rec = p.amountReceived != null ? Number(p.amountReceived) : 0;
            projectsTotalContract += price;
            projectsTotalReceived += rec;
            projectsRemaining += Math.max(0, price - rec);
          } else if (p.amountReceived != null) {
            projectsTotalReceived += Number(p.amountReceived);
          }
        }

        let openInvoiceRemaining = 0;
        for (const inv of openInvoicesForAr) {
          const total = Number(inv.totalAmount);
          const paid = inv.payments.reduce((s, pay) => s + Number(pay.amount), 0);
          openInvoiceRemaining += Math.max(0, total - paid);
        }

        /** Prefer remaining contract value on approved projects; if none priced, use open invoice AR. */
        const outstandingAmount =
          projectsRemaining > 0 ? projectsRemaining : openInvoiceRemaining;
        const pendingTotal = pendingApprovalQueue + pendingPaymentsCount;

        res.json({
          generatedAt: now.toISOString(),
          period: {
            startOfMonth: startOfMonthUtc.toISOString(),
            endOfMonth: now.toISOString(),
            /** Exclusive upper bound for month filters (UTC). */
            monthEndExclusive: startOfNextMonthUtc.toISOString()
          },
          revenue: { thisMonth: revMonth, allTime: revAll },
          invoices: {
            outstandingAmount,
            openInvoiceRemaining,
            overdueCount: overdueInvoicesCount,
            byStatus: invoiceCountByStatus.map((g) => ({ status: g.status, count: g._count.id }))
          },
          projects: {
            approvedCount: approvedProjects.length,
            totalContractValue: projectsTotalContract,
            totalReceived: projectsTotalReceived,
            totalRemaining: projectsRemaining
          },
          expenses: { thisMonth: expMonth, allTime: expAll },
          payouts: {
            pendingAmount: pendingPayouts,
            paidThisMonth: payoutPaidMonth,
            paidAllTime: payoutPaidAll
          },
          cashFlow: {
            revenueThisMonth: revMonth,
            expensesThisMonth: expMonth,
            payoutsThisMonth: payoutPaidMonth,
            totalOutflowsThisMonth: totalOutMonth,
            netThisMonth: revMonth - totalOutMonth
          },
          derived: {
            /** Confirmed cash in minus approved expenses and paid payouts (UTC calendar month). */
            netCashMovementThisMonth: revMonth - totalOutMonth,
            netCashMovementAllTime: revAll - totalOutAll
          },
          pending: {
            approvalQueue: pendingApprovalQueue,
            paymentsPending: pendingPaymentsCount,
            total: pendingTotal
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ error: "Failed to generate financial report" });
      }
    }
  );

  /** Unified money-in / money-out feed (finance & admin). */
  router.get(
    "/ledger",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const rawLimit = parseInt(String(req.query.limit ?? "200"), 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200;

      try {
        const [payments, expenses, payouts] = await Promise.all([
          prisma.payment.findMany({
            where: { orgId, deletedAt: null },
            orderBy: { receivedAt: "desc" },
            take: limit,
            select: {
              id: true,
              receivedAt: true,
              amount: true,
              currency: true,
              status: true,
              method: true,
              source: true,
              reference: true,
              account: true,
              notes: true,
              invoiceId: true,
              invoice: { select: { number: true } }
            }
          }),
          prisma.expense.findMany({
            where: { orgId, deletedAt: null },
            orderBy: { spentAt: "desc" },
            take: limit,
            select: {
              id: true,
              spentAt: true,
              amount: true,
              currency: true,
              status: true,
              category: true,
              description: true,
              notes: true
            }
          }),
          prisma.payout.findMany({
            where: { orgId, deletedAt: null },
            orderBy: [{ paidAt: "desc" }, { scheduledAt: "desc" }, { createdAt: "desc" }],
            take: limit,
            select: {
              id: true,
              amount: true,
              currency: true,
              description: true,
              notes: true,
              paidAt: true,
              scheduledAt: true,
              createdAt: true
            }
          })
        ]);

        type Row = {
          kind: string;
          id: string;
          at: string;
          amount: number;
          currency: string;
          direction: "in" | "out";
          status: string;
          label: string;
          detail: string | null;
        };

        const rows: Row[] = [];

        for (const p of payments) {
          rows.push({
            kind: "payment",
            id: p.id,
            at: p.receivedAt.toISOString(),
            amount: Number(p.amount),
            currency: p.currency,
            direction: "in",
            status: p.status,
            label: p.status === "confirmed" ? "Payment in (confirmed)" : "Payment in (pending)",
            detail:
              [
                p.invoice?.number ? `Invoice ${p.invoice.number}` : null,
                p.method,
                p.source,
                p.reference,
                p.account,
                p.notes?.slice(0, 120)
              ]
                .filter(Boolean)
                .join(" · ") || null
          });
        }

        for (const e of expenses) {
          rows.push({
            kind: "expense",
            id: e.id,
            at: e.spentAt.toISOString(),
            amount: Number(e.amount),
            currency: e.currency,
            direction: "out",
            status: e.status,
            label: `Expense · ${e.category}`,
            detail: e.description ?? e.notes ?? null
          });
        }

        for (const po of payouts) {
          const at = po.paidAt ?? po.scheduledAt ?? po.createdAt;
          const paid = po.paidAt != null;
          rows.push({
            kind: "payout",
            id: po.id,
            at: at.toISOString(),
            amount: Number(po.amount),
            currency: po.currency,
            direction: "out",
            status: paid ? "paid" : "pending",
            label: paid ? "Payout (paid)" : "Payout (scheduled)",
            detail: po.description ?? po.notes ?? null
          });
        }

        rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        res.json({ rows: rows.slice(0, limit), generatedAt: new Date().toISOString() });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ error: "Failed to load ledger" });
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
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const invoices = await prisma.invoice.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { issueDate: "desc" },
      include: { project: { select: { id: true, name: true } } }
    });
    const enriched = await Promise.all(
      invoices.map(async (inv) => {
        const paidAmount = await sumConfirmedPaymentsOnInvoice(prisma, inv.id);
        const total = Number(inv.totalAmount);
        const amountRemaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
        return {
          ...inv,
          paidAmount,
          amountRemaining,
          totalAmount: total
        };
      })
    );
    res.json(enriched);
    }
  );

  router.post(
    "/invoices",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { clientId, projectId, issueDate, dueDate, currency, items, notes } =
        req.body as {
          clientId: string;
          projectId?: string;
          issueDate: string;
          dueDate?: string;
          currency?: string;
          notes?: string | null;
          items: { description: string; quantity: number; unitPrice: string | number }[];
        };

      const normalizedItems = (items ?? [])
        .map((it) => ({
          description: String(it.description ?? "").trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitPrice: String(it.unitPrice ?? "").trim()
        }))
        .filter((it) => it.description && it.unitPrice && !Number.isNaN(Number(it.unitPrice)));

      if (!clientId || !issueDate || normalizedItems.length === 0) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      try {
        const client = await prisma.client.findFirst({
          where: { id: clientId, orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        });
        if (!client) {
          res.status(404).json({ error: "Client not found" });
          return;
        }

        const issue = new Date(issueDate);
        if (Number.isNaN(issue.getTime())) {
          res.status(400).json({ error: "Invalid issue date", message: "Invalid issue date" });
          return;
        }

        const clientEmail = client.email?.trim() || "";

        const result = await prisma.$transaction(
          async (tx) => {
          const totalAmount = normalizedItems.reduce((sum, item) => {
            const value = Number(item.unitPrice) * item.quantity;
            return sum + value;
          }, 0);

          if (projectId) {
            const project = await tx.project.findFirst({
              where: { id: projectId, orgId, deletedAt: null },
              select: { id: true }
            });
            if (!project) {
              throw Object.assign(new Error("Project not found"), { code: "PROJECT_NOT_FOUND" });
            }
          }

          const number = await allocateInvoiceNumberForCreate(tx, orgId, projectId, issue);

          const invoice = await tx.invoice.create({
            data: {
              orgId,
              clientId,
              projectId,
              number,
              status: "sent",
              issueDate: issue,
              dueDate: parseInvoiceDueDate(dueDate),
              currency: currency ?? "KES",
              totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
              notes: notes?.trim() ? notes.trim() : null
            }
          });

          await tx.invoiceItem.createMany({
            data: normalizedItems.map((item) => ({
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity,
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

          return invoice;
        },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000
          }
        );

        if (clientEmail) {
          try {
            const emailResult = await deliverFinanceInvoiceEmail(prisma, {
              orgId,
              invoiceId: result.id,
              to: clientEmail,
              clientName: client.name
            });
            if (emailResult.ok) {
              await logEmailSent(prisma, {
                orgId,
                to: clientEmail,
                subject: `Invoice ${result.number} from Cres Dynamics`,
                body: `Invoice ${result.number} sent with PDF attachment to ${clientEmail}.`,
                type: "invoice.sent"
              });
            } else {
              console.error("Invoice email failed:", emailResult.error);
            }
          } catch (logErr) {
            console.error("deliverFinanceInvoiceEmail after invoice create:", logErr);
          }
        }

        const invoiceJson = {
          id: result.id,
          orgId: result.orgId,
          clientId: result.clientId,
          projectId: result.projectId,
          number: result.number,
          status: result.status,
          issueDate: result.issueDate,
          dueDate: result.dueDate,
          currency: result.currency,
          totalAmount: Number(result.totalAmount),
          notes: result.notes ?? null,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt
        };

        res.status(201).json({
          success: true,
          data: {
            invoice: invoiceJson,
            downloadUrl: `/finance/invoices/${result.id}/pdf`,
            emailSent: Boolean(clientEmail)
          }
        });
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err?.code === "PROJECT_NOT_FOUND" || err?.message === "Project not found") {
          res.status(400).json({ error: "Project not found" });
          return;
        }
        if (err?.code === "BAD_ISSUE_DATE") {
          res.status(400).json({ error: "Invalid issue date", message: err.message });
          return;
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === "P2002") {
            res.status(409).json({
              error: "Duplicate invoice number",
              message:
                "An invoice with this number already exists for this project. Try again in a moment or contact support."
            });
            return;
          }
          console.error("POST /finance/invoices Prisma:", e.code, e.message);
          res.status(500).json({
            error: "Failed to create invoice",
            message: e.message
          });
          return;
        }
        if (e instanceof Prisma.PrismaClientValidationError) {
          res.status(400).json({
            error: "Invalid invoice data",
            message: e.message
          });
          return;
        }
        console.error("POST /finance/invoices:", e);
        res.status(500).json({
          error: "Failed to create invoice",
          message: e instanceof Error ? e.message : "Unknown error"
        });
      }
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
      orderBy: { receivedAt: "desc" },
      include: { invoice: { include: { project: { select: { id: true, name: true } } } } }
    });
    res.json(payments);
    }
  );

  const PAYMENT_METHODS = ["bank", "card", "mpesa", "cash"] as const;

  router.post(
    "/payments",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const {
        invoiceId,
        amount,
        currency,
        method: rawMethod,
        reference,
        mpesaRef,
        receivedAt,
        notes,
        source,
        account,
        howToProceed,
        confirm
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
        account?: string;
        howToProceed?: string;
        /** When linked to an invoice, default true — confirms payment and records cash-in. */
        confirm?: boolean;
      };

      const normalizedAmount = normalizePaymentAmount(amount);
      const receivedAtDate = parsePaymentReceivedAt(receivedAt);
      if (!normalizedAmount || !rawMethod || !receivedAtDate) {
        res.status(400).json({
          error: "Missing or invalid fields",
          message: "Provide a positive amount, valid received date, and method."
        });
        return;
      }
      const method = rawMethod === "bank_transfer" ? "bank" : rawMethod.toLowerCase();
      if (!PAYMENT_METHODS.includes(method as typeof PAYMENT_METHODS[number])) {
        res.status(400).json({ error: "method must be one of: bank, card, mpesa, cash" });
        return;
      }

      let linkedInvoice: { id: string; number: string; totalAmount: Prisma.Decimal } | null = null;
      if (invoiceId) {
        linkedInvoice = await prisma.invoice.findFirst({
          where: { id: invoiceId, orgId, deletedAt: null },
          select: { id: true, number: true, totalAmount: true }
        });
        if (!linkedInvoice) {
          res.status(400).json({ error: "Invoice not found", message: "Invoice must belong to your organization." });
          return;
        }
        const paidSoFar = await sumConfirmedPaymentsOnInvoice(prisma, invoiceId);
        const invoiceTotal = Number(linkedInvoice.totalAmount);
        const payAmount = Number(normalizedAmount);
        const remaining = Math.max(0, Math.round((invoiceTotal - paidSoFar) * 100) / 100);
        if (payAmount > remaining + 0.01) {
          res.status(400).json({
            error: "Payment exceeds invoice balance",
            message: `Invoice ${linkedInvoice.number} has ${remaining.toFixed(2)} KES remaining; you entered ${payAmount.toFixed(2)}.`
          });
          return;
        }
      }

      const refForConfirm = (reference?.trim() || mpesaRef?.trim() || "").trim();
      const sourceTrim = (source ?? "").trim();
      const accountTrim = (account ?? "").trim();
      const wantsConfirm = confirm !== false;
      const autoConfirmManual = Boolean(sourceTrim && accountTrim && refForConfirm);
      /** Invoice payments are always confirmed so status, project received, and cash flow stay in sync. */
      const autoConfirmInvoice = Boolean(linkedInvoice);
      const autoConfirm = autoConfirmManual || autoConfirmInvoice;

      const invoiceRef = linkedInvoice ? `INV-${linkedInvoice.number}` : null;
      const paymentReference =
        reference?.trim() || mpesaRef?.trim() || invoiceRef || null;

      let payment = await prisma.payment.create({
        data: {
          orgId,
          invoiceId: invoiceId || null,
          createdByUserId: userId,
          amount: new Prisma.Decimal(normalizedAmount),
          currency: currency ?? "KES",
          method,
          reference: paymentReference,
          mpesaRef: mpesaRef?.trim() ? mpesaRef.trim() : null,
          notes: linkedInvoice
            ? [notes?.trim(), `Payment for invoice ${linkedInvoice.number}`].filter(Boolean).join(" — ") ||
              `Payment for invoice ${linkedInvoice.number}`
            : notes ?? null,
          source: sourceTrim || null,
          account: accountTrim || null,
          howToProceed: howToProceed?.trim()
            ? howToProceed.trim()
            : linkedInvoice
              ? `Matched to invoice ${linkedInvoice.number}`
              : null,
          receivedAt: receivedAtDate
        }
      });

      if (autoConfirm) {
        const confirmFields = linkedInvoice
          ? resolveInvoicePaymentConfirmFields(payment, linkedInvoice, {
              source,
              account,
              reference,
              mpesaRef,
              howToProceed
            })
          : {
              source: sourceTrim,
              account: accountTrim,
              reference: refForConfirm,
              howToProceed: howToProceed?.trim() || null
            };

        await prisma.eventLog.create({
          data: {
            orgId,
            type: "payment.received",
            entityType: "payment",
            entityId: payment.id,
            metadata: { invoiceId: payment.invoiceId, method: payment.method }
          }
        });

        let invoiceApply: Awaited<ReturnType<typeof confirmPaymentCore>> = {};
        await prisma.$transaction(async (tx) => {
          invoiceApply = await confirmPaymentCore(
            tx,
            {
              id: payment.id,
              invoiceId: payment.invoiceId,
              howToProceed: payment.howToProceed,
              amount: payment.amount
            },
            confirmFields
          );
        });

        await prisma.eventLog.create({
          data: {
            orgId,
            type: "payment.confirmed",
            entityType: "payment",
            entityId: payment.id,
            metadata: {
              source: confirmFields.source,
              account: confirmFields.account,
              reference: confirmFields.reference,
              auto: true,
              invoiceMatched: Boolean(linkedInvoice),
              invoiceNumber: invoiceApply.invoiceNumber ?? null,
              invoiceStatus: invoiceApply.invoiceStatus ?? null
            }
          }
        });

        runPaymentConfirmedNotifications(prisma, orgId, payment.id);

        payment =
          (await prisma.payment.findUnique({
            where: { id: payment.id },
            include: { invoice: { include: { project: { select: { id: true, name: true } } } } }
          })) ?? payment;

        const paidAmount =
          payment.invoiceId != null
            ? await sumConfirmedPaymentsOnInvoice(prisma, payment.invoiceId)
            : undefined;

        res.status(201).json({
          success: true,
          payment,
          invoiceApplied: linkedInvoice
            ? {
                id: linkedInvoice.id,
                number: linkedInvoice.number,
                status: invoiceApply.invoiceStatus ?? payment.invoice?.status ?? "sent",
                paidAmount,
                amountRemaining: Math.max(
                  0,
                  Number(linkedInvoice.totalAmount) - (paidAmount ?? 0)
                ),
                reference: confirmFields.reference
              }
            : null,
          message: linkedInvoice
            ? invoiceApply.invoiceStatus === "paid"
              ? `Payment recorded — invoice ${linkedInvoice.number} marked paid and added to cash flow.`
              : `Payment recorded — invoice ${linkedInvoice.number} updated (${invoiceApply.invoiceStatus ?? "partial"}).`
            : "Payment recorded and confirmed."
        });
        return;
      }

      if (linkedInvoice) {
        res.status(400).json({
          error: "Invoice payment could not be confirmed",
          message: "Linked invoice payments must be confirmed on save. Try again or contact support."
        });
        return;
      }

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
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
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

  // Delete payment (pending only)
  router.delete(
    "/payments/:id",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const payment = await prisma.payment.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }
      if (payment.status !== "pending") {
        res.status(403).json({ error: "Only pending payments can be deleted" });
        return;
      }
      await prisma.payment.update({ where: { id }, data: { deletedAt: new Date() } });
      await prisma.eventLog.create({
        data: { orgId, type: "payment.deleted", entityType: "payment", entityId: id }
      });
      res.json({ success: true });
    }
  );

  // Confirm payment: require where from, transaction code, which account, how to proceed
  router.post(
    "/payments/:id/confirm",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { source, account, reference, howToProceed } = req.body as {
        source?: string;
        account?: string;
        reference?: string;
        howToProceed?: string;
      };

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

      const linkedInv = payment.invoiceId
        ? await prisma.invoice.findFirst({
            where: { id: payment.invoiceId, orgId, deletedAt: null },
            select: { id: true, number: true }
          })
        : null;

      const confirmFields = linkedInv
        ? resolveInvoicePaymentConfirmFields(
            { id: payment.id, method: payment.method },
            linkedInv,
            { source, account, reference, mpesaRef: payment.mpesaRef, howToProceed }
          )
        : {
            source: (source ?? payment.source ?? "").trim(),
            account: (account ?? payment.account ?? "").trim(),
            reference: (reference ?? payment.reference ?? payment.mpesaRef ?? "").trim(),
            howToProceed: (howToProceed ?? payment.howToProceed) ?? null
          };

      if (!confirmFields.source || !confirmFields.account || !confirmFields.reference) {
        res.status(400).json({
          error: "Confirmation requires: where from (source), transaction code (reference), and which account."
        });
        return;
      }

      let invoiceApply: Awaited<ReturnType<typeof confirmPaymentCore>> = {};
      await prisma.$transaction(async (tx) => {
        invoiceApply = await confirmPaymentCore(
          tx,
          {
            id: payment.id,
            invoiceId: payment.invoiceId,
            howToProceed: payment.howToProceed,
            amount: payment.amount
          },
          confirmFields
        );
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
          metadata: {
            source: confirmFields.source,
            account: confirmFields.account,
            reference: confirmFields.reference,
            invoiceNumber: invoiceApply.invoiceNumber ?? null,
            invoiceStatus: invoiceApply.invoiceStatus ?? null
          }
        }
      });

      runPaymentConfirmedNotifications(prisma, orgId, id);

      res.json({
        success: true,
        payment: updated,
        invoiceApplied: linkedInv
          ? {
              id: linkedInv.id,
              number: linkedInv.number,
              status: invoiceApply.invoiceStatus ?? updated?.invoice?.status ?? "sent",
              reference: confirmFields.reference
            }
          : null,
        message: linkedInv
          ? invoiceApply.invoiceStatus === "paid"
            ? `Invoice ${linkedInv.number} marked paid.`
            : `Payment applied to invoice ${linkedInv.number}.`
          : "Payment confirmed."
      });
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
      orderBy: { spentAt: "desc" },
      include: {
        beneficiary: { select: { id: true, name: true, email: true } },
        developerAcknowledger: { select: { id: true, name: true, email: true } }
      }
    });
    res.json(expenses);
    }
  );

  router.get(
    "/expenses/pending-my-acknowledgment",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const list = await prisma.expense.findMany({
        where: {
          orgId,
          deletedAt: null,
          category: "developer_payment",
          beneficiaryUserId: userId,
          developerAcknowledgedAt: null
        },
        orderBy: { spentAt: "desc" }
      });
      res.json(list);
    }
  );

  router.post(
    "/expenses",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
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
        paymentMethod,
        beneficiaryUserId,
        expenseSubtype,
        purposeCode,
        purposeDetail,
        toolOrServiceName,
        subscriptionValidUntil
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
        beneficiaryUserId?: string | null;
        expenseSubtype?: string | null;
        purposeCode?: string | null;
        purposeDetail?: string | null;
        toolOrServiceName?: string | null;
        subscriptionValidUntil?: string | null;
      };

      if (!category || !amount || !spentAt) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      let benefId: string | null = null;
      if (beneficiaryUserId && String(beneficiaryUserId).trim()) {
        const u = await prisma.user.findFirst({
          where: { id: String(beneficiaryUserId).trim(), orgId, deletedAt: null },
          select: { id: true }
        });
        benefId = u?.id ?? null;
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
          status: "pending", // expenses need admin approval
          beneficiaryUserId: benefId,
          expenseSubtype: expenseSubtype?.trim() || null,
          purposeCode: purposeCode?.trim() || null,
          purposeDetail: purposeDetail?.trim() || null,
          toolOrServiceName: toolOrServiceName?.trim() || null,
          subscriptionValidUntil: subscriptionValidUntil
            ? new Date(subscriptionValidUntil)
            : null
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

      const existingApproval = await prisma.approval.findFirst({
        where: {
          orgId,
          entityType: "expense",
          entityId: expense.id,
          status: "pending"
        }
      });
      if (!existingApproval) {
        const approval = await prisma.approval.create({
          data: {
            orgId,
            requesterId: userId,
            entityType: "expense",
            entityId: expense.id,
            status: "pending",
            reason: "Expense recorded — pending admin approval"
          }
        });
        await prisma.eventLog.create({
          data: {
            orgId,
            type: "approval.requested",
            entityType: "expense",
            entityId: expense.id,
            metadata: { approvalId: approval.id, auto: true }
          }
        });
      }

      void notifyAdminsExpenseCreated(prisma, {
        orgId,
        expenseId: expense.id,
        category,
        amount: Number(amount),
        currency: currency ?? "KES",
        description: description ?? null,
        spentAt: new Date(spentAt),
        recordedByUserId: userId
      }).catch((err) => console.error("[finance] expense admin notify:", err));

      res.status(201).json(expense);
    }
  );

  router.patch(
    "/expenses/:id",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
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
        paymentMethod,
        beneficiaryUserId,
        expenseSubtype,
        purposeCode,
        purposeDetail,
        toolOrServiceName,
        subscriptionValidUntil
      } = req.body as {
        category?: string;
        description?: string;
        amount?: string;
        currency?: string;
        spentAt?: string;
        notes?: string;
        source?: string;
        transactionCode?: string;
        account?: string;
        paymentMethod?: string;
        beneficiaryUserId?: string | null;
        expenseSubtype?: string | null;
        purposeCode?: string | null;
        purposeDetail?: string | null;
        toolOrServiceName?: string | null;
        subscriptionValidUntil?: string | null;
      };

      const existing = await prisma.expense.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!existing) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }
      if (existing.status !== "pending") {
        res.status(403).json({ error: "Only pending expenses can be edited" });
        return;
      }

      let benefUpdate: { beneficiaryUserId: string | null } | undefined;
      if (beneficiaryUserId !== undefined) {
        if (beneficiaryUserId === null || beneficiaryUserId === "") {
          benefUpdate = { beneficiaryUserId: null };
        } else {
          const u = await prisma.user.findFirst({
            where: { id: String(beneficiaryUserId).trim(), orgId, deletedAt: null },
            select: { id: true }
          });
          benefUpdate = { beneficiaryUserId: u?.id ?? null };
        }
      }

      const updated = await prisma.expense.update({
        where: { id },
        data: {
          category: category ?? undefined,
          description: description ?? undefined,
          notes: notes ?? undefined,
          source: source ?? undefined,
          transactionCode: transactionCode ?? undefined,
          account: account ?? undefined,
          paymentMethod: paymentMethod ?? undefined,
          currency: currency ?? undefined,
          amount: amount != null ? new Prisma.Decimal(amount) : undefined,
          spentAt: spentAt != null ? new Date(spentAt) : undefined,
          ...(benefUpdate ?? {}),
          expenseSubtype:
            expenseSubtype !== undefined ? expenseSubtype?.trim() || null : undefined,
          purposeCode: purposeCode !== undefined ? purposeCode?.trim() || null : undefined,
          purposeDetail: purposeDetail !== undefined ? purposeDetail?.trim() || null : undefined,
          toolOrServiceName:
            toolOrServiceName !== undefined ? toolOrServiceName?.trim() || null : undefined,
          subscriptionValidUntil:
            subscriptionValidUntil !== undefined
              ? subscriptionValidUntil
                ? new Date(subscriptionValidUntil)
                : null
              : undefined
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "expense.updated",
          entityType: "expense",
          entityId: id
        }
      });

      res.json(updated);
    }
  );

  router.delete(
    "/expenses/:id",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;

      const existing = await prisma.expense.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!existing) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }
      if (existing.status !== "pending") {
        res.status(403).json({ error: "Only pending expenses can be deleted" });
        return;
      }

      await prisma.expense.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          type: "expense.deleted",
          entityType: "expense",
          entityId: id
        }
      });

      res.json({ ok: true });
    }
  );

  // Developer (payee) confirms a developer_payment expense was received / aligned with finance
  router.post(
    "/expenses/:id/developer-acknowledge",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const roleKeys = req.auth!.roleKeys;
      const { id } = req.params;
      const exp = await prisma.expense.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!exp) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }
      const isDevPayment = exp.category === "developer_payment";
      if (!isDevPayment) {
        res.status(400).json({ error: "Only developer_payment category uses this acknowledgment" });
        return;
      }
      const isBeneficiary = exp.beneficiaryUserId === userId;
      const isAdminLike = roleKeys.some((k) =>
        [ROLE_KEYS.admin, ROLE_KEYS.director].includes(k)
      );
      if (!isBeneficiary && !isAdminLike) {
        res
          .status(403)
          .json({ error: "Only the payee developer or an admin/director can acknowledge." });
        return;
      }
      if (exp.developerAcknowledgedAt) {
        res.status(400).json({ error: "Already acknowledged" });
        return;
      }
      const updated = await prisma.expense.update({
        where: { id },
        data: {
          developerAcknowledgedAt: new Date(),
          developerAcknowledgedById: userId
        },
        include: {
          beneficiary: { select: { id: true, name: true, email: true } },
          developerAcknowledger: { select: { id: true, name: true, email: true } }
        }
      });
      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "expense.developer_acknowledged",
          entityType: "expense",
          entityId: id,
          metadata: {}
        }
      });
      res.json(updated);
    }
  );

  // Download expense receipt PDF
  router.get(
    "/expenses/:id/receipt/pdf",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const { id } = req.params;

        const expense = await prisma.expense.findFirst({
          where: { id, orgId, deletedAt: null }
        });
        if (!expense) {
          res.status(404).json({ error: "Expense not found" });
          return;
        }

        const { generateExpenseReceiptPdf } = require("../services/finance/expense-receipt-pdf");
        const spentAt = expense.spentAt.toISOString().split("T")[0];
        const createdAt = expense.createdAt.toISOString().split("T")[0];
        const receiptNumber = `EXP-${String(expense.id).slice(0, 8).toUpperCase()}`;

        const pdfBuffer: Buffer = await generateExpenseReceiptPdf({
          receiptNumber,
          company: { ...INVOICE_PDF_COMPANY },
          currency: expense.currency,
          amount: Number(expense.amount),
          category: expense.category,
          description: expense.description,
          notes: expense.notes,
          source: expense.source,
          transactionCode: expense.transactionCode,
          account: expense.account,
          paymentMethod: expense.paymentMethod,
          spentAt,
          status: expense.status,
          createdAt
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${receiptNumber}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(pdfBuffer);
      } catch (error) {
        console.error("Error generating expense receipt PDF:", error);
        res.status(500).json({
          error: "Failed to generate receipt",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Update invoice (finance only). Limited fields: dates, status, items.
  router.patch(
    "/invoices/:id",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { status, issueDate, dueDate, currency, items, notes } = req.body as {
        status?: string;
        issueDate?: string;
        dueDate?: string;
        currency?: string;
        notes?: string | null;
        items?: Array<{ description: string; quantity: number; unitPrice: string | number }>;
      };
      const existing = await prisma.invoice.findFirst({
        where: { id, orgId, deletedAt: null },
        include: { payments: { where: { deletedAt: null }, select: { status: true } } }
      });
      if (!existing) {
        res.status(404).json({ error: "Invoice not found" });
        return;
      }
      const hasConfirmedPayment = existing.payments.some((p) => p.status === "confirmed");
      if (hasConfirmedPayment) {
        res.status(403).json({ error: "Invoices with confirmed payments cannot be edited" });
        return;
      }

      const nextTotal =
        Array.isArray(items) && items.length > 0
          ? items.reduce((sum, it) => sum + Number(it.unitPrice) * Number(it.quantity || 0), 0)
          : undefined;

      const updated = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.update({
          where: { id },
          data: {
            ...(status !== undefined && { status }),
            ...(issueDate !== undefined && { issueDate: new Date(issueDate) }),
            ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
            ...(currency !== undefined && { currency }),
            ...(nextTotal !== undefined && { totalAmount: new Prisma.Decimal(nextTotal) }),
            ...(notes !== undefined && { notes: notes?.trim() ? notes.trim() : null })
          }
        });
        if (Array.isArray(items)) {
          await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
          if (items.length > 0) {
            await tx.invoiceItem.createMany({
              data: items.map((it) => ({
                invoiceId: id,
                description: String(it.description ?? "").trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unitPrice: new Prisma.Decimal(String(it.unitPrice))
              }))
            });
          }
        }
        return inv;
      });

      await prisma.eventLog.create({
        data: { orgId, type: "invoice.updated", entityType: "invoice", entityId: id }
      });
      res.json(updated);
    }
  );

  // Delete invoice (only if no confirmed payments)
  router.delete(
    "/invoices/:id",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const existing = await prisma.invoice.findFirst({
        where: { id, orgId, deletedAt: null },
        include: { payments: { where: { deletedAt: null }, select: { status: true } } }
      });
      if (!existing) {
        res.status(404).json({ error: "Invoice not found" });
        return;
      }
      const hasConfirmedPayment = existing.payments.some((p) => p.status === "confirmed");
      if (hasConfirmedPayment) {
        res.status(403).json({ error: "Invoices with confirmed payments cannot be deleted" });
        return;
      }
      await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
      await prisma.eventLog.create({
        data: { orgId, type: "invoice.deleted", entityType: "invoice", entityId: id }
      });
      res.json({ success: true });
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
          managementMonths: true,
          managementActive: true,
          managementStartedAt: true,
          managementProgressPercent: true
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
        managementMonths: p.managementMonths,
        managementActive: p.managementActive,
        managementStartedAt: p.managementStartedAt?.toISOString() ?? null,
        managementProgressPercent: p.managementProgressPercent
      }));
      res.json(list);
    }
  );

  // Update contract value, amount received, management fields (finance / director / admin)
  router.patch(
    "/projects/:projectId",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const actorId = req.auth!.userId;
      const { projectId } = req.params;
      const body = req.body as {
        price?: string | number | null;
        amountReceived?: string | number | null;
        managementMonthlyAmount?: string | number | null;
        managementMonths?: string | number | null;
      };
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null, approvalStatus: "approved" }
      });
      if (!project) {
        res.status(404).json({ error: "Approved project not found" });
        return;
      }
      const data: Record<string, unknown> = {};
      if (body.price !== undefined) {
        data.price =
          body.price != null && body.price !== "" ? new Prisma.Decimal(Number(body.price)) : null;
      }
      if (body.amountReceived !== undefined) {
        data.amountReceived =
          body.amountReceived != null && body.amountReceived !== ""
            ? new Prisma.Decimal(Number(body.amountReceived))
            : new Prisma.Decimal(0);
      }
      if (body.managementMonthlyAmount !== undefined) {
        data.managementMonthlyAmount =
          body.managementMonthlyAmount != null && body.managementMonthlyAmount !== ""
            ? new Prisma.Decimal(Number(body.managementMonthlyAmount))
            : null;
      }
      if (body.managementMonths !== undefined) {
        data.managementMonths =
          body.managementMonths != null && body.managementMonths !== ""
            ? Math.max(0, Math.floor(Number(body.managementMonths)))
            : null;
      }
      if (Object.keys(data).length === 0) {
        res.status(400).json({ error: "No fields to update (send price, amountReceived, management fields)." });
        return;
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data,
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
      await prisma.eventLog.create({
        data: {
          orgId,
          actorId,
          type: "finance.project.financials_updated",
          entityType: "project",
          entityId: projectId,
          metadata: { fields: Object.keys(data) }
        }
      });
      const allocated = updated.price != null ? Number(updated.price) : null;
      const received = updated.amountReceived != null ? Number(updated.amountReceived) : 0;
      res.json({
        id: updated.id,
        name: updated.name,
        status: updated.status,
        allocated,
        received,
        remaining: allocated != null ? Math.max(0, allocated - received) : null,
        managementMonthlyAmount:
          updated.managementMonthlyAmount != null ? Number(updated.managementMonthlyAmount) : null,
        managementMonths: updated.managementMonths
      });
    }
  );

  // Mark a management billing month paid (finance / admin)
  router.patch(
    "/projects/:projectId/management-month",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;
      const { year, month, paid } = req.body as { year?: number; month?: number; paid?: boolean };
      const y = Math.floor(Number(year));
      const mo = Math.floor(Number(month));
      if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
        res.status(400).json({ error: "year and month (1–12) are required" });
        return;
      }
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null, approvalStatus: "approved", managementActive: true }
      });
      if (!project || !project.managementStartedAt) {
        res.status(404).json({ error: "Management project not found" });
        return;
      }
      const billable = billableMonthsUtc(project.managementStartedAt, project.managementMonths, new Date());
      const ok = billable.some((b) => b.year === y && b.month === mo);
      if (!ok) {
        res.status(400).json({ error: "Month is outside the current management billing window" });
        return;
      }
      const isPaid = paid === true;
      const row = await prisma.projectManagementMonth.upsert({
        where: {
          projectId_year_month: { projectId, year: y, month: mo }
        },
        create: {
          orgId,
          projectId,
          year: y,
          month: mo,
          paid: isPaid,
          paidAt: isPaid ? new Date() : null,
          markedByUserId: isPaid ? userId : null
        },
        update: {
          paid: isPaid,
          paidAt: isPaid ? new Date() : null,
          markedByUserId: isPaid ? userId : null
        }
      });

      let paymentRecorded: { paymentId?: string; amount?: number } | null = null;
      if (isPaid && row.invoiceId) {
        paymentRecorded = await prisma.$transaction(async (tx) => {
          const result = await recordConfirmedInvoicePayment(tx, orgId, userId, row.invoiceId!, {
            receivedAt: row.paidAt ?? new Date(),
            notes: `Management fee ${ymKey(y, mo)} marked paid`
          });
          return result.created ? { paymentId: result.paymentId, amount: result.amount } : null;
        });
        if (paymentRecorded?.paymentId) {
          runPaymentConfirmedNotifications(prisma, orgId, paymentRecorded.paymentId);
        }
      }

      res.json({
        id: row.id,
        projectId: row.projectId,
        year: row.year,
        month: row.month,
        key: ymKey(row.year, row.month),
        paid: row.paid,
        paidAt: row.paidAt?.toISOString() ?? null,
        invoiceId: row.invoiceId,
        paymentRecorded
      });
    }
  );

  // Invoice for one management fee month (links row to invoice)
  router.post(
    "/invoices/management-fee",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { projectId, year, month, issueDate, dueDate, notes } = req.body as {
        projectId?: string;
        year?: number;
        month?: number;
        issueDate?: string;
        dueDate?: string;
        notes?: string | null;
      };
      const y = Math.floor(Number(year));
      const mo = Math.floor(Number(month));
      if (!projectId || !Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
        res.status(400).json({ error: "projectId, year, and month (1–12) are required" });
        return;
      }
      const project = await prisma.project.findFirst({
        where: { id: projectId, orgId, deletedAt: null, approvalStatus: "approved", managementActive: true },
        include: { client: { select: { id: true, name: true, email: true } } }
      });
      if (!project?.clientId || !project.managementStartedAt) {
        res.status(400).json({
          error: "Project must have a linked client and an active management start date"
        });
        return;
      }
      const billable = billableMonthsUtc(project.managementStartedAt, project.managementMonths, new Date());
      if (!billable.some((b) => b.year === y && b.month === mo)) {
        res.status(400).json({ error: "Month is outside the management billing window" });
        return;
      }
      const existing = await prisma.projectManagementMonth.findUnique({
        where: { projectId_year_month: { projectId, year: y, month: mo } }
      });
      if (existing?.paid) {
        res.status(400).json({ error: "This month is already marked paid" });
        return;
      }
      if (existing?.invoiceId) {
        res.status(400).json({ error: "An invoice is already linked to this month", invoiceId: existing.invoiceId });
        return;
      }
      const monthly = project.managementMonthlyAmount != null ? Number(project.managementMonthlyAmount) : 0;
      if (!(monthly > 0)) {
        res.status(400).json({ error: "managementMonthlyAmount must be set on the project" });
        return;
      }
      const label = `${y}-${String(mo).padStart(2, "0")}`;
      const issue = issueDate ? new Date(issueDate) : new Date();
      if (Number.isNaN(issue.getTime())) {
        res.status(400).json({ error: "Invalid issueDate" });
        return;
      }
      const client = project.client;
      const clientEmail = client?.email?.trim() || "";

      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const number = await allocateInvoiceNumberForCreate(tx, orgId, projectId, issue);
            const desc = `Management fee ${label} — ${project.name}`;
            const totalAmount = monthly;
            const invoice = await tx.invoice.create({
              data: {
                orgId,
                clientId: project.clientId!,
                projectId,
                number,
                status: "sent",
                issueDate: issue,
                dueDate: parseInvoiceDueDate(dueDate),
                currency: "KES",
                totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
                notes: notes?.trim() ? notes.trim() : `Management retainer for ${label}.`
              }
            });
            await tx.invoiceItem.create({
              data: {
                invoiceId: invoice.id,
                description: desc,
                quantity: 1,
                unitPrice: new Prisma.Decimal(monthly.toFixed(2))
              }
            });
            await tx.projectManagementMonth.upsert({
              where: { projectId_year_month: { projectId, year: y, month: mo } },
              create: {
                orgId,
                projectId,
                year: y,
                month: mo,
                paid: false,
                invoiceId: invoice.id
              },
              update: { invoiceId: invoice.id }
            });
            await tx.eventLog.create({
              data: {
                orgId,
                type: "invoice.management_fee",
                entityType: "invoice",
                entityId: invoice.id,
                metadata: { projectId, year: y, month: mo, number: invoice.number }
              }
            });
            return invoice;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000
          }
        );

        if (clientEmail) {
          try {
            const emailResult = await deliverFinanceInvoiceEmail(prisma, {
              orgId,
              invoiceId: result.id,
              to: clientEmail,
              clientName: client?.name,
              detailLine: `This invoice covers the management fee for ${label}.`
            });
            if (emailResult.ok) {
              await logEmailSent(prisma, {
                orgId,
                to: clientEmail,
                subject: `Invoice ${result.number} from Cres Dynamics`,
                body: `Management fee invoice ${result.number} sent with PDF to ${clientEmail}.`,
                type: "invoice.sent"
              });
            } else {
              console.error("Management invoice email failed:", emailResult.error);
            }
          } catch (logErr) {
            console.error("deliverFinanceInvoiceEmail after management-fee:", logErr);
          }
        }

        res.status(201).json({
          success: true,
          data: {
            invoice: {
              id: result.id,
              number: result.number,
              totalAmount: Number(result.totalAmount),
              projectId: result.projectId,
              clientId: result.clientId
            },
            downloadUrl: `/finance/invoices/${result.id}/pdf`,
            emailSent: Boolean(clientEmail)
          }
        });
      } catch (e: unknown) {
        const err = e as { message?: string };
        // eslint-disable-next-line no-console
        console.error("POST /finance/invoices/management-fee", e);
        res.status(500).json({ error: err.message ?? "Failed to create management invoice" });
      }
    }
  );

  // Users in org (for expense beneficiary / transport attribution)
  router.get(
    "/expense-context",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const users = await prisma.user.findMany({
        where: { orgId, deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { email: "asc" }
      });
      res.json({ users });
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

  // Amount due per client (outstanding invoices) and reminder config — finance & admin only
  router.get(
    "/clients/due",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
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

  // Pending approvals queue for Admin approvals page (enriched with amounts)
  router.get(
    "/approvals/pending",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const approvals = await prisma.approval.findMany({
        where: {
          orgId,
          status: "pending",
          entityType: { in: ["expense", "payout"] }
        },
        orderBy: { createdAt: "desc" },
        include: {
          requester: { select: { id: true, name: true, email: true } }
        }
      });

      const expenseIds = approvals
        .filter((a) => a.entityType === "expense")
        .map((a) => a.entityId);
      const payoutIds = approvals
        .filter((a) => a.entityType === "payout")
        .map((a) => a.entityId);

      const [expenses, payouts] = await Promise.all([
        expenseIds.length
          ? prisma.expense.findMany({
              where: { orgId, deletedAt: null, id: { in: expenseIds } },
              select: { id: true, amount: true, currency: true, description: true, notes: true, category: true, spentAt: true, status: true }
            })
          : Promise.resolve([]),
        payoutIds.length
          ? prisma.payout.findMany({
              where: { orgId, deletedAt: null, id: { in: payoutIds } },
              select: { id: true, amount: true, currency: true, description: true, notes: true, scheduledAt: true, paidAt: true }
            })
          : Promise.resolve([])
      ]);

      const expenseById = new Map(expenses.map((e) => [e.id, e]));
      const payoutById = new Map(payouts.map((p) => [p.id, p]));

      res.json(
        approvals.map((a) => {
          const entity =
            a.entityType === "expense"
              ? expenseById.get(a.entityId)
              : a.entityType === "payout"
                ? payoutById.get(a.entityId)
                : null;

          return {
            id: a.id,
            entityType: a.entityType,
            entityId: a.entityId,
            status: a.status,
            reason: a.reason ?? null,
            createdAt: a.createdAt,
            requester: a.requester ?? null,
            amount: entity ? Number((entity as any).amount) : null,
            currency: entity ? (entity as any).currency ?? null : null,
            description: entity ? (entity as any).description ?? null : null,
            notes: entity ? (entity as any).notes ?? null : null
          };
        })
      );
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
      if (existing.entityType === "invoice" || existing.entityType?.includes("invoice")) {
        res.status(403).json({
          error: "Directors cannot approve or reject invoice workflows. Use Finance or Admin."
        });
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
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
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
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
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

  // Get invoice PDF
  router.get(
    "/invoices/:invoiceId/pdf",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const invoiceIdStr = Array.isArray(invoiceId) ? invoiceId[0] : invoiceId;
        const orgId = req.auth!.orgId;

        let pdfBuffer: Buffer;
        let filename: string;
        try {
          ({ buffer: pdfBuffer, filename } = await generateInvoicePdfBuffer(prisma, orgId, invoiceIdStr));
        } catch (e) {
          if (e instanceof Error && e.message === "Invoice not found") {
            return res.status(404).json({ error: "Invoice not found" });
          }
          throw e;
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", pdfBuffer.length);

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

