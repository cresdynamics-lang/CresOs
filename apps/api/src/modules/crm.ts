import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function crmRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Clients
  router.get(
    "/clients",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const clients = await prisma.client.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    res.json(clients);
    }
  );

  router.post(
    "/clients",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const { name, email, phone } = req.body as {
      name: string;
      email?: string;
      phone?: string;
    };
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const client = await prisma.client.create({
      data: { orgId, name, email, phone }
    });
    res.status(201).json(client);
    }
  );

  // Leads
  router.get(
    "/leads",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const leads = await prisma.lead.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    });
    res.json(leads);
    }
  );

  router.post(
    "/leads",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { title, clientId, source } = req.body as {
      title: string;
      clientId?: string;
      source?: string;
    };
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    const lead = await prisma.lead.create({
      data: {
        orgId,
        title,
        clientId,
        source,
        status: "new",
        ownerId: userId
      }
    });
    res.status(201).json(lead);
    }
  );

  // Deals
  router.get(
    "/deals",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const deals = await prisma.deal.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { client: true, lead: true }
    });
    res.json(deals);
    }
  );

  router.post(
    "/deals",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { title, clientId, leadId, value, currency, stage } = req.body as {
      title: string;
      clientId?: string;
      leadId?: string;
      value?: string;
      currency?: string;
      stage?: string;
    };
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    const deal = await prisma.deal.create({
      data: {
        orgId,
        title,
        clientId,
        leadId,
        value: value ? new Prisma.Decimal(value) : undefined,
        currency,
        stage: stage ?? "prospect",
        ownerId: userId
      }
    });
    res.status(201).json(deal);
    }
  );

  // Request approval to mark deal as won
  router.post(
    "/deals/:id/win-request",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;

      const deal = await prisma.deal.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!deal) {
        res.status(404).json({ error: "Deal not found" });
        return;
      }

      const approval = await prisma.approval.create({
        data: {
          orgId,
          requesterId: userId,
          entityType: "deal",
          entityId: deal.id,
          status: "pending",
          reason: "Deal win requires approval"
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "approval.requested",
          entityType: "deal",
          entityId: deal.id,
          metadata: { approvalId: approval.id }
        }
      });

      res.status(201).json({ deal, approval });
    }
  );

  // Deal activities
  router.get(
    "/deals/:id/activities",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params;
    const activities = await prisma.dealActivity.findMany({
      where: { orgId, dealId: id },
      orderBy: { occurredAt: "desc" }
    });
    res.json(activities);
    }
  );

  router.post(
    "/deals/:id/activities",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params;
    const { type, summary } = req.body as { type: string; summary: string };
    if (!type || !summary) {
      res.status(400).json({ error: "type and summary are required" });
      return;
    }
    const allowedTypes = [
      "follow_up",
      "proposal",
      "negotiation",
      "close",
      "lost"
    ];
    if (!allowedTypes.includes(type)) {
      res.status(400).json({ error: "Invalid activity type" });
      return;
    }
    const activity = await prisma.dealActivity.create({
      data: {
        orgId,
        dealId: id,
        type,
        summary
      }
    });
    res.status(201).json(activity);
    }
  );

  return router;
}

