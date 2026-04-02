/**
 * Chat Community Service
 * 
 * Core service for managing chat community functionality
 * including real-time messaging, inbox, and user communication
 */

import type { PrismaClient } from '@prisma/client';
import type { 
  ChatUser, 
  Conversation, 
  Message, 
  Inbox, 
  ChatNotification,
  OnlineUser,
  TypingIndicator,
  ChatCommunityChannel 
} from './types';

export class ChatCommunityService {
  constructor(private prisma: PrismaClient) {}

  // User Management
  async createChatUser(userId: string, orgId: string, displayName: string, username: string) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.chatUser.findFirst({
        where: { userId, orgId }
      });

      if (existingUser) {
        return existingUser;
      }

      // Create new chat user
      const chatUser = await this.prisma.chatUser.create({
        data: {
          userId,
          orgId,
          username,
          displayName,
          status: 'online',
          isOnline: true,
          lastSeen: new Date(),
          preferences: {
            notifications: true,
            soundEnabled: true,
            doNotDisturb: false
          }
        }
      });

      // Create inbox for user
      await this.prisma.inbox.create({
        data: {
          userId,
          orgId,
          conversations: [],
          unreadCount: 0,
          lastActivity: new Date(),
          settings: {
            archiveRead: false,
            hideOffline: false,
            sortBy: 'recent'
          }
        }
      });

