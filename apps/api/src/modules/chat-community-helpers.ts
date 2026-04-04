import type { PrismaClient } from "@prisma/client";

/** Primary label in UI: full name if set, otherwise login email. */
export function displayNameOrEmail(name: string | null | undefined, email: string): string {
  const n = name?.trim();
  if (n) return n;
  return email;
}

/** All active user IDs tied to an org (direct orgId and/or OrgMember). */
export async function getUserIdsInOrg(prisma: PrismaClient, orgId: string): Promise<string[]> {
  const [withOrgField, members] = await Promise.all([
    prisma.user.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true }
    }),
    prisma.orgMember.findMany({
      where: { orgId, deletedAt: null },
      select: { userId: true }
    })
  ]);
  const set = new Set<string>();
  for (const u of withOrgField) set.add(u.id);
  for (const m of members) set.add(m.userId);
  return [...set];
}

function emailLocalPart(email: string): string {
  const local = email.split("@")[0] ?? "user";
  return local.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40) || "user";
}

/** Stable unique username for ChatUser (global unique in schema). */
export async function uniqueChatUsername(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  email: string
): Promise<string> {
  const base = `${emailLocalPart(email)}_${userId.slice(0, 8)}`;
  let candidate = base;
  let n = 0;
  while (
    await prisma.chatUser.findFirst({
      where: { username: candidate, NOT: { userId } }
    })
  ) {
    n += 1;
    candidate = `${base}_${n}`;
  }
  return candidate;
}

export async function ensureChatUserAndInbox(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
  opts?: { displayName?: string; touchPresence?: boolean }
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      OR: [{ orgId }, { memberships: { some: { orgId, deletedAt: null } } }]
    },
    select: { id: true, email: true, name: true }
  });
  if (!user) return;

  const displayName =
    opts?.displayName?.trim() || displayNameOrEmail(user.name, user.email);
  const touchPresence = opts?.touchPresence === true;

  let chatUser = await prisma.chatUser.findUnique({ where: { userId } });
  if (!chatUser) {
    const username = await uniqueChatUsername(prisma, orgId, userId, user.email);
    chatUser = await prisma.chatUser.create({
      data: {
        userId,
        orgId,
        username,
        displayName,
        status: touchPresence ? "online" : "offline",
        isOnline: touchPresence,
        lastSeen: new Date()
      }
    });
  } else {
    const data: { displayName?: string; status?: string; isOnline?: boolean; lastSeen?: Date } = {
      displayName
    };
    if (touchPresence) {
      data.status = "online";
      data.isOnline = true;
      data.lastSeen = new Date();
    }
    await prisma.chatUser.update({
      where: { userId },
      data
    });
  }

  const inbox = await prisma.inbox.findUnique({ where: { userId } });
  if (!inbox) {
    await prisma.inbox.create({
      data: {
        userId,
        orgId,
        conversations: [],
        unreadCount: 0,
        lastActivity: new Date()
      }
    });
  }
}

export function mergeUnreadCounts(
  current: unknown,
  participants: string[],
  senderId: string
): Record<string, number> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, number>) }
      : {};
  for (const pid of participants) {
    if (pid === senderId) continue;
    base[pid] = (base[pid] ?? 0) + 1;
  }
  return base;
}

export async function createOrGetDirectConversation(
  prisma: PrismaClient,
  orgId: string,
  creatorId: string,
  participantId: string
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      orgId,
      type: "direct",
      AND: [{ participants: { has: creatorId } }, { participants: { has: participantId } }]
    }
  });
  if (existing) return existing;

  const unreadCounts: Record<string, number> = {
    [creatorId]: 0,
    [participantId]: 0
  };

  const conversation = await prisma.conversation.create({
    data: {
      orgId,
      type: "direct",
      createdBy: creatorId,
      participants: [creatorId, participantId],
      admins: [creatorId],
      settings: {
        isPublic: false,
        allowInvites: false,
        readOnly: false,
        archived: false
      },
      unreadCounts
    }
  });

  for (const uid of [creatorId, participantId]) {
    const inbox = await prisma.inbox.findUnique({ where: { userId: uid } });
    if (inbox && !inbox.conversations.includes(conversation.id)) {
      await prisma.inbox.update({
        where: { userId: uid },
        data: { conversations: { push: conversation.id }, lastActivity: new Date() }
      });
    }
  }

  return conversation;
}
