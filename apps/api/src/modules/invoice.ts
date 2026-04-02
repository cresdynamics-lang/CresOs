import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { InvoiceService } from "../services/invoice/service";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import multer from "multer";

const upload = multer({ dest: 'uploads/' });

export default function invoiceRoutes(prisma: PrismaClient): Router {
  const router = createRouter();
  const invoiceService = new InvoiceService(prisma);

  // Generate invoice from finance request
  router.post(
    "/generate-from-request",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const { financeRequestId, templateId } = req.body;

        if (!financeRequestId) {
          res.status(400).json({ error: "Finance request ID is required" });
          return;
        }

        const generatedInvoice = await invoiceService.generateInvoiceFromFinanceRequest(
          financeRequestId,
          templateId
        );

        res.status(201).json(generatedInvoice);
      } catch (error) {
        console.error("Error generating invoice from finance request:", error);
        res.status(500).json({ 
          error: "Failed to generate invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Generate invoice for client directly
  router.post(
    "/generate-for-client",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const { clientId, invoiceData, templateId } = req.body;
        const orgId = req.auth!.orgId;

        if (!clientId) {
          res.status(400).json({ error: "Client ID is required" });
          return;
        }

        const generatedInvoice = await invoiceService.generateInvoiceForClient(
          clientId,
          orgId,
          invoiceData,
          templateId
        );

        res.status(201).json(generatedInvoice);
      } catch (error) {
        console.error("Error generating invoice for client:", error);
        res.status(500).json({ 
          error: "Failed to generate invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get available invoice templates
  router.get(
    "/templates",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const templates = await invoiceService.getInvoiceTemplates();
        res.json(templates);
      } catch (error) {
        console.error("Error getting invoice templates:", error);
        res.status(500).json({ error: "Failed to get templates" });
      }
    }
  );

  // Upload invoice template
  router.post(
    "/templates/upload",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin]),
    upload.single('template'),
    async (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No file uploaded" });
          return;
        }

        const { templateName } = req.body;
        if (!templateName) {
          res.status(400).json({ error: "Template name is required" });
          return;
        }

        const template = await invoiceService.uploadInvoiceTemplate(
          templateName,
          req.file.path
        );

        // Clean up uploaded file
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        res.status(201).json(template);
      } catch (error) {
        console.error("Error uploading invoice template:", error);
        res.status(500).json({ 
          error: "Failed to upload template", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get generated invoice
  router.get(
    "/:id",
    requireRoles([ROLE_KEYS.finance, ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      try {
        const { id } = req.params;
        const orgId = req.auth!.orgId;
        const invoiceId = Array.isArray(id) ? id[0] : id;

        const invoice = await invoiceService.getGeneratedInvoice(invoiceId, orgId);
        res.json(invoice);
      } catch (error) {
        console.error("Error getting generated invoice:", error);
        res.status(500).json({ 
          error: "Failed to get invoice", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  return router;
}
