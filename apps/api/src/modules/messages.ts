import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  composeNotificationTier,
  composeNotificationType,
  renderComposeEmail,
  type ComposeChannel
} from "../lib/compose-email";
import { getEmailSender } from "../lib/email-senders";
import { sendOutboundEmail } from "../lib/resend";
import { ROLE_KEYS } from "./auth-middleware";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rolesForChannel(channel: ComposeChannel): string[] {
  if (channel === "finance") return [ROLE_KEYS.admin, ROLE_KEYS.finance];
  if (channel === "director") return [ROLE_KEYS.admin, ROLE_KEYS.director];
  if (channel === "sales") return [ROLE_KEYS.admin, ROLE_KEYS.sales];
  return [ROLE_KEYS.admin];
}

function parseChannel(raw: unknown): ComposeChannel | null {
  const c = typeof raw === "string" ? raw.trim() : "";
  if (c === "finance" || c === "director" || c === "sales") return c;
  return null;
}

export default function messagesRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.post("/send", async (req, res) => {
    const channel = parseChannel((req.body as { channel?: string })?.channel);
    if (!channel) {
      res.status(400).json({ error: "channel must be finance, director, or sales" });
      return;
    }

    const allowed = rolesForChannel(channel);
    const roleKeys = req.auth?.roleKeys ?? [];
    if (!roleKeys.some((r) => allowed.includes(r))) {
      res.status(403).json({ error: "Not allowed to send from this department" });
      return;
    }

    const body = req.body as { to?: string; subject?: string; message?: string; body?: string };
    const to = (body.to ?? "").trim().toLowerCase();
    const subject = (body.subject ?? "").trim();
    const messageText = (body.message ?? body.body ?? "").trim();

    if (!to || !EMAIL_RE.test(to)) {
      res.status(400).json({ error: "Valid recipient email is required" });
      return;
    }
    if (!subject || subject.length > 200) {
      res.status(400).json({ error: "Subject is required (max 200 characters)" });
      return;
    }
    if (!messageText || messageText.length > 20_000) {
      res.status(400).json({ error: "Message body is required (max 20,000 characters)" });
      return;
    }

    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const { html, text } = renderComposeEmail({ channel, subject, bodyText: messageText });
    const sender = getEmailSender(channel);

    const result = await sendOutboundEmail({
      to,
      subject,
      text,
      html,
      emailChannel: channel
    });

    const notifType = composeNotificationType(channel);
    await prisma.notification.create({
      data: {
        orgId,
        channel: "email",
        to,
        subject,
        body: messageText.slice(0, 4000),
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error.slice(0, 900),
        sentAt: new Date(),
        type: notifType,
        tier: composeNotificationTier(channel)
      }
    });

    if (result.ok) {
      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: "message.sent",
          entityType: "email",
          entityId: result.id ?? to,
          metadata: { channel, to, subject: subject.slice(0, 120), from: sender.from }
        }
      });
      res.status(201).json({ ok: true, id: result.id, from: sender.from });
    } else {
      res.status(502).json({ ok: false, error: result.error });
    }
  });

  router.get("/sent", async (req, res) => {
    const channel = parseChannel(typeof req.query.channel === "string" ? req.query.channel : "");
    if (!channel) {
      res.status(400).json({ error: "channel query must be finance, director, or sales" });
      return;
    }
    const allowed = rolesForChannel(channel);
    if (!req.auth?.roleKeys.some((r) => allowed.includes(r))) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    const orgId = req.auth!.orgId;
    const notifType = composeNotificationType(channel);
    const rows = await prisma.notification.findMany({
      where: { orgId, channel: "email", type: notifType },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        to: true,
        subject: true,
        body: true,
        status: true,
        error: true,
        sentAt: true,
        createdAt: true
      }
    });

    res.json({ items: rows });
  });

  return router;
}
