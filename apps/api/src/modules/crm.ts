// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { notifyDirectors } from "./director-notifications";

export default function crmRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Clients
  router.get(
    "/clients",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.finance, ROLE_KEYS.admin]),
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
        ownerId: userId,
        approvalStatus: "pending_approval"
      }
    });
    await notifyDirectors(prisma, orgId, "New lead created", `Lead "${lead.title}" was added and is pending your approval.`);
    res.status(201).json(lead);
    }
  );

  // Single lead (with comments, follow-ups)
  router.get(
    "/leads/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const lead = await prisma.lead.findFirst({
        where: { id, orgId, deletedAt: null },
        include: {
          client: true,
          owner: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
          followUps: { include: { assignedTo: { select: { id: true, name: true, email: true } } }, orderBy: { scheduledAt: "asc" } }
        }
      });
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    }
  );

  // Director: approve or reject lead
  router.patch(
    "/leads/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const body = req.body as { approvalStatus?: string; status?: string; title?: string; source?: string };
      const lead = await prisma.lead.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const isDirector = req.auth!.roleKeys.some((k) => [ROLE_KEYS.director, ROLE_KEYS.admin].includes(k));
      if (body.approvalStatus != null && (body.approvalStatus === "approved" || body.approvalStatus === "rejected")) {
        if (!isDirector) return res.status(403).json({ error: "Only director can approve or reject leads" });
        const updated = await prisma.lead.update({
          where: { id },
          data: {
            approvalStatus: body.approvalStatus,
            approvedById: userId,
            approvedAt: new Date()
          }
        });
        await notifyDirectors(prisma, orgId, "Lead approval updated", `Lead "${lead.title}" was ${body.approvalStatus}.`);
        return res.json(updated);
      }
      // Sales/owner: update status, title, source only
      if (lead.ownerId !== userId && !isDirector) return res.status(403).json({ error: "Not your lead" });
      const updated = await prisma.lead.update({
        where: { id },
        data: {
          ...(body.status != null && { status: body.status }),
          ...(body.title != null && { title: body.title }),
          ...(body.source != null && { source: body.source })
        }
      });
      res.json(updated);
    }
  );

  // Director: comment on lead
  router.post(
    "/leads/:id/comments",
    requireRoles([ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { content } = req.body as { content?: string };
      if (!content || !content.trim()) return res.status(400).json({ error: "Content is required" });
      const lead = await prisma.lead.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      const comment = await prisma.leadComment.create({
        data: { leadId: id, orgId, authorId: userId, content: content.trim() },
        include: { author: { select: { id: true, name: true, email: true } } }
      });
      res.status(201).json(comment);
    }
  );

  // Follow-up: schedule meeting or call (sales or director)
  const REMINDER_SLOTS_DEFAULT = [2880, 1440, 60, 30, 5, 0]; // 2d, 1d, 1h, 30m, 5m, at time
  router.post(
    "/leads/:id/follow-ups",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const body = req.body as {
        type: string;
        name?: string;
        business?: string;
        reason?: string;
        phone?: string;
        scheduledAt: string;
        assignedToId?: string;
        reminderSlots?: number[];
      };
      if (!body.type || !body.scheduledAt) return res.status(400).json({ error: "type and scheduledAt are required" });
      if (!["meeting", "call"].includes(body.type)) return res.status(400).json({ error: "type must be meeting or call" });
      const lead = await prisma.lead.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      const assignedToId = body.assignedToId ?? lead.ownerId ?? req.auth!.userId;
      const scheduledAt = new Date(body.scheduledAt);
      if (isNaN(scheduledAt.getTime())) return res.status(400).json({ error: "Invalid scheduledAt" });
      const followUp = await prisma.leadFollowUp.create({
        data: {
          leadId: id,
          orgId,
          type: body.type,
          name: body.name,
          business: body.business,
          reason: body.reason,
          phone: body.phone,
          scheduledAt,
          assignedToId,
          reminderSlots: body.reminderSlots ?? REMINDER_SLOTS_DEFAULT
        },
        include: { assignedTo: { select: { id: true, name: true, email: true } }, lead: { select: { id: true, title: true } } }
      });
      res.status(201).json(followUp);
    }
  );

  router.get(
    "/leads/:id/follow-ups",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const lead = await prisma.lead.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      const list = await prisma.leadFollowUp.findMany({
        where: { leadId: id },
        orderBy: { scheduledAt: "asc" },
        include: { assignedTo: { select: { id: true, name: true, email: true } } }
      });
      res.json(list);
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
  // Outreach contacts (emails/phones for sending service communications)
  router.get(
    "/contacts",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const contacts = await prisma.crmContact.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { addedBy: { select: { id: true, name: true, email: true } } }
      });
      res.json(contacts);
    }
  );

  router.post(
    "/contacts",
    requireRoles([ROLE_KEYS.sales]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const body = req.body as { email?: string; phone?: string; name?: string };
      const email = typeof body.email === "string" ? body.email.trim() || undefined : undefined;
      const phone = typeof body.phone === "string" ? body.phone.trim() || undefined : undefined;
      const name = typeof body.name === "string" ? body.name.trim() || undefined : undefined;
      if (!email && !phone) {
        res.status(400).json({ error: "At least one of email or phone is required" });
        return;
      }
      const contact = await prisma.crmContact.create({
        data: { orgId, addedById: userId, email, phone, name },
        include: { addedBy: { select: { id: true, name: true, email: true } } }
      });
      res.status(201).json(contact);
    }
  );

  router.delete(
    "/contacts/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const contact = await prisma.crmContact.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!contact) return res.status(404).json({ error: "Contact not found" });
      await prisma.crmContact.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
      res.status(204).send();
    }
  );

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