      return chatUser;
    } catch (error) {
      console.error('Error creating chat user:', error);
      throw new Error('Failed to create chat user');
    }
  }

  async updateUserStatus(userId: string, status: 'online' | 'offline' | 'away' | 'busy') {
    try {
      const updatedUser = await this.prisma.chatUser.update({
        where: { userId },
        data: {
          status,
          isOnline: status === 'online',
          lastSeen: new Date()
        }
      });

      return updatedUser;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw new Error('Failed to update user status');
    }
  }

  async getOnlineUsers(orgId: string): Promise<ChatUser[]> {
    try {
      const onlineUsers = await this.prisma.chatUser.findMany({
        where: {
          orgId,
          isOnline: true,
          status: { not: 'offline' }
        },
        select: {
          id: true,
          userId: true,
          username: true,
          displayName: true,
          avatar: true,
          status: true,
          isOnline: true,
          lastSeen: true
        },
        orderBy: { lastSeen: 'desc' }
      });

      return onlineUsers;
    } catch (error) {
      console.error('Error getting online users:', error);
      throw new Error('Failed to get online users');
    }
  }

  // Conversation Management
  async createDirectConversation(orgId: string, creatorId: string, participantId: string) {
    try {
      // Check if direct conversation already exists
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          orgId,
          type: 'direct',
          participants: {
            hasEvery: [creatorId, participantId]
          }
        }
      });

      if (existingConversation) {
        return existingConversation;
      }

      // Create new direct conversation
      const conversation = await this.prisma.conversation.create({
        data: {
          orgId,
          type: 'direct',
          createdBy: creatorId,
          participants: [creatorId, participantId],
          admins: [creatorId],
          settings: {
            isPublic: false,
            allowInvites: false,
            readOnly: false,
            archived: false
          },
          unreadCounts: {
            [creatorId]: 0,
            [participantId]: 0
          }
        }
      });

      // Add conversation to both users' inboxes
      await this.prisma.inbox.updateMany({
        where: {
          userId: { in: [creatorId, participantId] },
          orgId
        },
        data: {
          conversations: {
            push: conversation.id
          }
        }
      });

      return conversation;
    } catch (error) {
      console.error('Error creating direct conversation:', error);
      throw new Error('Failed to create direct conversation');
    }
  }

  async createGroupConversation(
    orgId: string, 
    creatorId: string, 
    name: string, 
    description: string,
    participants: string[]
  ) {
    try {
      const conversation = await this.prisma.conversation.create({
        data: {
          orgId,
          type: 'group',
          name,
          description,
          createdBy: creatorId,
          participants: [creatorId, ...participants],
          admins: [creatorId],
          settings: {
            isPublic: true,
            allowInvites: true,
            readOnly: false,
            archived: false
          },
          unreadCounts: participants.reduce((acc, participantId) => {
            acc[participantId] = 0;
            return acc;
          }, { [creatorId]: 0 } as Record<string, number>)
        }
      });

      // Add conversation to all participants' inboxes
      await this.prisma.inbox.updateMany({
        where: {
          userId: { in: [creatorId, ...participants] },
          orgId
        },
        data: {
          conversations: {
            push: conversation.id
          }
        }
      });

      return conversation;
    } catch (error) {
      console.error('Error creating group conversation:', error);
      throw new Error('Failed to create group conversation');
    }
  }

  async getUserConversations(userId: string, orgId: string): Promise<Conversation[]> {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          orgId,
          participants: { has: userId },
          settings: {
            archived: false
          }
        },
        include: {
          participants: {
            select: {
              userId: true,
              displayName: true,
              avatar: true,
              status: true,
              isOnline: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return conversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw new Error('Failed to get user conversations');
    }
  }

  // Message Management
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'file' | 'image' | 'system' = 'text',
    metadata?: any
  ) {
    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          content,
          type,
          metadata: metadata || {},
          status: 'sent',
          readBy: [{
            userId: senderId,
            readAt: new Date()
          }]
        }
      });

      // Update conversation's last message
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            timestamp: message.createdAt,
            type: message.type
          },
          updatedAt: new Date()
        }
      });

      // Update unread counts for all participants except sender
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { participants: true }
      });

      if (conversation) {
        const unreadUpdates = conversation.participants
          .filter(participantId => participantId !== senderId)
          .map(participantId => 
            this.prisma.conversation.update({
              where: { id: conversationId },
              data: {
                unreadCounts: {
                  increment: 1
                }
              }
            })
          );

        await Promise.all(unreadUpdates);
      }

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ) {
    try {
      const skip = (page - 1) * limit;
      
      const messages = await this.prisma.message.findMany({
        where: {
          conversationId,
          deletedAt: null
        },
        include: {
          sender: {
            select: {
              userId: true,
              displayName: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });

      // Mark messages as read for this user
      const messageIds = messages.map(m => m.id);
      await this.prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          NOT: {
            readBy: {
              some: { userId }
            }
          }
        },
        data: {
          readBy: {
            push: {
              userId,
              readAt: new Date()
            }
          }
        }
      });

      return messages;
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      throw new Error('Failed to get conversation messages');
    }
  }

  // Inbox Management
  async getUserInbox(userId: string, orgId: string): Promise<Inbox> {
    try {
      const inbox = await this.prisma.inbox.findUnique({
        where: { userId, orgId },
        include: {
          conversations: {
            include: {
              participants: {
                select: {
                  userId: true,
                  displayName: true,
                  avatar: true,
                  status: true,
                  isOnline: true
                }
              }
            }
          }
        }
      });

      if (!inbox) {
        throw new Error('Inbox not found');
      }

      return inbox;
    } catch (error) {
      console.error('Error getting user inbox:', error);
      throw new Error('Failed to get user inbox');
    }
  }

  async markMessageAsRead(messageId: string, userId: string) {
    try {
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          readBy: {
            push: {
              userId,
              readAt: new Date()
            }
          }
        }
      });

      // Update unread count in conversation
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true }
      });

      if (message) {
        await this.prisma.conversation.update({
          where: { id: message.conversationId },
          data: {
            unreadCounts: {
              decrement: 1
            }
          }
        });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw new Error('Failed to mark message as read');
    }
  }

  // Community Channels
  async createCommunityChannel(
    orgId: string,
    name: string,
    description: string,
    type: 'general' | 'random' | 'announcements' | 'support' | 'projects' | 'custom',
    creatorId: string
  ) {
    try {
      const channel = await this.prisma.chatCommunityChannel.create({
        data: {
          orgId,
          name,
          description,
          type,
          isPublic: true,
          members: [creatorId],
          moderators: [creatorId],
          settings: {
            allowFileSharing: true,
            allowReactions: true,
            messageRetention: 90
          }
        }
      });

      // Create conversation for the channel
      await this.prisma.conversation.create({
        data: {
          orgId,
          type: 'community',
          name: channel.name,
          description: channel.description,
          createdBy: creatorId,
          participants: [creatorId],
          admins: [creatorId],
          settings: {
            isPublic: true,
            allowInvites: true,
            readOnly: false,
            archived: false
          },
          unreadCounts: {
            [creatorId]: 0
          }
        }
      });

      return channel;
    } catch (error) {
      console.error('Error creating community channel:', error);
      throw new Error('Failed to create community channel');
    }
  }

  async getCommunityChannels(orgId: string): Promise<ChatCommunityChannel[]> {
    try {
      const channels = await this.prisma.chatCommunityChannel.findMany({
        where: { orgId },
        include: {
          members: {
            select: {
              userId: true,
              displayName: true,
              avatar: true,
              status: true,
              isOnline: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      return channels;
    } catch (error) {
      console.error('Error getting community channels:', error);
      throw new Error('Failed to get community channels');
    }
  }

  // Notifications
  async createNotification(
    userId: string,
    type: 'message' | 'mention' | 'reaction' | 'invite',
    conversationId: string,
    senderId: string,
    title: string,
    content: string
  ) {
    try {
      const notification = await this.prisma.chatNotification.create({
        data: {
          userId,
          type,
          conversationId,
          senderId,
          title,
          content,
          read: false
        }
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  async getUserNotifications(userId: string, limit: number = 20) {
    try {
      const notifications = await this.prisma.chatNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return notifications;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw new Error('Failed to get user notifications');
    }
  }

  // Search
  async searchConversations(userId: string, orgId: string, query: string) {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          orgId,
          participants: { has: userId },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          participants: {
            select: {
              userId: true,
              displayName: true,
              avatar: true,
              status: true,
              isOnline: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return conversations;
    } catch (error) {
      console.error('Error searching conversations:', error);
      throw new Error('Failed to search conversations');
    }
  }

  async searchMessages(userId: string, orgId: string, query: string) {
    try {
      const messages = await this.prisma.message.findMany({
        where: {
          conversation: {
            participants: { has: userId }
          },
          content: { contains: query, mode: 'insensitive' },
          deletedAt: null
        },
        include: {
          sender: {
            select: {
              userId: true,
              displayName: true,
              avatar: true
            }
          },
          conversation: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return messages;
    } catch (error) {
      console.error('Error searching messages:', error);
      throw new Error('Failed to search messages');
    }
  }
}
