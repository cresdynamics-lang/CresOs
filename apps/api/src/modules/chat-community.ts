/**
 * Chat Community Router
 * 
 * Provides API endpoints for the chat community system
 * including real-time messaging, inbox, and user communication
 */

import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ALL_APP_ROLE_KEYS, ROLE_KEYS } from "./auth-middleware";
import multer from "multer";
import {
  ensureChatUserAndInbox,
  createOrGetDirectConversation,
  mergeUnreadCounts,
  displayNameOrEmail,
  getUserIdsInOrg
} from "./chat-community-helpers";
import { saveChatUpload, messageTypeFromMime } from "../lib/chat-uploads";
import { composeAssistText } from "../lib/groq-compose-assist";

// Configure multer for file uploads (images, docs, audio, video; block obvious executables)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.min(
      1024 * 1024 * 1024,
      Math.max(5 * 1024 * 1024, Number(process.env.CHAT_UPLOAD_MAX_FILE_BYTES ?? 0) || 250 * 1024 * 1024)
    )
  },
  fileFilter: (_req, file, cb) => {
    const n = (file.originalname || "").toLowerCase();
    if (/\.(exe|bat|cmd|msi|scr|pif|cpl|com)$/i.test(n)) {
      cb(new Error("File type not allowed"));
      return;
    }
    cb(null, true);
  }
});

function uploadChatFields(req: any, res: any, next: any) {
  const mw = upload.fields([{ name: "files" }, { name: "file" }]);
  mw(req, res, (err: unknown) => {
    if (!err) return next();
    // Multer errors happen *before* the route handler, so we must translate them here.
    const anyErr = err as any;
    if (anyErr && anyErr.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File too large",
        hint: "Ask an admin to increase CHAT_UPLOAD_MAX_FILE_BYTES on the server, or upload a smaller file."
      });
    }
    const msg = typeof anyErr?.message === "string" ? anyErr.message : "Upload failed";
    return res.status(400).json({ error: msg });
  });
}

async function refreshConversationLastMessage(prisma: PrismaClient, conversationId: string) {
  const latest = await prisma.message.findFirst({
    where: { conversationId, deletedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" }
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: latest
        ? {
            id: latest.id,
            content: latest.content,
            senderId: latest.senderId,
            timestamp: latest.createdAt.toISOString(),
            type: latest.type
          }
        : Prisma.JsonNull,
      updatedAt: new Date()
    }
  });
}

