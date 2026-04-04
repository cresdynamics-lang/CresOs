// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function salesRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Get sales dashboard with invoice stats
  router.get(
    "/dashboard",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;

        const [
          totalInvoices,
          pendingInvoices,
          approvedInvoices,
          rejectedInvoices,
          recentInvoices
        ] = await Promise.all([
          prisma.invoice.count({
            where: { 
              orgId,
              createdBy: { userId }
            }
          }),
          prisma.invoice.count({
            where: { 
              orgId,
              createdBy: { userId },
              status: "PENDING"
            }
          }),
          prisma.invoice.count({
            where: { 
              orgId,
              createdBy: { userId },
              status: "APPROVED"
            }
          }),
          prisma.invoice.count({
            where: { 
              orgId,
              createdBy: { userId },
              status: "REJECTED"
            }
          }),
          prisma.invoice.findMany({
            where: { 
              orgId,
              createdBy: { userId }
            },
            include: {
              client: true,
              project: true,
              approvedBy: {
                select: { displayName: true }
              }
            },
            orderBy: { createdAt: "desc" },
            take: 10
          })
        ]);

        res.json({
          success: true,
          data: {
            stats: {
              total: totalInvoices,
              pending: pendingInvoices,
              approved: approvedInvoices,
              rejected: rejectedInvoices
            },
            recentInvoices
          }
        });

      } catch (error) {
        console.error("Error fetching sales dashboard:", error);
        res.status(500).json({ 
          error: "Failed to fetch sales dashboard", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Create new invoice (requires finance approval)
  router.post(
    "/invoices",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const {
          clientId,
          projectId,
          items,
          dueDate,
          notes,
          subtotal,
          taxAmount,
          totalAmount,
          currency = "USD"
        } = req.body;

        // Validate required fields
        if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ 
            error: "Missing required fields", 
            message: "Client ID and items are required" 
          });
        }

        // Validate items
        for (const item of items) {
          if (!item.description || !item.quantity || !item.unitPrice) {
            return res.status(400).json({ 
              error: "Invalid item data", 
              message: "Each item must have description, quantity, and unit price" 
            });
          }
        }

        // Generate invoice number
        const invoiceCount = await prisma.invoice.count({
          where: { orgId }
        });
        const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

        // Create invoice with PENDING status (requires finance approval)
        const invoice = await prisma.invoice.create({
          data: {
            orgId,
            invoiceNumber,
            clientId,
            projectId,
            status: "PENDING", // Requires finance approval
            subtotal: parseFloat(subtotal) || 0,
            taxAmount: parseFloat(taxAmount) || 0,
            totalAmount: parseFloat(totalAmount) || 0,
            currency,
            dueDate: dueDate ? new Date(dueDate) : null,
            notes: notes || null,
            items: {
              create: items.map(item => ({
                description: item.description,
                quantity: parseFloat(item.quantity),
                unitPrice: parseFloat(item.unitPrice),
                total: parseFloat(item.quantity) * parseFloat(item.unitPrice)
              }))
            },
            createdBy: {
              connect: { userId }
            }
          },
          include: {
            client: true,
            project: true,
            items: true,
            createdBy: {
              select: { displayName: true }
            }
          }
        });

        // Create notification for finance users
        const financeUsers = await prisma.user.findMany({
          where: {
            orgId,
            userRoles: {
              some: {
                role: {
                  key: { in: [ROLE_KEYS.finance, ROLE_KEYS.admin] }
                }
              }
            }
          },
          select: { id: true }
        });

        // Create approval notifications
        await prisma.notification.createMany({
          data: financeUsers.map(financeUser => ({
            userId: financeUser.id,
            title: "Invoice Approval Required",
            message: `Invoice ${invoiceNumber} requires your approval`,
            type: "INVOICE_APPROVAL",
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber,
              createdBy: req.auth!.userName
            }
          }))
        });

        res.status(201).json({
          success: true,
          message: "Invoice created successfully and sent for finance approval",
          data: invoice
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

  // Get sales user's invoices
  router.get(
    "/invoices",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const { status, page = 1, limit = 20 } = req.query;

        const where: any = {
          orgId,
          createdBy: { userId }
        };

        if (status && status !== "ALL") {
          where.status = status;
        }

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where,
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
            },
            orderBy: { createdAt: "desc" },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
          }),
          prisma.invoice.count({ where })
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
        console.error("Error fetching invoices:", error);
        res.status(500).json({ 
          error: "Failed to fetch invoices", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get specific invoice
  router.get(
    "/invoices/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const { id } = req.params;

        const invoice = await prisma.invoice.findFirst({
          where: {
            id,
            orgId,
            createdBy: { userId }
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

        if (!invoice) {
          return res.status(404).json({ 
            error: "Invoice not found" 
          });
        }

        res.json({
          success: true,
          data: invoice
        });

      } catch (error) {
        console.error("Error fetching invoice:", error);
        res.status(500).json({ 
          error: "Failed to fetch invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Update invoice (only if pending)
  router.patch(
    "/invoices/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const { id } = req.params;
        const {
          clientId,
          projectId,
          items,
          dueDate,
          notes,
          subtotal,
          taxAmount,
          totalAmount,
          currency
        } = req.body;

        // Check if invoice exists and belongs to user
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            id,
            orgId,
            createdBy: { userId },
            status: "PENDING" // Can only edit pending invoices
          }
        });

        if (!existingInvoice) {
          return res.status(404).json({ 
            error: "Invoice not found or cannot be edited" 
          });
        }

        // Update invoice and items
        const invoice = await prisma.invoice.update({
          where: { id },
          data: {
            clientId,
            projectId,
            subtotal: parseFloat(subtotal) || existingInvoice.subtotal,
            taxAmount: parseFloat(taxAmount) || existingInvoice.taxAmount,
            totalAmount: parseFloat(totalAmount) || existingInvoice.totalAmount,
            currency: currency || existingInvoice.currency,
            dueDate: dueDate ? new Date(dueDate) : existingInvoice.dueDate,
            notes: notes !== undefined ? notes : existingInvoice.notes,
            items: items ? {
              deleteMany: {},
              create: items.map(item => ({
                description: item.description,
                quantity: parseFloat(item.quantity),
                unitPrice: parseFloat(item.unitPrice),
                total: parseFloat(item.quantity) * parseFloat(item.unitPrice)
              }))
            } : undefined
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

        res.json({
          success: true,
          message: "Invoice updated successfully",
          data: invoice
        });

      } catch (error) {
        console.error("Error updating invoice:", error);
        res.status(500).json({ 
          error: "Failed to update invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Delete invoice (only if pending)
  router.delete(
    "/invoices/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const { id } = req.params;

        // Check if invoice exists and belongs to user
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            id,
            orgId,
            createdBy: { userId },
            status: "PENDING" // Can only delete pending invoices
          }
        });

        if (!existingInvoice) {
          return res.status(404).json({ 
            error: "Invoice not found or cannot be deleted" 
          });
        }

        // Delete invoice items first
        await prisma.invoiceItem.deleteMany({
          where: { invoiceId: id }
        });

        // Delete invoice
        await prisma.invoice.delete({
          where: { id }
        });

        res.json({
          success: true,
          message: "Invoice deleted successfully"
        });

      } catch (error) {
        console.error("Error deleting invoice:", error);
        res.status(500).json({ 
          error: "Failed to delete invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get clients for invoice creation
  router.get(
    "/clients",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;

        const clients = await prisma.client.findMany({
          where: { 
            orgId,
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            billingAddress: true
          },
          orderBy: { name: "asc" }
        });

        res.json({
          success: true,
          data: clients
        });

      } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({ 
          error: "Failed to fetch clients", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get projects for invoice creation
  router.get(
    "/projects",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;

        const projects = await prisma.project.findMany({
          where: { 
            orgId,
            deletedAt: null,
            // Only show projects assigned to this sales user or all projects for admin
            ...(req.auth!.roleKeys.includes(ROLE_KEYS.sales) && {
              OR: [
                { createdById: userId },
                { teamMembers: { some: { userId } } }
              ]
            })
          },
          select: {
            id: true,
            name: true,
            clientId: true,
            status: true,
            client: {
              select: {
                name: true
              }
            }
          },
          orderBy: { name: "asc" }
        });

        res.json({
          success: true,
          data: projects
        });

      } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ 
          error: "Failed to fetch projects", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  return router;
}
