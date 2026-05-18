import type { Prisma, PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";
import { getAcceptedDeveloperIds } from "./project-access";
import { ensureChatUserAndInbox } from "../modules/chat-community-helpers";

/** Conversation types used for project-linked channels (legacy + current). */
export const CHANNEL_CONVERSATION_TYPES = ["channel", "project"] as const;

/** Roles that can list projects and create channels (matches /projects list). */
export const PROJECT_CHANNEL_ROLE_KEYS = [
  ROLE_KEYS.developer,
  ROLE_KEYS.director,
  ROLE_KEYS.admin,
  ROLE_KEYS.analyst,
  ROLE_KEYS.sales,
  ROLE_KEYS.finance
] as const;

/** Admin and director can delete project channels. */
export const PROJECT_CHANNEL_DELETE_ROLE_KEYS = [ROLE_KEYS.admin, ROLE_KEYS.director] as const;

export function canDeleteProjectChannel(roleKeys: string[]): boolean {
  return roleKeys.some((k) =>
    (PROJECT_CHANNEL_DELETE_ROLE_KEYS as readonly string[]).includes(k)
  );
}

export function buildProjectListWhere(
  orgId: string,
  userId: string,
  roleKeys: string[]
): Prisma.ProjectWhereInput {
  const isDirector = roleKeys.includes(ROLE_KEYS.director);
  const isDeveloper = roleKeys.includes(ROLE_KEYS.developer);
  const isFinance = roleKeys.includes(ROLE_KEYS.finance);
  const isSales = roleKeys.includes(ROLE_KEYS.sales);
  const isAdmin = roleKeys.includes(ROLE_KEYS.admin);

  const base: Prisma.ProjectWhereInput = { orgId, deletedAt: null };

  if (isDirector || isAdmin) return base;
  if (isSales) return { ...base, createdByUserId: userId };
  if (isFinance) return { ...base, approvalStatus: "approved" };
  if (isDeveloper) {
    return {
      ...base,
      OR: [
        { assignedDeveloperId: userId },
        {
          developerAssignments: {
            some: { userId, status: { in: ["pending", "accepted"] } }
          }
        }
      ]
    };
  }
  return {
    ...base,
    approvalStatus: "approved",
    OR: [
      { assignedDeveloperId: userId },
      {
        developerAssignments: {
          some: { userId, status: { in: ["pending", "accepted"] } }
        }
      }
    ]
  };
}

export async function userCanAccessProject(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  roleKeys: string[],
  projectId: string
): Promise<boolean> {
  const where = buildProjectListWhere(orgId, userId, roleKeys);
  const project = await prisma.project.findFirst({
    where: { ...where, id: projectId }
  });
  return Boolean(project);
}

export async function collectProjectChannelMemberIds(
  prisma: PrismaClient,
  project: {
    id: string;
    orgId: string;
    createdByUserId: string | null;
    ownerUserId: string | null;
    assignedDeveloperId: string | null;
    approvedById: string | null;
  }
): Promise<string[]> {
  const ids = new Set<string>();
  if (project.createdByUserId) ids.add(project.createdByUserId);
  if (project.ownerUserId) ids.add(project.ownerUserId);
  if (project.assignedDeveloperId) ids.add(project.assignedDeveloperId);
  if (project.approvedById) ids.add(project.approvedById);

  const acceptedDevs = await getAcceptedDeveloperIds(prisma, project.id);
  for (const id of acceptedDevs) ids.add(id);

  const pending = await prisma.projectDeveloperAssignment.findMany({
    where: { projectId: project.id, status: "pending" },
    select: { userId: true }
  });
  for (const row of pending) ids.add(row.userId);

  return [...ids];
}

/** Preview how many users will be added when creating a channel from a project. */
export async function countProjectChannelMembers(
  prisma: PrismaClient,
  projectId: string
): Promise<number> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      orgId: true,
      createdByUserId: true,
      ownerUserId: true,
      assignedDeveloperId: true,
      approvedById: true
    }
  });
  if (!project) return 0;
  return (await collectProjectChannelMemberIds(prisma, project)).length;
}

