/**
 * Chat Community Router
 * 
 * Provides API endpoints for the chat community system
 * including real-time messaging, inbox, and user communication
 */

import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ALL_APP_ROLE_KEYS } from "./auth-middleware";
import multer from "multer";
import {
  ensureChatUserAndInbox,
  createOrGetDirectConversation,
  mergeUnreadCounts,
  displayNameOrEmail,
  getUserIdsInOrg
} from "./chat-community-helpers";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export default function chatCommunityRouter(prisma: PrismaClient): Router {
  const router = createRouter();

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
        res.status(500).json({
          error: "Failed to initialize chat user",
          message: error instanceof Error ? error.message : "Unknown error"
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

        const orgUserIds = await getUserIdsInOrg(prisma, orgId);
        const users = await prisma.user.findMany({
          where: { id: { in: orgUserIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
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
            const label = displayNameOrEmail(u.name, u.email);
            const roleList = u.roles.map((ur) => ({
              key: ur.role.key,
              name: ur.role.name
            }));
            return {
              id: u.id,
              name: label,
              email: u.email,
              hasDisplayName: Boolean(u.name?.trim()),
              displayName: cu?.displayName || label,
              roles: roleList,
              status: isOnline ? status : "offline",
              isOnline,
              lastSeen: (cu?.lastSeen ?? u.createdAt).toISOString(),
              avatar: null as string | null
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
          where: { id: { in: otherIds } },
          select: {
            id: true,
            name: true,
            email: true,
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
                    : other
                      ? displayNameOrEmail(other.name, other.email)
                      : "User",
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

          const peerLabel = other ? displayNameOrEmail(other.name, other.email) : "Direct chat";
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
                  email: other.email,
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
        });

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

        if (!participantId || participantId === userId) {
          return res.status(400).json({ error: "Invalid participant" });
        }

        const participant = await prisma.user.findFirst({
          where: {
            id: participantId,
            deletedAt: null,
            OR: [{ orgId }, { memberships: { some: { orgId, deletedAt: null } } }]
          },
          select: {
            id: true,
            name: true,
            email: true,
            chatUser: { select: { isOnline: true, status: true } },
            roles: { select: { role: { select: { name: true, key: true } } } }
          }
        });

        if (!participant) {
          return res.status(404).json({ error: "Participant not found" });
        }

        await ensureChatUserAndInbox(prisma, userId, orgId, { touchPresence: true });
        await ensureChatUserAndInbox(prisma, participantId, orgId, { touchPresence: false });

        const conv = await createOrGetDirectConversation(prisma, orgId, userId, participantId);

        const isOnline = Boolean(
          participant.chatUser?.isOnline && participant.chatUser.status !== "offline"
        );

        const peerLabel = displayNameOrEmail(participant.name, participant.email);

        const conversation = {
          id: conv.id,
          type: "direct" as const,
          name: peerLabel,
          description: "Direct message",
          participants: conv.participants,
          otherUser: {
            id: participant.id,
            name: peerLabel,
            email: participant.email,
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
        res.status(500).json({
          error: "Failed to create direct conversation",
          message: error instanceof Error ? error.message : "Unknown error"
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
        const [total, rows] = await Promise.all([
          prisma.message.count({
            where: { conversationId, deletedAt: null }
          }),
          prisma.message.findMany({
            where: { conversationId, deletedAt: null },
            orderBy: { createdAt: "asc" },
            skip,
            take: limit
          })
        ]);

        const senderIds = [...new Set(rows.map((m) => m.senderId))];
        const senders = await prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true, email: true }
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
          return {
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: s ? displayNameOrEmail(s.name, s.email) : "User",
            content: m.content,
            type: m.type,
            status: m.status,
            timestamp: m.createdAt.toISOString(),
            readBy: m.readBy
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
        const { content, type = "text" } = req.body as { content?: string; type?: string };
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        if (!content || typeof content !== "string" || !content.trim()) {
          return res.status(400).json({ error: "Message content is required" });
        }

        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, orgId, participants: { has: userId } }
        });
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const created = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: content.trim(),
            type: type || "text",
            status: "sent",
            readBy: [{ userId, readAt: new Date().toISOString() }]
          }
        });

        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true }
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
          senderName: sender ? displayNameOrEmail(sender.name, sender.email) : "User",
          content: created.content,
          type: created.type,
          status: created.status,
          timestamp: created.createdAt.toISOString(),
          readBy: created.readBy
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

  // Upload file in conversation
  router.post(
    "/conversations/:conversationId/upload",
    requireRoles(ALL_APP_ROLE_KEYS),
    upload.single('file'),
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
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const conv = await prisma.conversation.findFirst({
          where: { id: conversationId, orgId, participants: { has: userId } }
        });
        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const message = {
          id: `msg-${Date.now()}`,
          conversationId,
          senderId: userId,
          content: `Shared a file: ${file.originalname}`,
          type: 'file' as const,
          metadata: {
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype
          },
          status: 'sent' as const,
          readBy: [{ userId, readAt: new Date() }],
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: userId,
            displayName: 'Current User',
            avatar: null
          }
        };

        res.status(201).json({
          success: true,
          message: "File uploaded successfully",
          data: { message }
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
        const { messageId } = req.params;
        const userId = req.auth!.userId;

        // In a real implementation, this would update the database
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

  return router;
}
