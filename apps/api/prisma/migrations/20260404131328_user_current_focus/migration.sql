-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN     "originalScheduledAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'scheduled';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentFocusNote" TEXT,
ADD COLUMN     "currentFocusProjectId" TEXT,
ADD COLUMN     "currentFocusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "nextOfKin" JSONB,
ADD COLUMN     "phoneNumbers" TEXT[],
ADD COLUMN     "profilePicture" TEXT,
ADD COLUMN     "workEmails" TEXT[];

-- CreateTable
CREATE TABLE "ChatUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typingStatus" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{"notifications":true,"soundEnabled":true,"doNotDisturb":false}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "createdBy" TEXT NOT NULL,
    "participants" TEXT[],
    "admins" TEXT[],
    "settings" JSONB NOT NULL DEFAULT '{"isPublic":false,"allowInvites":false,"readOnly":false,"archived":false}',
    "lastMessage" JSONB,
    "unreadCounts" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "replyTo" TEXT,
    "reactions" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "readBy" JSONB NOT NULL DEFAULT '[]',
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversations" TEXT[],
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settings" JSONB NOT NULL DEFAULT '{"archiveRead":false,"hideOffline":false,"sortBy":"recent"}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "senderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatCommunityChannel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "members" TEXT[],
    "moderators" TEXT[],
    "settings" JSONB NOT NULL DEFAULT '{"allowFileSharing":true,"allowReactions":true,"messageRetention":90}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatCommunityChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParticipantConversations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatUser_userId_key" ON "ChatUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatUser_username_key" ON "ChatUser"("username");

-- CreateIndex
CREATE INDEX "ChatUser_orgId_userId_idx" ON "ChatUser"("orgId", "userId");

-- CreateIndex
CREATE INDEX "ChatUser_orgId_isOnline_idx" ON "ChatUser"("orgId", "isOnline");

-- CreateIndex
CREATE INDEX "Conversation_orgId_type_idx" ON "Conversation"("orgId", "type");

-- CreateIndex
CREATE INDEX "Conversation_orgId_updatedAt_idx" ON "Conversation"("orgId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Inbox_userId_key" ON "Inbox"("userId");

-- CreateIndex
CREATE INDEX "Inbox_orgId_userId_idx" ON "Inbox"("orgId", "userId");

-- CreateIndex
CREATE INDEX "ChatNotification_userId_read_idx" ON "ChatNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "ChatNotification_userId_createdAt_idx" ON "ChatNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatCommunityChannel_orgId_type_idx" ON "ChatCommunityChannel"("orgId", "type");

-- CreateIndex
CREATE INDEX "ChatCommunityChannel_orgId_isPublic_idx" ON "ChatCommunityChannel"("orgId", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipantConversations_AB_unique" ON "_ParticipantConversations"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipantConversations_B_index" ON "_ParticipantConversations"("B");

-- CreateIndex
CREATE INDEX "Lead_orgId_projectId_idx" ON "Lead"("orgId", "projectId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentFocusProjectId_fkey" FOREIGN KEY ("currentFocusProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUser" ADD CONSTRAINT "ChatUser_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUser" ADD CONSTRAINT "ChatUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inbox" ADD CONSTRAINT "Inbox_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inbox" ADD CONSTRAINT "Inbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inbox" ADD CONSTRAINT "Inbox_chatUserId_fkey" FOREIGN KEY ("userId") REFERENCES "ChatUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatNotification" ADD CONSTRAINT "ChatNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ChatUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatNotification" ADD CONSTRAINT "ChatNotification_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatNotification" ADD CONSTRAINT "ChatNotification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCommunityChannel" ADD CONSTRAINT "ChatCommunityChannel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantConversations" ADD CONSTRAINT "_ParticipantConversations_A_fkey" FOREIGN KEY ("A") REFERENCES "ChatUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantConversations" ADD CONSTRAINT "_ParticipantConversations_B_fkey" FOREIGN KEY ("B") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
