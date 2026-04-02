/**
 * Chat Community System - Database Schema
 * 
 * Defines the database structure for the chat community system
 * including users, conversations, messages, and inbox functionality
 */

export interface ChatUser {
  id: string;
  userId: string;
  orgId: string;
  username: string;
  displayName: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: Date;
  isOnline: boolean;
  typingStatus?: 'typing' | 'idle';
  preferences: {
    notifications: boolean;
    soundEnabled: boolean;
    doNotDisturb: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  orgId: string;
  type: 'direct' | 'group' | 'community' | 'channel';
  name?: string;
  description?: string;
  avatar?: string;
  createdBy: string;
  participants: string[];
  admins: string[];
  settings: {
    isPublic: boolean;
    allowInvites: boolean;
    readOnly: boolean;
    archived: boolean;
  };
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    timestamp: Date;
    type: 'text' | 'file' | 'image' | 'system';
  };
  unreadCounts: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'system' | 'voice' | 'video';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    thumbnail?: string;
  };
  replyTo?: string;
  reactions: Array<{
    emoji: string;
    users: string[];
    count: number;
  }>;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Inbox {
  id: string;
  userId: string;
  orgId: string;
  conversations: string[];
  unreadCount: number;
  lastActivity: Date;
  settings: {
    archiveRead: boolean;
    hideOffline: boolean;
    sortBy: 'recent' | 'unread' | 'name';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatNotification {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'reaction' | 'invite';
  conversationId: string;
  messageId?: string;
  senderId: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface OnlineUser {
  id: string;
  userId: string;
  socketId: string;
  status: 'online' | 'away' | 'busy';
  lastSeen: Date;
  currentConversation?: string;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface ChatCommunityChannel {
  id: string;
  orgId: string;
  name: string;
  description: string;
  type: 'general' | 'random' | 'announcements' | 'support' | 'projects' | 'custom';
  isPublic: boolean;
  members: string[];
  moderators: string[];
  settings: {
    allowFileSharing: boolean;
    allowReactions: boolean;
    messageRetention: number; // days
  };
  createdAt: Date;
  updatedAt: Date;
}
