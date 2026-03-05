// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function clientRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  async function getClientForUser(orgId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user?.email) return null;

    const client = await prisma.client.findFirst({
      where: {
        orgId,
        email: user.email,
        deletedAt: null
      }
    });
    return client;
  }

  router.get(
    "/projects",
    requireRoles([ROLE_KEYS.client]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;

      const client = await getClientForUser(orgId, userId);
      if (!client) {
        res.status(404).json({ error: "Client mapping not found" });
        return;
      }

      const projects = await prisma.project.findMany({
        where: {
          orgId,
          clientId: client.id,
          deletedAt: null
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(projects);
    }
  );

  router.get(
    "/projects/:projectId/milestones",
    requireRoles([ROLE_KEYS.client]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { projectId } = req.params;

      const client = await getClientForUser(orgId, userId);
      if (!client) {
        res.status(404).json({ error: "Client mapping not found" });
        return;
      }

      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          orgId,
          clientId: client.id,
          deletedAt: null
        }
      });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const milestones = await prisma.milestone.findMany({
        where: {
          orgId,
          projectId,
          deletedAt: null
        },
        orderBy: { dueDate: "asc" }
      });

      res.json(milestones);
    }
  );

  router.get(
    "/invoices",
    requireRoles([ROLE_KEYS.client]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;

      const client = await getClientForUser(orgId, userId);
      if (!client) {
        res.status(404).json({ error: "Client mapping not found" });
        return;
      }

      const invoices = await prisma.invoice.findMany({
        where: {
          orgId,
          clientId: client.id,
          deletedAt: null
        },
        orderBy: { issueDate: "desc" }
      });

      res.json(invoices);
    }
  );

  router.get(
    "/payments",
    requireRoles([ROLE_KEYS.client]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;

      const client = await getClientForUser(orgId, userId);
      if (!client) {
        res.status(404).json({ error: "Client mapping not found" });
        return;
      }

      const invoices = await prisma.invoice.findMany({
        where: {
          orgId,
          clientId: client.id,
          deletedAt: null
        },
        select: { id: true }
      });
      const invoiceIds = invoices.map((i) => i.id);

      const payments = await prisma.payment.findMany({
        where: {
          orgId,
          invoiceId: { in: invoiceIds },
          deletedAt: null
        },
        orderBy: { receivedAt: "desc" }
      });

      res.json(payments);
    }
  );

  return router;
}

