import type { PrismaClient } from "@prisma/client";
import {
  createOrGetDirectConversation,
  ensureChatUserAndInbox,
  mergeUnreadCounts
} from "../modules/chat-community-helpers";
import {
  formatAnswersAsResponse,
  formatCheckInDisplayText,
  type CheckInQuestion,
  type RoleCheckInPayload,
  type SenderRole
} from "./role-project-checkin";

export type PostedCheckInMessage = {
  messageId: string;
  conversationId: string;
};

const ROLE_LABEL: Record<SenderRole, string> = {
  project_manager: "Project Manager",
  director_admin: "Director"
};

/** Community-facing body for a structured check-in (DM from PM/Director). */
export function formatCheckInCommunityContent(
  projectName: string,
  senderRole: SenderRole,
  payload: RoleCheckInPayload
): string {
  const role = ROLE_LABEL[senderRole];
  const body = formatCheckInDisplayText(payload.intro, payload.questions);
  return `📋 ${role} check-in · ${projectName}\n\n${body}`;
}

export function formatCheckInReplyCommunityContent(
  projectName: string,
  questions: CheckInQuestion[],
  answers: Record<string, string>
): string {
  const formatted = formatAnswersAsResponse(questions, answers);
  return `✅ Check-in reply · ${projectName}\n\n${formatted}`;
}

export async function postCheckInToCommunity(
  prisma: PrismaClient,
  input: {
    orgId: string;
    senderId: string;
    developerId: string;
    projectId: string;
    projectName: string;
    checkInId: string;
    senderRole: SenderRole;
    payload: RoleCheckInPayload;
  }
): Promise<PostedCheckInMessage> {
  const { orgId, senderId, developerId, projectId, projectName, checkInId, senderRole, payload } =
    input;

  await ensureChatUserAndInbox(prisma, senderId, orgId, { touchPresence: true });
  await ensureChatUserAndInbox(prisma, developerId, orgId, { touchPresence: false });

  const conversation = await createOrGetDirectConversation(prisma, orgId, senderId, developerId);
  const content = formatCheckInCommunityContent(projectName, senderRole, payload);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      content,
      type: "text",
      metadata: {
        roleCheckIn: true,
        pmCheckIn: true,
        senderRole,
        senderLabel: ROLE_LABEL[senderRole],
        projectId,
        projectName,
        checkInId,
        requiresResponse: true,
        intro: payload.intro,
        questions: payload.questions
      }
    }
  });

  const unreadCounts = mergeUnreadCounts(
    conversation.unreadCounts,
    conversation.participants,
    senderId
  );

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      participants: [...new Set([...conversation.participants, senderId, developerId])],
      lastMessage: {
        id: message.id,
        content: content.slice(0, 240),
        senderId,
        timestamp: message.createdAt.toISOString(),
        type: "text"
      },
      updatedAt: new Date(),
      unreadCounts
    }
  });

  return { messageId: message.id, conversationId: conversation.id };
}

export async function postCheckInReplyToCommunity(
  prisma: PrismaClient,
  input: {
    orgId: string;
    developerId: string;
    checkInMessageId: string | null | undefined;
    projectName: string;
    checkInId: string;
    questions: CheckInQuestion[];
    answers: Record<string, string>;
  }
): Promise<string | null> {
  const { developerId, checkInMessageId, projectName, checkInId, questions, answers } = input;
  if (!checkInMessageId) return null;

  const parent = await prisma.message.findFirst({
    where: { id: checkInMessageId },
    select: {
      id: true,
      conversationId: true,
      metadata: true,
      conversation: { select: { participants: true, unreadCounts: true } }
    }
  });
  if (!parent?.conversation) return null;

  const content = formatCheckInReplyCommunityContent(projectName, questions, answers);

  const reply = await prisma.message.create({
    data: {
      conversationId: parent.conversationId,
      senderId: developerId,
      content,
      type: "text",
      replyTo: parent.id,
      metadata: {
        checkInReply: true,
        checkInId,
        projectName
      }
    }
  });

  const conv = parent.conversation;
  const unreadCounts = mergeUnreadCounts(conv.unreadCounts, conv.participants, developerId);

  const parentMeta =
    parent.metadata && typeof parent.metadata === "object" && !Array.isArray(parent.metadata)
      ? (parent.metadata as Record<string, unknown>)
      : {};

  await prisma.message.update({
    where: { id: parent.id },
    data: {
      metadata: {
        ...parentMeta,
        requiresResponse: false,
        answeredAt: new Date().toISOString()
      }
    }
  });

  await prisma.conversation.update({
    where: { id: parent.conversationId },
    data: {
      lastMessage: {
        id: reply.id,
        content: content.slice(0, 240),
        senderId: developerId,
        timestamp: reply.createdAt.toISOString(),
        type: "text"
      },
      updatedAt: new Date(),
      unreadCounts
    }
  });

  return reply.id;
}

/** Attach conversationId from linked community message. */
export async function enrichCheckInsWithConversationIds<
  T extends { messageId?: string | null }
>(prisma: PrismaClient, rows: T[]): Promise<(T & { conversationId: string | null })[]> {
  const ids = rows.map((r) => r.messageId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return rows.map((r) => ({ ...r, conversationId: null }));

  const messages = await prisma.message.findMany({
    where: { id: { in: ids } },
    select: { id: true, conversationId: true }
  });
  const map = Object.fromEntries(messages.map((m) => [m.id, m.conversationId]));

  return rows.map((r) => ({
    ...r,
    conversationId: r.messageId ? (map[r.messageId] ?? null) : null
  }));
}
