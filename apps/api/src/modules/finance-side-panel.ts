/**
 * Finance Side Panel - Invoice Management
 * 
 * Provides a comprehensive side panel for finance module with invoice management
 * functionalities linked to the invoice generation system
 */

import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { FinanceInvoiceService } from "../services/invoice/finance-integration";

export interface FinanceSidePanelData {
  // Invoice Statistics
  totalInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  draftInvoices: number;
  totalRevenue: number;
  outstandingAmount: number;
  
  // Recent Invoices
  recentInvoices: Array<{
    id: string;
    number: string;
    clientName: string;
    amount: number;
    status: string;
    issueDate: string;
    dueDate: string;
  }>;
  
  // Monthly Statistics
  monthlyStats: Array<{
    month: string;
    invoices: number;
    revenue: number;
  }>;
  
  // Approval Statistics
  pendingApprovals: number;
  totalApprovals: number;
  recentApprovals: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  
  // Expense Statistics
  totalExpenses: number;
  pendingExpenses: number;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    status: string;
    spentAt: string;
  }>;
  
  // Quick Actions
  projectsWithoutInvoices: Array<{
    id: string;
    name: string;
    clientName: string;
    amount: number;
  }>;
  
  // Financial Summary
  netProfit: number;
  profitMargin: number;
  averageInvoiceValue: number;
  paymentRate: number;
}