export default function chatCommunityRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.post(
    "/admin/send",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const body = req.body as {
          roleKey?: string;
          userId?: string;
          content?: string;
          type?: string;
        };

        const content = typeof body.content === "string" ? body.content.trim() : "";
        const type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : "text";
        if (!content) {
          return res.status(400).json({ error: "Message content is required" });
        }

        if (!body.roleKey && !body.userId) {
          return res.status(400).json({ error: "Missing recipient (roleKey or userId)" });
        }

        const recipientUserIds: string[] = [];
        if (body.userId) {
          const recipient = await prisma.user.findFirst({
            where: {
              id: body.userId,
              deletedAt: null,
              OR: [
                { orgId },
                { memberships: { some: { orgId, deletedAt: null } } },
                { roles: { some: { role: { orgId } } } }
              ]
            },
            select: { id: true }
          });
          if (recipient && recipient.id !== userId) recipientUserIds.push(recipient.id);
        } else if (body.roleKey) {
          const users = await prisma.user.findMany({
            where: {
              deletedAt: null,
              id: { not: userId },
              AND: [
                {
                  OR: [
                    { orgId },
                    { memberships: { some: { orgId, deletedAt: null } } },
                    { roles: { some: { role: { orgId } } } }
                  ]
                },
                { roles: { some: { role: { orgId, key: body.roleKey } } } }
              ]
            },
            select: { id: true }
          });
          recipientUserIds.push(...users.map((u) => u.id));
        }

        if (recipientUserIds.length === 0) {
          return res.status(404).json({ error: "No recipients found" });
        }

        await ensureChatUserAndInbox(prisma, userId, orgId, { touchPresence: true });

        const results: Array<{ recipientUserId: string; conversationId: string; messageId: string }> = [];

        for (const recipientId of recipientUserIds) {
          await ensureChatUserAndInbox(prisma, recipientId, orgId, { touchPresence: false });
          const conv = await createOrGetDirectConversation(prisma, orgId, userId, recipientId);

          const created = await prisma.message.create({
            data: {
              conversationId: conv.id,
              senderId: userId,
              content,
              type,
              status: "sent",
              readBy: [{ userId, readAt: new Date().toISOString() }]
            }
          });

          const unreadNext = mergeUnreadCounts(conv.unreadCounts, conv.participants, userId);
          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              lastMessage: {
                id: created.id,
                content: created.content,
                senderId: created.senderId,
                timestamp: created.createdAt.toISOString(),
                type: created.type
              },
              unreadCounts: unreadNext,
              updatedAt: new Date()
            }
          });

          results.push({
            recipientUserId: recipientId,
            conversationId: conv.id,
            messageId: created.id
          });
        }

        res.status(201).json({
          success: true,
          message: "Message sent",
          data: { results }
        });
      } catch (error) {
        console.error("Error sending admin message:", error);
        res.status(500).json({
          error: "Failed to send admin message",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Initialize chat user when user first accesses chat
  router.post(
    "/initialize",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const { displayName } = req.body as { displayName?: string };

        await ensureChatUserAndInbox(prisma, userId, orgId, {
          displayName,
          touchPresence: true
        });

        const chatUser = await prisma.chatUser.findUnique({
          where: { userId },
          select: {
            id: true,
            userId: true,
            username: true,
            displayName: true,
            status: true,
            isOnline: true,
            lastSeen: true
          }
        });

        res.json({
          success: true,
          data: {
            user: chatUser
          }
        });
      } catch (error) {
        console.error("Error initializing chat user:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const lower = message.toLowerCase();
        const status =
          lower.includes("not a member") ? 403 : lower.includes("not found") ? 404 : 500;
        res.status(status).json({
          error: "Failed to initialize chat user",
          message
        });
      }
    }
  );

  // Org members with presence (all users in org; not only online)
  router.get(
    "/online-users",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const roleKeys = req.auth!.roleKeys;
        const isClient = roleKeys.includes(ROLE_KEYS.client);

        const orgUserIds = await getUserIdsInOrg(prisma, orgId);
        const users = await prisma.user.findMany({
          where: {
            id: { in: orgUserIds },
            deletedAt: null,
            ...(isClient
              ? {
                  roles: {
                    some: {
                      role: {
                        key: { in: [ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin] }
                      }
                    }
                  }
                }
              : {
                  roles: {
                    none: {
                      role: {
                        key: ROLE_KEYS.client
                      }
                    }
                  }
                })
          },
          select: {
            id: true,
            name: true,
            profilePicture: true,
            createdAt: true,
            notificationPreferences: true,
            chatUser: {
              select: {
                status: true,
                isOnline: true,
                lastSeen: true,
                displayName: true
              }
            },
            roles: {
              select: {
                role: { select: { name: true, key: true } }
              }
            }
          }
        });

        const onlineUsers = users
          .filter((u) => u.id !== userId)
          .map((u) => {
            const cu = u.chatUser;
            const isOnline = Boolean(cu?.isOnline && cu.status !== "offline");
            const status = (cu?.status as "online" | "offline" | "away" | "busy") || "offline";
            const label = displayNameOrEmail(u.name, "");
            const roleList = u.roles.map((ur) => ({
              key: ur.role.key,
              name: ur.role.name
            }));

            const privacy = (u.notificationPreferences as any)?.privacy ?? {};
            const onlineHours = typeof privacy?.onlineHours === "string" ? privacy.onlineHours : null;
            return {
              id: u.id,
              name: label,
              hasDisplayName: Boolean(u.name?.trim()),
              displayName: cu?.displayName || label,
              roles: roleList,
              status: isOnline ? status : "offline",
              isOnline,
              lastSeen: (cu?.lastSeen ?? u.createdAt).toISOString(),
              avatar: u.profilePicture || null,
              onlineHours
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

        const totalOnline = onlineUsers.filter((u) => u.isOnline).length;

        res.json({
          success: true,
          data: {
            onlineUsers,
            totalOnline,
            totalMembers: onlineUsers.length
          }
        });
      } catch (error) {
        console.error("Error getting org members:", error);
        res.status(500).json({
          error: "Failed to get org members",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Direct-message conversations for current user (persisted; readable when peer comes online)
  router.get(
    "/conversations",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const roleKeys = req.auth!.roleKeys;
        const isClient = roleKeys.includes(ROLE_KEYS.client);
        const callerCanMessageClients = roleKeys.some((k) =>
          [ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin].includes(k as any)
        );

        const rows = await prisma.conversation.findMany({
          where: {
            orgId,
            type: "direct",
            participants: { has: userId }
          },
          orderBy: { updatedAt: "desc" }
        });

        const otherIds = rows
          .map((c) => c.participants.find((p) => p !== userId))
          .filter((id): id is string => Boolean(id));

        const others = await prisma.user.findMany({
          where: {
            id: { in: otherIds },
            deletedAt: null,
            ...(isClient
              ? {
                  roles: {
                    some: {
                      role: {
                        key: { in: [ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin] }
                      }
                    }
                  }
                }
              : callerCanMessageClients
                ? {}
                : {
                    roles: {
                      none: {
                        role: {
                          key: ROLE_KEYS.client
                        }
                      }
                    }
                  })
          },
          select: {
            id: true,
            name: true,
            chatUser: { select: { isOnline: true, status: true } },
            roles: {
              select: { role: { select: { name: true, key: true } } }
            }
          }
        });
        const otherById = new Map(others.map((u) => [u.id, u]));

        const userConversations = rows
          .map((conv) => {
          const otherId = conv.participants.find((p) => p !== userId) ?? "";
          const other = otherById.get(otherId);
          if (!other) return null;
          const unreadMap = conv.unreadCounts as Record<string, number> | null;
          const unreadCount = unreadMap?.[userId] ?? 0;
          const lm = conv.lastMessage as {
            id?: string;
            content?: string;
            senderId?: string;
            timestamp?: string;
            type?: string;
          } | null;
          const lastMessage = lm?.content
            ? {
                id: lm.id ?? "last",
                content: lm.content,
                senderId: lm.senderId ?? userId,
                senderName:
                  lm.senderId === userId
                    ? "You"
                    : displayNameOrEmail(other.name, ""),
                timestamp:
                  typeof lm.timestamp === "string"
                    ? lm.timestamp
                    : conv.updatedAt.toISOString(),
                type: (lm.type as "text" | "system") || "text",
                status: "delivered" as const
              }
            : {
                id: "placeholder",
                content: "No messages yet",
                senderId: userId,
                senderName: "—",
                timestamp: conv.createdAt.toISOString(),
                type: "system" as const,
                status: "delivered" as const
              };

          const isOnline = Boolean(
            other?.chatUser?.isOnline && other.chatUser.status !== "offline"
          );

          const peerLabel = displayNameOrEmail(other.name, "");
          return {
            id: conv.id,
            type: "direct" as const,
            name: peerLabel,
            description: "Direct message",
            participants: conv.participants,
            otherUser: other
              ? {
                  id: other.id,
                  name: peerLabel,
                  hasDisplayName: Boolean(other.name?.trim()),
                  roles: other.roles.map((ur) => ({
                    key: ur.role.key,
                    name: ur.role.name
                  })),
                  status: (isOnline ? "online" : "offline") as
                    | "online"
                    | "offline"
                    | "busy"
                    | "away",
                  lastSeen: null,
                  isOnline
                }
              : undefined,
            lastMessage,
            unreadCount,
            createdAt: conv.createdAt.toISOString(),
            updatedAt: conv.updatedAt.toISOString()
          };
        })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));

        res.json({
          success: true,
          data: {
            conversations: userConversations,
            totalConversations: userConversations.length
          }
        });
      } catch (error) {
        console.error("Error getting conversations:", error);
        res.status(500).json({
          error: "Failed to get conversations",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Create or open direct conversation (works when peer is offline; messages persist in DB)
  router.post(
    "/conversations/direct",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const { participantId } = req.body as { participantId?: string };
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const roleKeys = req.auth!.roleKeys;
        const isClient = roleKeys.includes(ROLE_KEYS.client);

        if (!participantId || participantId === userId) {
          return res.status(400).json({ error: "Invalid participant" });
        }

        const participant = await prisma.user.findFirst({
          where: {
            id: participantId,
            deletedAt: null,
            OR: [
              { orgId },
              { memberships: { some: { orgId, deletedAt: null } } },
              { roles: { some: { role: { orgId } } } }
            ]
          },
          select: {
            id: true,
            name: true,
            chatUser: { select: { isOnline: true, status: true } },
            roles: { select: { role: { select: { name: true, key: true } } } }
          }
        });

        if (!participant) {
          return res.status(404).json({ error: "Participant not found" });
        }

        const participantRoleKeys = participant.roles.map((r) => r.role.key);
        const participantIsClient = participantRoleKeys.includes(ROLE_KEYS.client);

        if (isClient) {
          const allowed = participantRoleKeys.some((k) =>
            [ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin].includes(k as any)
          );
          if (!allowed) {
            return res.status(403).json({ error: "Clients can only message Sales or Director." });
          }
        }

        if (participantIsClient) {
          const callerAllowed = roleKeys.some((k) =>
            [ROLE_KEYS.sales, ROLE_KEYS.director, ROLE_KEYS.admin].includes(k as any)
          );
          if (!callerAllowed) {
            return res.status(403).json({ error: "Only Sales or Director can message clients." });
          }
        }

        await ensureChatUserAndInbox(prisma, userId, orgId, { touchPresence: true });
        await ensureChatUserAndInbox(prisma, participantId, orgId, { touchPresence: false });

        const conv = await createOrGetDirectConversation(prisma, orgId, userId, participantId);

        const isOnline = Boolean(
          participant.chatUser?.isOnline && participant.chatUser.status !== "offline"
        );

        const peerLabel = displayNameOrEmail(participant.name, "");

        const conversation = {
          id: conv.id,
          type: "direct" as const,
          name: peerLabel,
          description: "Direct message",
          participants: conv.participants,
          otherUser: {
            id: participant.id,
            name: peerLabel,
            hasDisplayName: Boolean(participant.name?.trim()),
            roles: participant.roles.map((ur) => ({
              key: ur.role.key,
              name: ur.role.name
            })),
            status: (isOnline ? "online" : "offline") as
              | "online"
              | "offline"
              | "busy"
              | "away",
            lastSeen: null,
            isOnline
          },
          lastMessage: {
            id: "placeholder",
            content: "No messages yet",
            senderId: userId,
            senderName: "—",
            timestamp: conv.createdAt.toISOString(),
            type: "system" as const,
            status: "delivered" as const
          },
          unreadCount: (conv.unreadCounts as Record<string, number> | null)?.[userId] ?? 0,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString()
        };

        res.json({
          success: true,
          message: "Direct conversation ready",
          data: { conversation }
        });
      } catch (error) {
        console.error("Error creating direct conversation:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const lower = message.toLowerCase();
        const status =
          lower.includes("not a member") ? 403 : lower.includes("not found") ? 404 : 500;
        res.status(status).json({
          error: "Failed to create direct conversation",
          message
        });
      }
    }
  );

  // Get conversation messages (persisted; recipient sees history when they open Community)
  router.get(
    "/conversations/:conversationId/messages",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        if (!conversationId) {
          return res.status(400).json({ error: "Missing conversation id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, orgId, participants: { has: userId } }
        });
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const skip = (page - 1) * limit;
        const whereMessages = {
          conversationId,
          deletedAt: null,
          NOT: { hides: { some: { userId } } }
        };

        const [total, rows] = await Promise.all([
          prisma.message.count({ where: whereMessages }),
          prisma.message.findMany({
            where: whereMessages,
            orderBy: { createdAt: "asc" },
            skip,
            take: limit
          })
        ]);

        const flags = await prisma.messageUserFlag.findMany({
          where: { userId, messageId: { in: rows.map((m) => m.id) } },
          select: { messageId: true, starred: true, saved: true }
        });
        const flagsByMessageId = new Map(flags.map((f) => [f.messageId, f]));

        const senderIds = [...new Set(rows.map((m) => m.senderId))];
        const senders = await prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true }
        });
        const senderById = new Map(senders.map((s) => [s.id, s]));

        const unreadMap = conv.unreadCounts as Record<string, number> | null;
        if ((unreadMap?.[userId] ?? 0) > 0) {
          const next = { ...(unreadMap ?? {}) };
          next[userId] = 0;
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { unreadCounts: next }
          });
        }

        const messages = rows.map((m) => {
          const s = senderById.get(m.senderId);
          const revoked = Boolean(m.revokedAt);
          const f = flagsByMessageId.get(m.id) ?? null;
          return {
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: s ? displayNameOrEmail(s.name, "") : "User",
            content: revoked ? "This message was deleted." : m.content,
            type: revoked ? "deleted" : m.type,
            status: m.status,
            replyTo: m.replyTo ?? null,
            timestamp: m.createdAt.toISOString(),
            readBy: m.readBy,
            metadata: m.metadata,
            flags: f ? { starred: Boolean(f.starred), saved: Boolean(f.saved) } : { starred: false, saved: false },
            editedAt: m.editedAt?.toISOString() ?? null,
            revokedAt: m.revokedAt?.toISOString() ?? null
          };
        });

        res.json({
          success: true,
          data: {
            messages,
            pagination: {
              page,
              limit,
              total,
              pages: Math.max(1, Math.ceil(total / limit))
            }
          }
        });
      } catch (error) {
        console.error("Error getting conversation messages:", error);
        res.status(500).json({
          error: "Failed to get conversation messages",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Flag message (star / save)
  router.post(
    "/conversations/:conversationId/messages/:messageId/flags",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
        if (!conversationId || !messageId) {
          return res.status(400).json({ error: "Missing conversation or message id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const { starred, saved } = req.body as { starred?: boolean; saved?: boolean };

        const msg = await prisma.message.findFirst({
          where: {
            id: messageId,
            conversationId,
            deletedAt: null,
            conversation: { orgId, participants: { has: userId } }
          },
          select: { id: true }
        });
        if (!msg) return res.status(404).json({ error: "Message not found" });

        const updated = await prisma.messageUserFlag.upsert({
          where: { messageId_userId: { messageId, userId } },
          create: {
            messageId,
            userId,
            starred: Boolean(starred),
            saved: Boolean(saved)
          },
          update: {
            ...(typeof starred === "boolean" ? { starred } : {}),
            ...(typeof saved === "boolean" ? { saved } : {})
          },
          select: { messageId: true, starred: true, saved: true, updatedAt: true }
        });

        res.json({ success: true, data: { flags: updated } });
      } catch (error) {
        console.error("Error updating message flags:", error);
        res.status(500).json({
          error: "Failed to update message flags",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Message info (read receipts, timestamps)
  router.get(
    "/conversations/:conversationId/messages/:messageId/info",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
        if (!conversationId || !messageId) {
          return res.status(400).json({ error: "Missing conversation or message id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const msg = await prisma.message.findFirst({
          where: {
            id: messageId,
            conversationId,
            deletedAt: null,
            conversation: { orgId, participants: { has: userId } }
          },
          select: {
            id: true,
            senderId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            editedAt: true,
            revokedAt: true,
            readBy: true
          }
        });
        if (!msg) return res.status(404).json({ error: "Message not found" });

        res.json({
          success: true,
          data: {
            id: msg.id,
            senderId: msg.senderId,
            status: msg.status,
            createdAt: msg.createdAt.toISOString(),
            updatedAt: msg.updatedAt.toISOString(),
            editedAt: msg.editedAt?.toISOString() ?? null,
            revokedAt: msg.revokedAt?.toISOString() ?? null,
            readBy: msg.readBy
          }
        });
      } catch (error) {
        console.error("Error getting message info:", error);
        res.status(500).json({
          error: "Failed to get message info",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Send message (stored for offline recipients)
  router.post(
    "/conversations/:conversationId/messages",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        if (!conversationId) {
          return res.status(400).json({ error: "Missing conversation id" });
        }
        const { content, type = "text", metadata, replyTo } = req.body as {
          content?: string;
          type?: string;
          metadata?: Record<string, unknown>;
          replyTo?: string;
        };
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const trimmed = typeof content === "string" ? content.trim() : "";
        const t = typeof type === "string" && type.trim() ? type.trim() : "text";
        const meta =
          metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : undefined;
        const hasUrl = typeof (meta as { url?: string } | undefined)?.url === "string" && Boolean((meta as { url: string }).url);
        const locOk =
          t === "location" &&
          meta &&
          typeof (meta as { lat?: unknown }).lat === "number" &&
          typeof (meta as { lng?: unknown }).lng === "number";
        const contactOk =
          t === "contact" &&
          meta &&
          (typeof (meta as { phone?: unknown }).phone === "string" ||
            typeof (meta as { name?: unknown }).name === "string");

        if (!trimmed && !hasUrl && !locOk && !contactOk) {
          return res.status(400).json({ error: "Message content or attachment metadata is required" });
        }

        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, orgId, participants: { has: userId } }
        });
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const displayContent =
          trimmed ||
          (locOk ? "📍 Shared location" : "") ||
          (contactOk ? `👤 ${String((meta as { name?: string }).name || "Contact")}` : "") ||
          (hasUrl ? "Attachment" : "");

        const created = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: displayContent,
            type: t,
            metadata: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
            replyTo: typeof replyTo === "string" && replyTo.trim() ? replyTo.trim() : undefined,
            status: "sent",
            readBy: [{ userId, readAt: new Date().toISOString() }]
          }
        });

        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true }
        });

        const unreadNext = mergeUnreadCounts(conv.unreadCounts, conv.participants, userId);

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: {
              id: created.id,
              content: created.content,
              senderId: created.senderId,
              timestamp: created.createdAt.toISOString(),
              type: created.type
            },
            updatedAt: new Date(),
            unreadCounts: unreadNext
          }
        });

        const message = {
          id: created.id,
          conversationId: created.conversationId,
          senderId: created.senderId,
          senderName: sender ? displayNameOrEmail(sender.name, "") : "User",
          content: created.content,
          type: created.type,
          status: created.status,
          replyTo: created.replyTo ?? null,
          timestamp: created.createdAt.toISOString(),
          readBy: created.readBy,
          metadata: created.metadata,
          flags: { starred: false, saved: false },
          editedAt: created.editedAt?.toISOString() ?? null,
          revokedAt: created.revokedAt?.toISOString() ?? null
        };

        res.status(201).json({
          success: true,
          message: "Message sent successfully",
          data: { message }
        });
      } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({
          error: "Failed to send message",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.patch(
    "/conversations/:conversationId/messages/:messageId",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
        if (!conversationId || !messageId) {
          return res.status(400).json({ error: "Missing conversation or message id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const { content } = req.body as { content?: string };
        const trimmed = typeof content === "string" ? content.trim() : "";
        if (!trimmed) {
          return res.status(400).json({ error: "Content is required" });
        }

        const existing = await prisma.message.findFirst({
          where: {
            id: messageId,
            conversationId,
            senderId: userId,
            deletedAt: null,
            revokedAt: null,
            conversation: { orgId, participants: { has: userId } }
          }
        });
        if (!existing) {
          return res.status(404).json({ error: "Message not found or cannot be edited" });
        }

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { content: trimmed, editedAt: new Date() }
        });

        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { lastMessage: true }
        });
        const lm = conv?.lastMessage as { id?: string } | null;
        if (lm?.id === messageId) {
          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessage: {
                id: updated.id,
                content: updated.content,
                senderId: updated.senderId,
                timestamp: updated.updatedAt.toISOString(),
                type: updated.type
              },
              updatedAt: new Date()
            }
          });
        }

        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true }
        });

        res.json({
          success: true,
          data: {
            message: {
              id: updated.id,
              conversationId: updated.conversationId,
              senderId: updated.senderId,
              senderName: sender ? displayNameOrEmail(sender.name, "") : "User",
              content: updated.content,
              type: updated.type,
              status: updated.status,
              timestamp: updated.createdAt.toISOString(),
              readBy: updated.readBy,
              metadata: updated.metadata,
              editedAt: updated.editedAt?.toISOString() ?? null,
              revokedAt: updated.revokedAt?.toISOString() ?? null
            }
          }
        });
      } catch (error) {
        console.error("Error editing message:", error);
        res.status(500).json({
          error: "Failed to edit message",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.delete(
    "/conversations/:conversationId/messages/:messageId",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
        if (!conversationId || !messageId) {
          return res.status(400).json({ error: "Missing conversation or message id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const scope = (req.body as { scope?: string }).scope === "everyone" ? "everyone" : "self";

        const msg = await prisma.message.findFirst({
          where: {
            id: messageId,
            conversationId,
            deletedAt: null,
            conversation: { orgId, participants: { has: userId } }
          }
        });
        if (!msg) {
          return res.status(404).json({ error: "Message not found" });
        }

        if (scope === "everyone") {
          if (msg.senderId !== userId) {
            return res.status(403).json({ error: "Only the sender can delete this message for everyone" });
          }
          if (msg.revokedAt) {
            return res.json({ success: true, message: "Already deleted" });
          }
          await prisma.message.update({
            where: { id: messageId },
            data: { revokedAt: new Date(), content: "", type: "deleted" }
          });
          await refreshConversationLastMessage(prisma, conversationId);
          return res.json({ success: true, message: "Deleted for everyone" });
        }

        await prisma.messageHide.upsert({
          where: { messageId_userId: { messageId, userId } },
          create: { messageId, userId },
          update: {}
        });
        res.json({ success: true, message: "Hidden for you" });
      } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({
          error: "Failed to delete message",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Upload file in conversation
  router.post(
    "/conversations/:conversationId/upload",
    requireRoles(ALL_APP_ROLE_KEYS),
    uploadChatFields,
    async (req, res) => {
      try {
        const conversationId = Array.isArray(req.params.conversationId)
          ? req.params.conversationId[0]
          : req.params.conversationId;
        if (!conversationId) {
          return res.status(400).json({ error: "Missing conversation id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const filesField = req.files as
          | Record<string, Express.Multer.File[]>
          | Express.Multer.File[]
          | undefined;
        const list = Array.isArray(filesField)
          ? filesField
          : [...(filesField?.files ?? []), ...(filesField?.file ?? [])];

        const files = list.filter((f) => f && typeof f.originalname === "string" && f.buffer instanceof Buffer);
        if (files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, orgId, participants: { has: userId } }
        });
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const baseCaption =
          typeof req.body?.caption === "string" && req.body.caption.trim() ? req.body.caption.trim() : "";
        const replyTo =
          typeof req.body?.replyTo === "string" && req.body.replyTo.trim() ? req.body.replyTo.trim() : null;

        const createdMessages = [];
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i]!;
          const urlPath = saveChatUpload(orgId, conversationId, file.originalname, file.buffer);
          const msgType = messageTypeFromMime(file.mimetype);
          const metadata = {
            url: urlPath,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype
          };

          const caption =
            i === 0 && baseCaption
              ? baseCaption
              : msgType === "image"
                ? "📷 Photo"
                : msgType === "voice"
                  ? "🎤 Voice message"
                  : `📎 ${file.originalname}`;

          const created = await prisma.message.create({
            data: {
              conversationId,
              senderId: userId,
              content: caption,
              type: msgType,
              metadata: metadata as Prisma.InputJsonValue,
              status: "sent",
              replyTo,
              readBy: [{ userId, readAt: new Date().toISOString() }]
            }
          });
          createdMessages.push(created);
        }

        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true }
        });

        const unreadNext = mergeUnreadCounts(conv.unreadCounts, conv.participants, userId);
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: {
              id: createdMessages[createdMessages.length - 1]!.id,
              content: createdMessages[createdMessages.length - 1]!.content,
              senderId: createdMessages[createdMessages.length - 1]!.senderId,
              timestamp: createdMessages[createdMessages.length - 1]!.createdAt.toISOString(),
              type: createdMessages[createdMessages.length - 1]!.type
            },
            updatedAt: new Date(),
            unreadCounts: unreadNext
          }
        });

        const senderName = sender ? displayNameOrEmail(sender.name, "") : "User";
        const messages = createdMessages.map((created) => ({
          id: created.id,
          conversationId: created.conversationId,
          senderId: created.senderId,
          senderName,
          content: created.content,
          type: created.type,
          status: created.status,
          replyTo: created.replyTo ?? null,
          timestamp: created.createdAt.toISOString(),
          readBy: created.readBy,
          metadata: created.metadata,
          flags: { starred: false, saved: false },
          editedAt: created.editedAt?.toISOString() ?? null,
          revokedAt: created.revokedAt?.toISOString() ?? null
        }));

        res.status(201).json({
          success: true,
          message: "Files uploaded successfully",
          data: { messages }
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({
          error: "Failed to upload file",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Get user inbox
  router.get(
    "/inbox",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        // Get user's projects as inbox items
        const inboxItems = await prisma.project.findMany({
          where: { 
            orgId,
            OR: [
              { createdBy: { id: userId } },
              { assignedDeveloperId: userId },
              { approvedById: userId }
            ]
          },
          include: {
            client: { select: { name: true } },
            createdBy: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        });

        const inbox = inboxItems.map(item => ({
          id: item.id,
          type: 'project' as const,
          title: item.name,
          content: `Project for ${item.client?.name || 'Unknown Client'}`,
          sender: item.createdBy?.name || 'Unknown',
          timestamp: item.createdAt,
          read: false,
          priority: 'normal' as const
        }));

        res.json({
          success: true,
          data: {
            inbox,
            unreadCount: inbox.length,
            totalCount: inbox.length
          }
        });

      } catch (error) {
        console.error("Error getting inbox:", error);
        res.status(500).json({ 
          error: "Failed to get inbox", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Mark message as read
  router.post(
    "/messages/:messageId/read",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const messageId = Array.isArray(req.params.messageId)
          ? req.params.messageId[0]
          : req.params.messageId;
        if (!messageId) {
          return res.status(400).json({ error: "Missing message id" });
        }
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const msg = await prisma.message.findFirst({
          where: {
            id: messageId,
            deletedAt: null,
            conversation: {
              orgId,
              participants: { has: userId }
            }
          },
          select: {
            id: true,
            conversationId: true,
            readBy: true
          }
        });

        if (!msg) {
          return res.status(404).json({ error: "Message not found" });
        }

        const currentReadBy = Array.isArray(msg.readBy)
          ? (msg.readBy as Array<{ userId?: string; readAt?: string }> )
          : [];

        const alreadyRead = currentReadBy.some((r) => r?.userId === userId);
        if (!alreadyRead) {
          await prisma.message.update({
            where: { id: messageId },
            data: {
              readBy: [...currentReadBy, { userId, readAt: new Date().toISOString() }],
              status: "read"
            }
          });
        }

        const conv = await prisma.conversation.findFirst({
          where: { id: msg.conversationId, orgId, participants: { has: userId } },
          select: { id: true, unreadCounts: true }
        });

        if (conv) {
          const unreadMap = conv.unreadCounts as Record<string, number> | null;
          if ((unreadMap?.[userId] ?? 0) > 0) {
            const next = { ...(unreadMap ?? {}) };
            next[userId] = 0;
            await prisma.conversation.update({
              where: { id: conv.id },
              data: { unreadCounts: next }
            });
          }
        }

        res.json({
          success: true,
          message: "Message marked as read"
        });

      } catch (error) {
        console.error("Error marking message as read:", error);
        res.status(500).json({ 
          error: "Failed to mark message as read", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Search conversations and messages
  router.get(
    "/search",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const { q: query } = req.query;
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        if (!query) {
          return res.status(400).json({ error: "Search query is required" });
        }

        // Search projects
        const projects = await prisma.project.findMany({
          where: {
            orgId,
            OR: [
              { name: { contains: query as string, mode: 'insensitive' } }
            ]
          },
          include: {
            client: { select: { name: true } },
            createdBy: { select: { name: true } }
          },
          take: 20
        });

        const results = projects.map(project => ({
          id: project.id,
          type: 'conversation' as const,
          title: project.name,
          content: `Project for ${project.client?.name || 'Unknown Client'}`,
          timestamp: project.createdAt,
          url: `/chat/conversations/${project.id}`
        }));

        res.json({
          success: true,
          data: {
            results,
            total: results.length
          }
        });

      } catch (error) {
        console.error("Error searching:", error);
        res.status(500).json({ 
          error: "Failed to search", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get user notifications
  router.get(
    "/notifications",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const { limit = 20 } = req.query;

        // Sample notifications
        const notifications = [
          {
            id: 'notif-1',
            type: 'message' as const,
            title: 'New message',
            content: 'You have a new message from John Doe',
            read: false,
            timestamp: new Date(Date.now() - 300000),
            url: '/chat/conversations/conv-1'
          },
          {
            id: 'notif-2',
            type: 'mention' as const,
            title: 'You were mentioned',
            content: 'Sarah mentioned you in a conversation',
            read: false,
            timestamp: new Date(Date.now() - 600000),
            url: '/chat/conversations/conv-2'
          }
        ];

        res.json({
          success: true,
          data: {
            notifications: notifications.slice(0, Number(limit)),
            unreadCount: notifications.filter(n => !n.read).length
          }
        });

      } catch (error) {
        console.error("Error getting notifications:", error);
        res.status(500).json({ 
          error: "Failed to get notifications", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Update presence (used when opening Community or periodically)
  router.put(
    "/status",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const { status } = req.body as { status?: string };
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        if (!status || !["online", "offline", "away", "busy"].includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }

        await ensureChatUserAndInbox(prisma, userId, orgId, { touchPresence: false });

        const isOnline = status === "online";
        const updated = await prisma.chatUser.update({
          where: { userId },
          data: {
            status,
            isOnline,
            lastSeen: new Date()
          },
          select: {
            userId: true,
            status: true,
            isOnline: true,
            lastSeen: true
          }
        });

        res.json({
          success: true,
          message: "Status updated successfully",
          data: {
            userId: updated.userId,
            status: updated.status,
            isOnline: updated.isOnline,
            lastSeen: updated.lastSeen
          }
        });
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({
          error: "Failed to update status",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  /** Optional grammar polish / translation for Community composer (Groq). */
  router.post(
    "/compose-assist",
    requireRoles(ALL_APP_ROLE_KEYS),
    async (req, res) => {
      try {
        const body = req.body as { text?: string; action?: string; targetLanguage?: string };
        const text = typeof body.text === "string" ? body.text : "";
        const action = body.action === "translate" ? "translate" : "proofread";
        if (!text.trim()) {
          return res.status(400).json({ success: false, error: "text is required" });
        }
        if (text.length > 4000) {
          return res.status(400).json({ success: false, error: "text is too long (max 4000 characters)" });
        }
        if (action === "translate") {
          const targetLanguage = typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";
          if (!targetLanguage) {
            return res.status(400).json({ success: false, error: "targetLanguage is required for translate" });
          }
        }
        const out = await composeAssistText({
          action,
          text,
          targetLanguage: body.targetLanguage
        });
        if (!out) {
          return res.status(503).json({
            success: false,
            error: "AI assist is not configured or temporarily unavailable"
          });
        }
        res.json({ success: true, data: { text: out } });
      } catch (error) {
        console.error("Error in compose-assist:", error);
        res.status(500).json({
          success: false,
          error: "Failed to run compose assist",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  return router;
}
