export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  type: "text" | "system" | string;
  status: "sent" | "delivered" | "read" | string;
  metadata?: Record<string, unknown> | null;
  flags?: { starred?: boolean; saved?: boolean } | null;
  replyTo?: string | null;
  editedAt?: string | null;
  revokedAt?: string | null;
}

export interface OrgRoleRef {
  key: string;
  name: string;
}

export interface Conversation {
  id: string;
  type: "channel" | "project" | "direct" | "group";
  name: string;
  description: string;
  participants: string[];
  otherUser?: OnlineUser;
  projectId?: string | null;
  projectStatus?: string | null;
  projectApprovalStatus?: string | null;
  channelTopics?: string | null;
  linkedProjectName?: string | null;
  participantCount?: number;
  lastMessage: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelDraft {
  id: string;
  name: string;
  status: string;
  approvalStatus: string;
  updatedAt: string;
  teamMemberCount: number;
  suggestedMemberIds?: string[];
}

export interface OnlineUser {
  id: string;
  name: string;
  hasDisplayName?: boolean;
  roles?: OrgRoleRef[];
  status: "online" | "busy" | "away" | "offline";
  lastSeen: string | null;
  isOnline: boolean;
  avatar?: string | null;
  onlineHours?: string | null;
}

export type SidebarSection = "chats" | "channels" | "people";