async function addConversationToInboxes(
  prisma: PrismaClient,
  orgId: string,
  conversationId: string,
  userIds: string[]
): Promise<void> {
  for (const uid of userIds) {
    await ensureChatUserAndInbox(prisma, uid, orgId, { touchPresence: false });
    const inbox = await prisma.inbox.findUnique({ where: { userId: uid } });
    if (inbox && !inbox.conversations.includes(conversationId)) {
      await prisma.inbox.update({
        where: { userId: uid },
        data: {
          conversations: [...inbox.conversations, conversationId],
          lastActivity: new Date()
        }
      });
    }
  }
}

export type CreateProjectChannelInput = {
  channelName?: string;
  /** What will be discussed in this channel (milestones, blockers, etc.). */
  topics?: string;
};

function resolveChannelLabels(
  project: { name: string; status: string },
  input?: CreateProjectChannelInput
) {
  const channelName = input?.channelName?.trim() || project.name;
  const topics = input?.topics?.trim() || "";
  const description = topics
    ? topics
    : `Channel for project ${project.name} · ${project.status.replace(/_/g, " ")}`;
  return { channelName, topics, description };
}

export async function createOrGetProjectChannel(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  projectId: string,
  input?: CreateProjectChannelInput
) {
  const existingConv = await prisma.conversation.findFirst({
    where: { orgId, projectId, type: { in: [...CHANNEL_CONVERSATION_TYPES] } },
    include: { project: { select: { id: true, name: true, status: true, approvalStatus: true } } }
  });

  if (existingConv) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, deletedAt: null }
    });
    if (!project) throw new Error("Project not found");
    const labels = resolveChannelLabels(project, input);
    const prevParticipants = [...existingConv.participants];
    const members = await collectProjectChannelMemberIds(prisma, project);
    const nextParticipants = [...new Set([...existingConv.participants, ...members, userId])];
    const unread = (existingConv.unreadCounts as Record<string, number>) ?? {};
    for (const pid of nextParticipants) {
      if (unread[pid] === undefined) unread[pid] = 0;
    }
    await prisma.conversation.update({
      where: { id: existingConv.id },
      data: {
        type: "channel",
        participants: nextParticipants,
        unreadCounts: unread,
        name: labels.channelName,
        description: labels.description
      }
    });
    existingConv.participants = nextParticipants;
    existingConv.type = "channel";
    existingConv.name = labels.channelName;
    existingConv.description = labels.description;

    const channelRow = await prisma.chatCommunityChannel.findFirst({ where: { projectId } });
    if (channelRow) {
      await prisma.chatCommunityChannel.update({
        where: { id: channelRow.id },
        data: {
          members: nextParticipants,
          name: labels.channelName,
          description: labels.description
        }
      });
    }

    const addedIds = nextParticipants.filter((id) => !prevParticipants.includes(id));
    await addConversationToInboxes(prisma, orgId, existingConv.id, addedIds.length ? addedIds : [userId]);

    const channel = await prisma.chatCommunityChannel.findFirst({ where: { projectId } });
    return {
      conversation: existingConv,
      channel,
      created: false,
      memberCount: nextParticipants.length,
      membersAdded: addedIds.length
    };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null }
  });
  if (!project) throw new Error("Project not found");

  const labels = resolveChannelLabels(project, input);
  const members = await collectProjectChannelMemberIds(prisma, project);
  if (!members.includes(userId)) members.push(userId);

  const unreadCounts: Record<string, number> = {};
  for (const pid of members) unreadCounts[pid] = 0;

  const adminIds = [
    userId,
    project.createdByUserId,
    project.assignedDeveloperId
  ].filter((id): id is string => Boolean(id));
  const admins = [...new Set(adminIds)];

  const systemIntro = labels.topics
    ? `Channel “${labels.channelName}” created for project ${project.name}. Topics: ${labels.topics}`
    : `Channel “${labels.channelName}” created for project ${project.name} — ${members.length} team member${members.length === 1 ? "" : "s"} added.`;

  const conversation = await prisma.conversation.create({
    data: {
      orgId,
      type: "channel",
      projectId: project.id,
      name: labels.channelName,
      description: labels.description,
      createdBy: userId,
      participants: members,
      admins,
      settings: {
        isPublic: false,
        allowInvites: false,
        readOnly: false,
        archived: false
      },
      unreadCounts,
      lastMessage: {
        id: "system-created",
        content: systemIntro,
        senderId: userId,
        timestamp: new Date().toISOString(),
        type: "system"
      }
    },
    include: { project: { select: { id: true, name: true, status: true, approvalStatus: true } } }
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: userId,
      content: systemIntro,
      type: "system",
      status: "delivered"
    }
  });

  const channel = await prisma.chatCommunityChannel.create({
    data: {
      orgId,
      projectId: project.id,
      conversationId: conversation.id,
      name: labels.channelName,
      description: labels.description,
      type: "projects",
      isPublic: false,
      members,
      moderators: admins
    }
  });

  await addConversationToInboxes(prisma, orgId, conversation.id, members);

  return { conversation, channel, created: true, memberCount: members.length, membersAdded: members.length };
}

