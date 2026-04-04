import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { InvoiceAutomationService, InvoiceAutomationConfig } from "../services/invoice/automation";
import { InvoiceDataMapper } from "../services/invoice/mapper";
import { PDFGenerator } from "../services/invoice/pdf-generator";
import { InvoiceSchema } from "../services/invoice/schema";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import multer from "multer";

const upload = multer({ dest: "uploads/" });

function routeParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default function invoiceAutomationRoutes(prisma: PrismaClient): Router {
  const router = createRouter();

  // Get default automation configuration
  router.get(
    "/config",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        
        // Get organization-specific config from database
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        
        res.json(config);
      } catch (error) {
        console.error("Error getting invoice config:", error);
        res.status(500).json({ error: "Failed to get invoice config" });
      }
    }
  );

  // Update automation configuration
  router.put(
    "/config",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const configData = req.body as Partial<InvoiceAutomationConfig>;
        
        // Update configuration in database
        await updateOrganizationInvoiceConfig(prisma, orgId, configData);
        
        res.json({ message: "Configuration updated successfully" });
      } catch (error) {
        console.error("Error updating invoice config:", error);
        res.status(500).json({ error: "Failed to update invoice config" });
      }
    }
  );

  // Generate invoice for project
  router.post(
    "/generate/project/:projectId",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const projectId = routeParam(req.params.projectId);
        const { type = 'standard', milestoneId } = req.body;
        const orgId = req.auth!.orgId;
        
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        const automationService = new InvoiceAutomationService(prisma, config);
        
        let invoice: InvoiceSchema;
        
        switch (type) {
          case 'milestone':
            if (!milestoneId) {
              res.status(400).json({ error: "Milestone ID is required for milestone invoices" });
              return;
            }
            invoice = await automationService.generateMilestoneInvoice(projectId, milestoneId);
            break;
          case 'retainer':
            invoice = await automationService.generateRetainerInvoice(projectId);
            break;
          default:
            invoice = await automationService.generateInvoiceOnProjectCreation(projectId);
        }
        
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Error generating invoice for project:", error);
        res.status(500).json({ 
          error: "Failed to generate invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Generate custom invoice
  router.post(
    "/generate/custom",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const invoiceData = req.body as Partial<InvoiceSchema>;
        const orgId = req.auth!.orgId;
        
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        const automationService = new InvoiceAutomationService(prisma, config);
        
        const invoice = await automationService.generateCustomInvoice(invoiceData);
        
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Error generating custom invoice:", error);
        res.status(500).json({ 
          error: "Failed to generate custom invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Generate PDF for invoice
  router.post(
    "/:invoiceId/pdf",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const invoiceId = routeParam(req.params.invoiceId);
        const { stamp, watermark } = req.body;
        
        // Get invoice from database
        const invoice = await getInvoiceFromDatabase(prisma, invoiceId);
        
        if (!invoice) {
          res.status(404).json({ error: "Invoice not found" });
          return;
        }
        
        const pdfGenerator = new PDFGenerator({
          filename: `${invoice.invoice_number}.pdf`,
          stamp,
          watermark,
        });
        
        const pdfBuffer = await pdfGenerator.generatePDF(invoice);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
        res.send(pdfBuffer);
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  );

  // Process invoice payment
  router.post(
    "/:invoiceId/payment",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const invoiceId = routeParam(req.params.invoiceId);
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
          res.status(400).json({ error: "Invalid payment amount" });
          return;
        }
        
        const orgId = req.auth!.orgId;
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        const automationService = new InvoiceAutomationService(prisma, config);
        
        const updatedInvoice = await automationService.processInvoicePayment(invoiceId, amount);
        
        res.json(updatedInvoice);
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({ error: "Failed to process payment" });
      }
    }
  );

  // Get invoice analytics
  router.get(
    "/analytics",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const { startDate, endDate } = req.query;
        
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        const automationService = new InvoiceAutomationService(prisma, config);
        
        const dateRange = startDate && endDate ? {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        } : undefined;
        
        const analytics = await automationService.getInvoiceAnalytics(dateRange);
        
        res.json(analytics);
      } catch (error) {
        console.error("Error getting analytics:", error);
        res.status(500).json({ error: "Failed to get analytics" });
      }
    }
  );

  // List invoices
  router.get(
    "/",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const { status, page = 1, limit = 20 } = req.query;
        
        const whereClause: any = {
          orgId,
          deletedAt: null,
        };
        
        if (status) {
          whereClause.status = status;
        }
        
        const invoices = await prisma.invoice.findMany({
          where: whereClause,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
            items: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        });
        
        const total = await prisma.invoice.count({
          where: whereClause,
        });
        
        res.json({
          invoices,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        });
      } catch (error) {
        console.error("Error listing invoices:", error);
        res.status(500).json({ error: "Failed to list invoices" });
      }
    }
  );

  // Get single invoice
  router.get(
    "/:invoiceId",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const invoiceId = routeParam(req.params.invoiceId);
        const orgId = req.auth!.orgId;

        const invoice = await prisma.invoice.findFirst({
          where: {
            id: invoiceId,
            orgId,
            deletedAt: null,
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                projectDetails: true,
              },
            },
            items: true,
          },
        });
        
        if (!invoice) {
          res.status(404).json({ error: "Invoice not found" });
          return;
        }
        
        res.json(invoice);
      } catch (error) {
        console.error("Error getting invoice:", error);
        res.status(500).json({ error: "Failed to get invoice" });
      }
    }
  );

  // Send invoice reminder
  router.post(
    "/:invoiceId/reminder",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const invoiceId = routeParam(req.params.invoiceId);
        const orgId = req.auth!.orgId;
        
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        const automationService = new InvoiceAutomationService(prisma, config);
        
        // Trigger reminder sending
        await automationService.sendInvoiceReminders();
        
        res.json({ message: "Reminder sent successfully" });
      } catch (error) {
        console.error("Error sending reminder:", error);
        res.status(500).json({ error: "Failed to send reminder" });
      }
    }
  );

  // Apply late fees (admin only)
  router.post(
    "/apply-late-fees",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        
        const config = await getOrganizationInvoiceConfig(prisma, orgId);
        const automationService = new InvoiceAutomationService(prisma, config);
        
        await automationService.applyLateFees();
        
        res.json({ message: "Late fees applied successfully" });
      } catch (error) {
        console.error("Error applying late fees:", error);
        res.status(500).json({ error: "Failed to apply late fees" });
      }
    }
  );

  return router;
}

