// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { notifyDirectors } from "./director-notifications";

/** Admin oversight: hide raw client contact unless user also has Finance or Sales role. */
function maskClientForAdmin<T extends { email?: string | null; phone?: string | null }>(
  roleKeys: string[],
  row: T
): T {
  const hasFinance = roleKeys.includes("finance");
  const hasSales = roleKeys.includes("sales");
  const isAdmin = roleKeys.includes("admin");
  if (!isAdmin || hasFinance || hasSales) return row;
  return {
    ...row,
    email: row.email ? "•••• (restricted)" : null,
    phone: row.phone ? "•••• (restricted)" : null
  };
}

export default function crmRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Clients
  router.get(
    "/clients",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const roleKeys = req.auth!.roleKeys;
    const clients = await prisma.client.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    res.json(clients.map((c) => maskClientForAdmin(roleKeys, c)));
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
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
    const orgId = req.auth!.orgId;
    const leads = await prisma.lead.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        project: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } }
      }
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
    const { title, clientId, projectId, source } = req.body as {
      title: string;
      clientId?: string;
      projectId?: string;
      source?: string;
    };
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    if (!projectId) {
      res.status(400).json({ error: "projectId is required — lead must be tied to an existing project." });
      return;
    }
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, deletedAt: null }
    });
    if (!project) {
      res.status(400).json({ error: "Project not found for this organisation." });
      return;
    }
    const lead = await prisma.lead.create({
      data: {
        orgId,
        title,
        clientId: clientId ?? project.clientId,
        projectId: project.id,
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
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.finance, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const lead = await prisma.lead.findFirst({
        where: { id, orgId, deletedAt: null },
        include: {
          client: true,
          project: { select: { id: true, name: true, approvalStatus: true } },
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

  // Admin: approve or reject lead; sales/analyst: update own lead fields
  router.patch(
    "/leads/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const body = req.body as { approvalStatus?: string; status?: string; title?: string; source?: string };
      const lead = await prisma.lead.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);
      if (body.approvalStatus != null && (body.approvalStatus === "approved" || body.approvalStatus === "rejected")) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Only org admin can approve or reject leads" });
        }
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
      // Sales/owner: update status, title, source only (admin may override)
      if (lead.ownerId !== userId && !isAdmin) return res.status(403).json({ error: "Not your lead" });
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

  // Admin: comment on lead
  router.post(
    "/leads/:id/comments",
    requireRoles([ROLE_KEYS.admin]),
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
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.analyst]),
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
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
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
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.analyst, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const [manualContacts, clientContacts] = await Promise.all([
        prisma.crmContact.findMany({
          where: { orgId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { addedBy: { select: { id: true, name: true, email: true } } }
        }),
        prisma.client.findMany({
          where: {
            orgId,
            deletedAt: null,
            projects: {
              some: { deletedAt: null }
            }
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        })
      ]);

      const mappedManual = manualContacts.map((c) => ({
        id: c.id,
        email: c.email,
        phone: c.phone,
        name: c.name,
        addedBy: c.addedBy,
        kind: "manual" as const
      }));

      const mappedClients = clientContacts.map((c) => ({
        id: `client:${c.id}`,
        email: c.email,
        phone: c.phone,
        name: c.name,
        addedBy: null,
        kind: "client_with_project" as const
      }));

      res.json([...mappedManual, ...mappedClients]);
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

  // Sample copy for bulk email to clients / CRM contacts (sales picks a template, edits, sends)
  router.get(
    "/message-templates",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (_req, res) => {
      res.json({
        templates: [
          {
            id: "invoice_followup",
            name: "Invoice / payment reminder",
            subject: "Following up on your invoice",
            body:
              "Hi {{name}},\n\n" +
              "I’m writing to follow up on a recent invoice. If you’ve already paid, thank you — please disregard this note. If anything is unclear or you need a copy resent, reply to this email and we’ll sort it out quickly.\n\n" +
              "Best regards"
          },
          {
            id: "new_product",
            name: "New product introduction",
            subject: "Something new we think fits your needs",
            body:
              "Hi {{name}},\n\n" +
              "We’ve launched a new product line and wanted you to be among the first to know. I’d be glad to walk you through how it could help your situation — happy to schedule a short call at your convenience.\n\n" +
              "Best regards"
          },
          {
            id: "new_service",
            name: "New service introduction",
            subject: "New service now available",
            body:
              "Hi {{name}},\n\n" +
              "We’re introducing a new service designed to support clients like you more closely. If you’d like an overview or to discuss whether it’s a fit, just reply and we’ll set up a time.\n\n" +
              "Best regards"
          }
        ]
      });
    }
  );

  /** Queue one outbound email per recipient (same pattern as other queued notifications). */
  router.post(
    "/bulk-message",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const body = req.body as {
        contactIds?: string[];
        subject?: string;
        body?: string;
      };
      const contactIds = Array.isArray(body.contactIds) ? body.contactIds : [];
      const subject = typeof body.subject === "string" ? body.subject.trim() : "";
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (contactIds.length === 0 || !subject || !text) {
        res.status(400).json({ error: "contactIds (non-empty), subject, and body are required" });
        return;
      }
      if (contactIds.length > 200) {
        res.status(400).json({ error: "Maximum 200 recipients per send." });
        return;
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
        select: { name: true }
      });
      const orgName = org?.name ?? "CresOS";

      type Recipient = { email: string; label: string };
      const recipients: Recipient[] = [];
      const seen = new Set<string>();

      for (const rawId of contactIds) {
        if (typeof rawId !== "string" || !rawId.trim()) continue;
        if (rawId.startsWith("client:")) {
          const clientId = rawId.slice("client:".length);
          const c = await prisma.client.findFirst({
            where: { id: clientId, orgId, deletedAt: null },
            select: { name: true, email: true }
          });
          if (c?.email) {
            const em = c.email.trim().toLowerCase();
            if (!seen.has(em)) {
              seen.add(em);
              recipients.push({ email: c.email.trim(), label: (c.name || "").trim() || c.email.trim() });
            }
          }
        } else {
          const c = await prisma.crmContact.findFirst({
            where: { id: rawId, orgId, deletedAt: null },
            select: { name: true, email: true }
          });
          if (c?.email) {
            const em = c.email.trim().toLowerCase();
            if (!seen.has(em)) {
              seen.add(em);
              recipients.push({ email: c.email.trim(), label: (c.name || "").trim() || c.email.trim() });
            }
          }
        }
      }

      if (recipients.length === 0) {
        res.status(400).json({
          error: "No recipients with an email on file. Add an email to the contact or choose contacts that have email."
        });
        return;
      }

      const emailSubject = subject.includes(orgName) ? subject : `[${orgName}] ${subject}`;

      await prisma.notification.createMany({
        data: recipients.map((r) => {
          const personalized = text
            .replace(/\{\{name\}\}/gi, r.label)
            .replace(/\{\{org\}\}/gi, orgName);
          return {
            orgId,
            channel: "email",
            to: r.email,
            subject: emailSubject,
            body: personalized,
            status: "queued",
            type: "crm.bulk_message",
            tier: "execution"
          };
        })
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "crm.bulk_message",
          entityType: "org",
          entityId: orgId,
          metadata: {
            recipientCount: recipients.length,
            subject: emailSubject,
            requestedIds: contactIds.length
          }
        }
      });

      res.status(201).json({
        success: true,
        queued: recipients.length,
        skippedNoEmail: contactIds.length - recipients.length
      });
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