export default function financeSidePanelRouter(prisma: PrismaClient): Router {
  const router = createRouter();
  const financeInvoiceService = new FinanceInvoiceService(prisma);

  // Get complete finance side panel data (Dashboard + Invoices + Approvals)
  router.get(
    "/",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
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
          take: 5
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

        // Get approval statistics
        const [
          pendingApprovals,
          totalApprovals,
          recentApprovals
        ] = await Promise.all([
          prisma.approval.count({
            where: { orgId, status: "pending" }
          }),
          
          prisma.approval.count({
            where: { orgId }
          }),
          
          prisma.approval.findMany({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            take: 5
          })
        ]);

        // Get expense statistics
        const [
          totalExpenses,
          pendingExpenses,
          recentExpenses
        ] = await Promise.all([
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: { 
              orgId, 
              status: { in: ["approved", "paid"] }
            }
          }),
          
          prisma.expense.count({
            where: { orgId, status: "pending" }
          }),
          
          prisma.expense.findMany({
            where: { orgId },
            orderBy: { spentAt: "desc" },
            take: 5
          })
        ]);

        // Get projects without invoices
        const projectsWithoutInvoices = await prisma.project.findMany({
          where: { 
            orgId,
            invoices: { none: {} }
          },
          include: {
            client: { select: { name: true } }
          },
          take: 5,
          orderBy: { createdAt: "desc" }
        });

        // Calculate financial metrics
        const revenue = totalRevenue._sum.amount?.toNumber() || 0;
        const expenses = totalExpenses._sum.amount?.toNumber() || 0;
        const netProfit = revenue - expenses;
        const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
        const averageInvoiceValue = totalInvoices > 0 ? revenue / totalInvoices : 0;
        const paymentRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

        const sidePanelData: FinanceSidePanelData = {
          // Invoice Statistics
          totalInvoices,
          sentInvoices,
          paidInvoices,
          pendingInvoices,
          overdueInvoices,
          draftInvoices,
          totalRevenue: revenue,
          outstandingAmount: outstandingAmount._sum.totalAmount?.toNumber() || 0,
          
          // Recent Invoices
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
          
          // Monthly Statistics
          monthlyStats,
          
          // Approval Statistics
          pendingApprovals,
          totalApprovals,
          recentApprovals: recentApprovals.map(approval => ({
            id: approval.id,
            type: approval.entityType,
            status: approval.status,
            createdAt: approval.createdAt.toISOString().split('T')[0]
          })),
          
          // Expense Statistics
          totalExpenses: expenses,
          pendingExpenses,
          recentExpenses: recentExpenses.map(expense => ({
            id: expense.id,
            description: expense.description || 'No description',
            amount: Number(expense.amount),
            status: expense.status,
            spentAt: expense.spentAt.toISOString().split('T')[0]
          })),
          
          // Quick Actions
          projectsWithoutInvoices: projectsWithoutInvoices.map(project => ({
            id: project.id,
            name: project.name,
            clientName: project.client?.name || 'Unknown Client',
            amount: Number(project.price || 0)
          })),
          
          // Financial Summary
          netProfit,
          profitMargin,
          averageInvoiceValue,
          paymentRate
        };

        res.json({
          success: true,
          data: sidePanelData
        });

      } catch (error) {
        console.error("Error fetching finance side panel data:", error);
        res.status(500).json({ 
          error: "Failed to fetch finance side panel data", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoices by status
  router.get(
    "/side-panel/invoices/:status",
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

  // Create new invoice (linked to generation system)
  router.post(
    "/side-panel/invoices/create",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const createdBy = req.auth!.userId;
        const invoiceData = req.body;

        console.log('🚀 Creating invoice from side panel...');

        // Use the finance invoice service to create invoice with PDF
        const { invoice, pdfBuffer } = await financeInvoiceService.createFinanceInvoice(
          orgId,
          invoiceData,
          createdBy
        );

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
        console.error("Error creating invoice from side panel:", error);
        res.status(500).json({ 
          error: "Failed to create invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Quick invoice creation from project
  router.post(
    "/side-panel/invoices/create-from-project/:projectId",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const { projectId } = req.params;
        const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
        const orgId = req.auth!.orgId;
        const createdBy = req.auth!.userId;
        const customizations = req.body; // Allow customizations like items, pricing, etc.

        console.log(`🚀 Creating invoice from project ${projectIdStr} from side panel...`);

        // Generate invoice for project with customizations
        const { invoice, pdfBuffer } = await financeInvoiceService.generateProjectInvoice(
          projectIdStr,
          orgId,
          createdBy
        );

        res.status(201).json({
          success: true,
          message: `Invoice ${invoice.number} created from project successfully`,
          data: {
            invoice,
            pdfGenerated: true,
            pdfSize: `${(pdfBuffer.length / 1024).toFixed(2)} KB`
          }
        });

      } catch (error) {
        console.error("Error creating invoice from project:", error);
        res.status(500).json({ 
          error: "Failed to create invoice from project", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoice statistics for dashboard
  router.get(
    "/side-panel/statistics",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const { period = 'month' } = req.query;

        let startDate: Date;
        const now = new Date();

        switch (period) {
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const [
          totalInvoices,
          totalRevenue,
          paidInvoices,
          outstandingInvoices,
          averageInvoiceValue
        ] = await Promise.all([
          prisma.invoice.count({
            where: { orgId, deletedAt: null, createdAt: { gte: startDate } }
          }),
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: { 
              orgId, 
              deletedAt: null, 
              status: "confirmed",
              receivedAt: { gte: startDate }
            }
          }),
          prisma.invoice.count({
            where: { orgId, deletedAt: null, status: "paid", createdAt: { gte: startDate } }
          }),
          prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: { 
              orgId, 
              deletedAt: null,
              OR: [{ status: "sent" }, { status: "partial" }, { status: "overdue" }],
              createdAt: { gte: startDate }
            }
          }),
          prisma.invoice.aggregate({
            _avg: { totalAmount: true },
            where: { orgId, deletedAt: null, createdAt: { gte: startDate } }
          })
        ]);

        res.json({
          success: true,
          data: {
            period,
            totalInvoices,
            totalRevenue: totalRevenue._sum.amount?.toNumber() || 0,
            paidInvoices,
            outstandingAmount: outstandingInvoices._sum.totalAmount?.toNumber() || 0,
            averageInvoiceValue: averageInvoiceValue._avg.totalAmount?.toNumber() || 0,
            paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0
          }
        });

      } catch (error) {
        console.error("Error fetching statistics:", error);
        res.status(500).json({ 
          error: "Failed to fetch statistics", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get quick actions data
  router.get(
    "/side-panel/quick-actions",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;

        // Get recent projects without invoices
        const projectsWithoutInvoices = await prisma.project.findMany({
          where: { 
            orgId, 
            deletedAt: null,
            invoices: { none: {} }
          },
          include: {
            client: { select: { name: true } }
          },
          take: 5,
          orderBy: { createdAt: "desc" }
        });

        // Get overdue invoices needing attention
        const overdueInvoices = await prisma.invoice.findMany({
          where: { 
            orgId, 
            deletedAt: null, 
            status: "overdue" 
          },
          include: {
            client: { select: { name: true, email: true } },
            project: { select: { name: true } }
          },
          take: 5,
          orderBy: { dueDate: "asc" }
        });

        // Get recent clients for quick invoice creation
        const recentClients = await prisma.client.findMany({
          where: { orgId, deletedAt: null },
          include: {
            invoices: {
              where: { deletedAt: null },
              select: { id: true },
              take: 1
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        });

        res.json({
          success: true,
          data: {
            projectsWithoutInvoices: projectsWithoutInvoices,
            overdueInvoices,
            recentClients: recentClients.map(client => ({
              ...client,
              hasInvoices: client.invoices.length > 0
            }))
          }
        });

      } catch (error) {
        console.error("Error fetching quick actions:", error);
        res.status(500).json({ 
          error: "Failed to fetch quick actions", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  return router;
}
