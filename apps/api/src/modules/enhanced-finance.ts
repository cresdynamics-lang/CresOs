import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { FinanceInvoiceService } from "../services/invoice/finance-integration";
import { formatOrgInvoiceNumber } from "../services/invoice/invoice-number";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import financeSidePanelRouter from "./finance-side-panel";

export default function enhancedFinanceRouter(prisma: PrismaClient): Router {
  const router = createRouter();
  const financeInvoiceService = new FinanceInvoiceService(prisma);

  // Mount the side panel routes
  router.use('/side-panel', financeSidePanelRouter(prisma));

  // Enhanced invoice creation with PDF generation
  router.post(
    "/invoices/with-pdf",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const createdBy = req.auth!.userId;
        const invoiceData = req.body;

        console.log('🚀 Creating finance invoice with PDF generation...');

        const { invoice, pdfBuffer } = await financeInvoiceService.createFinanceInvoice(
          orgId,
          invoiceData,
          createdBy
        );

        // Return invoice data and PDF info
        res.status(201).json({
          success: true,
          invoice,
          pdfGenerated: true,
          pdfSize: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
          message: `Invoice ${invoice.number} created with PDF`
        });

      } catch (error) {
        console.error("Error creating invoice with PDF:", error);
        res.status(500).json({ 
          error: "Failed to create invoice with PDF", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Auto-generate invoice for project (when sales person creates project)
  router.post(
    "/projects/:projectId/generate-invoice",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.sales]),
    async (req, res) => {
      try {
        const { projectId } = req.params;
        const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
        const orgId = req.auth!.orgId;
        const createdBy = req.auth!.userId;

        console.log(`🚀 Auto-generating invoice for project: ${projectId}`);

        const { invoice, pdfBuffer } = await financeInvoiceService.generateProjectInvoice(
          projectIdStr,
          orgId,
          createdBy
        );

        res.status(201).json({
          success: true,
          invoice,
          pdfGenerated: true,
          pdfSize: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
          message: `Invoice ${invoice.number} auto-generated for project`
        });

      } catch (error) {
        console.error("Error auto-generating project invoice:", error);
        res.status(500).json({ 
          error: "Failed to auto-generate invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoice with PDF for download
  router.get(
    "/invoices/:invoiceId/pdf",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const invoiceIdStr = Array.isArray(invoiceId) ? invoiceId[0] : invoiceId;
        const orgId = req.auth!.orgId;

        const { invoice, pdfBuffer } = await financeInvoiceService.getInvoiceWithPDF(
          invoiceIdStr,
          orgId
        );

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);

      } catch (error) {
        console.error("Error getting invoice PDF:", error);
        res.status(500).json({ 
          error: "Failed to get invoice PDF", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get invoice preview (metadata only)
  router.get(
    "/invoices/:invoiceId/preview",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const { invoiceId } = req.params;
        const invoiceIdStr = Array.isArray(invoiceId) ? invoiceId[0] : invoiceId;
        const orgId = req.auth!.orgId;

        const { invoice } = await financeInvoiceService.getInvoiceWithPDF(
          invoiceIdStr,
          orgId
        );

        // Return invoice metadata without PDF
        res.json({
          success: true,
          invoice: {
            id: invoice.id,
            number: invoice.number,
            clientId: invoice.clientId,
            projectId: invoice.projectId,
            status: invoice.status,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            totalAmount: invoice.totalAmount,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt
          },
          pdfAvailable: true
        });

      } catch (error) {
        console.error("Error getting invoice preview:", error);
        res.status(500).json({ 
          error: "Failed to get invoice preview", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Generate invoice number preview
  router.post(
    "/invoices/preview-number",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      try {
        const { clientId, projectId } = req.body;
        const orgId = req.auth!.orgId;

        const totalCreated = await prisma.invoice.count({ where: { orgId } });
        const invoiceNumber = formatOrgInvoiceNumber(totalCreated + 1, new Date());

        res.json({
          success: true,
          invoiceNumber,
          format: "CD-INV-{seq:6}/{yy}",
          basedOn: "Next org-wide sequence (creation order)"
        });

      } catch (error) {
        console.error("Error generating invoice number preview:", error);
        res.status(500).json({ 
          error: "Failed to generate invoice number", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Validate invoice data before creation
  router.post(
    "/invoices/validate",
    requireRoles([ROLE_KEYS.finance]),
    async (req, res) => {
      try {
        const invoiceData = req.body;
        const orgId = req.auth!.orgId;

        // Basic validation
        const errors = [];
        
        if (!invoiceData.clientId) {
          errors.push("Client ID is required");
        }
        
        if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
          errors.push("At least one item is required");
        }
        
        if (invoiceData.items) {
          invoiceData.items.forEach((item: any, index: number) => {
            if (!item.description) {
              errors.push(`Item ${index + 1}: Description is required`);
            }
            if (!item.unitPrice || isNaN(Number(item.unitPrice))) {
              errors.push(`Item ${index + 1}: Valid unit price is required`);
            }
            if (item.quantity && (isNaN(Number(item.quantity)) || Number(item.quantity) <= 0)) {
              errors.push(`Item ${index + 1}: Valid quantity is required`);
            }
          });
        }

        // Check if client exists
        if (invoiceData.clientId) {
          const client = await prisma.client.findFirst({
            where: { id: invoiceData.clientId, orgId, deletedAt: null },
            select: { id: true, name: true }
          });
          
          if (!client) {
            errors.push("Client not found");
          }
        }

        // Check if project exists (if provided)
        if (invoiceData.projectId) {
          const project = await prisma.project.findFirst({
            where: { id: invoiceData.projectId, orgId, deletedAt: null },
            select: { id: true, name: true }
          });
          
          if (!project) {
            errors.push("Project not found");
          }
        }

        if (errors.length > 0) {
          res.status(400).json({
            success: false,
            errors,
            message: "Validation failed"
          });
        } else {
          res.json({
            success: true,
            message: "Invoice data is valid",
            validatedAt: new Date().toISOString()
          });
        }

      } catch (error) {
        console.error("Error validating invoice data:", error);
        res.status(500).json({ 
          error: "Validation failed", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  return router;
}

// Import DocxTemplateParser for the invoice number generation
import { DocxTemplateParser } from "../services/invoice/docx-parser";
