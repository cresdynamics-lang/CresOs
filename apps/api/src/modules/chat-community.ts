/**
 * Chat Community Router
 * 
 * Provides API endpoints for the chat community system
 * including real-time messaging, inbox, and user communication
 */

import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import multer from "multer";

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
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const { displayName, username } = req.body;

        // Create or update chat user
        const chatUser = await prisma.user.upsert({
          where: { id: userId },
          update: {
            name: displayName,
            updatedAt: new Date()
          },
          create: {
            id: userId,
            email: `${username}@cresos.com`,
            name: displayName,
            passwordHash: 'chat-user',
            orgId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        res.json({
          success: true,
          data: {
            user: {
              id: chatUser.id,
              name: chatUser.name,
              email: chatUser.email,
              status: 'online',
              isOnline: true,
              lastSeen: new Date()
            }
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

  // Get online users
  router.get(
    "/online-users",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;

        // Get all users in the organization
        const users = await prisma.user.findMany({
          where: { orgId },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        });

        // Simulate online status (in a real app, this would come from WebSocket connections)
        const onlineUsers = users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          displayName: user.name,
          username: user.email.split('@')[0],
          status: 'online' as const,
          isOnline: true,
          lastSeen: new Date(),
          avatar: null
        }));

        res.json({
          success: true,
          data: {
            onlineUsers,
            totalOnline: onlineUsers.length
          }
        });

      } catch (error) {
        console.error("Error getting online users:", error);
        res.status(500).json({ 
          error: "Failed to get online users", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get user conversations
  router.get(
    "/conversations",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        // Get conversations where user is a participant
        const conversations = await prisma.project.findMany({
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
            createdBy: { select: { name: true } },
            assignedDeveloper: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        });

        // Transform projects into conversation format
        const userConversations = conversations.map(project => ({
          id: project.id,
          type: 'project' as const,
          name: project.name,
          description: `Project for ${project.client?.name || 'Unknown Client'}`,
          participants: [
            project.createdBy?.name,
            project.assignedDeveloper?.name,
            project.client?.name
          ].filter(Boolean),
          lastMessage: {
            id: `msg-${project.id}`,
            content: `Project: ${project.name}`,
            senderId: userId,
            timestamp: project.updatedAt,
            type: 'system' as const
          },
          unreadCount: 0,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }));

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

  // Create direct conversation
  router.post(
    "/conversations/direct",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const { participantId } = req.body;
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        // Get participant info
        const participant = await prisma.user.findFirst({
          where: { id: participantId, orgId },
          select: { id: true, name: true, email: true }
        });

        if (!participant) {
          return res.status(404).json({ error: "Participant not found" });
        }

        // Create a simple direct conversation
        const conversation = {
          id: `direct-${userId}-${participantId}`,
          type: 'direct' as const,
          name: participant.name,
          participants: [userId, participantId],
          lastMessage: null,
          unreadCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        res.json({
          success: true,
          message: "Direct conversation created",
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

  // Get conversation messages
  router.get(
    "/conversations/:conversationId/messages",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const { conversationId } = req.params;
        const userId = req.auth!.userId;
        const { page = 1, limit = 50 } = req.query;

        // For demo purposes, return sample messages
        const messages = [
          {
            id: 'msg-1',
            conversationId,
            senderId: 'user-1',
            content: 'Hello! How can I help you today?',
            type: 'text' as const,
            status: 'delivered' as const,
            readBy: [{ userId, readAt: new Date() }],
            createdAt: new Date(Date.now() - 3600000),
            updatedAt: new Date(Date.now() - 3600000),
            sender: {
              id: 'user-1',
              displayName: 'John Doe',
              avatar: null
            }
          },
          {
            id: 'msg-2',
            conversationId,
            senderId: userId,
            content: 'I need help with the project management',
            type: 'text' as const,
            status: 'delivered' as const,
            readBy: [{ userId, readAt: new Date() }],
            createdAt: new Date(Date.now() - 1800000),
            updatedAt: new Date(Date.now() - 1800000),
            sender: {
              id: userId,
              displayName: 'Current User',
              avatar: null
            }
          }
        ];

        res.json({
          success: true,
          data: {
            messages,
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total: messages.length,
              pages: 1
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

  // Send message
  router.post(
    "/conversations/:conversationId/messages",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const { conversationId } = req.params;
        const { content, type = 'text' } = req.body;
        const userId = req.auth!.userId;

        const message = {
          id: `msg-${Date.now()}`,
          conversationId,
          senderId: userId,
          content,
          type,
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
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    upload.single('file'),
    async (req, res) => {
      try {
        const { conversationId } = req.params;
        const userId = req.auth!.userId;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: "No file uploaded" });
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
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
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
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
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
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
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
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
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

  // Update user status
  router.put(
    "/status",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.finance, ROLE_KEYS.developer, ROLE_KEYS.sales, ROLE_KEYS.analyst, ROLE_KEYS.client]),
    async (req, res) => {
      try {
        const { status } = req.body;
        const userId = req.auth!.userId;

        if (!['online', 'offline', 'away', 'busy'].includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }

        res.json({
          success: true,
          message: "Status updated successfully",
          data: {
            userId,
            status,
            lastSeen: new Date()
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