export function formatProjectConversation(
  conv: {
    id: string;
    orgId: string;
    type: string;
    name: string | null;
    description: string | null;
    projectId: string | null;
    participants: string[];
    lastMessage: unknown;
    unreadCounts: unknown;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string; status: string; approvalStatus: string } | null;
  },
  userId: string
) {
  const unreadMap = conv.unreadCounts as Record<string, number> | null;
  const unreadCount = unreadMap?.[userId] ?? 0;
  const lm = conv.lastMessage as {
    id?: string;
    content?: string;
    senderId?: string;
    timestamp?: string;
    type?: string;
  } | null;

  const channelName = conv.name?.trim() || conv.project?.name || "Channel";
  const channelTopics = conv.description?.trim() || null;
  const lastMessage = lm?.content
    ? {
        id: lm.id ?? "last",
        content: lm.content,
        senderId: lm.senderId ?? userId,
        senderName: lm.senderId === userId ? "You" : "Member",
        timestamp:
          typeof lm.timestamp === "string" ? lm.timestamp : conv.updatedAt.toISOString(),
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

  return {
    id: conv.id,
    type: "channel" as const,
    name: channelName,
    description: channelTopics || "Channel",
    channelTopics: channelTopics || null,
    linkedProjectName: conv.project?.name ?? null,
    projectId: conv.projectId ?? conv.project?.id ?? null,
    projectStatus: conv.project?.status ?? null,
    projectApprovalStatus: conv.project?.approvalStatus ?? null,
    participants: conv.participants,
    participantCount: conv.participants.length,
    lastMessage,
    unreadCount,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString()
  };
}

/** Permanently remove a project-linked channel, its conversation, and messages. */
export async function deleteProjectChannel(
  prisma: PrismaClient,
  orgId: string,
  id: string
): Promise<{ conversationId: string; projectId: string | null }> {
  const conv = await prisma.conversation.findFirst({
    where: {
      orgId,
      type: { in: [...CHANNEL_CONVERSATION_TYPES] },
      OR: [{ id }, { projectId: id }]
    }
  });
  if (!conv) {
    throw new Error("Channel not found");
  }

  const conversationId = conv.id;
  const projectId = conv.projectId;

  await prisma.$transaction(async (tx) => {
    await tx.chatCommunityChannel.deleteMany({
      where: {
        orgId,
        OR: [
          { conversationId },
          ...(projectId ? [{ projectId }] : [])
        ]
      }
    });

    const messages = await tx.message.findMany({
      where: { conversationId },
      select: { id: true }
    });
    const messageIds = messages.map((m) => m.id);

    if (messageIds.length > 0) {
      await tx.messageUserFlag.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.messageHide.deleteMany({ where: { messageId: { in: messageIds } } });
    }

    await tx.chatNotification.deleteMany({ where: { conversationId } });
    await tx.message.deleteMany({ where: { conversationId } });

    const inboxes = await tx.inbox.findMany({
      where: { orgId, conversations: { has: conversationId } }
    });
    for (const inbox of inboxes) {
      await tx.inbox.update({
        where: { id: inbox.id },
        data: {
          conversations: inbox.conversations.filter((cid) => cid !== conversationId),
          lastActivity: new Date()
        }
      });
    }

    await tx.conversation.delete({ where: { id: conversationId } });
  });

  return { conversationId, projectId };
}