// Helper functions
async function getOrganizationInvoiceConfig(prisma: PrismaClient, orgId: string): Promise<InvoiceAutomationConfig> {
  // Default configuration - in a real implementation, this would be stored in the database
  return {
    organization_id: orgId,
    invoice_number: {
      prefix: "CD-INV",
      format: "{seq:3}/{year:2}",
      separator: "-",
      reset_frequency: "yearly",
    },
    due_date: {
      default_days: 7, // 7 days as requested
      business_days_only: false,
    },
    tax: {
      default_rate: 0,
    },
    automation: {
      auto_generate_on_project_create: false,
      auto_generate_on_milestone_complete: true,
      auto_send_invoice: false,
      auto_reminders: {
        enabled: true,
        schedule: [3, 1], // 3 days and 1 day before due
      },
    },
  };
}

async function updateOrganizationInvoiceConfig(
  prisma: PrismaClient, 
  orgId: string, 
  configData: Partial<InvoiceAutomationConfig>
): Promise<void> {
  // In a real implementation, this would update the configuration in the database
  console.log(`Updating invoice config for org ${orgId}:`, configData);
}

async function getInvoiceFromDatabase(prisma: PrismaClient, invoiceId: string): Promise<InvoiceSchema | null> {
  // In a real implementation, this would get the invoice from the database and convert to InvoiceSchema
  return null;
}
