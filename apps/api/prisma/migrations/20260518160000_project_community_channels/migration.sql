-- Project-linked community channels (one channel per project)
ALTER TABLE "Conversation" ADD COLUMN "projectId" TEXT;

ALTER TABLE "ChatCommunityChannel" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ChatCommunityChannel" ADD COLUMN "conversationId" TEXT;

CREATE UNIQUE INDEX "Conversation_projectId_key" ON "Conversation"("projectId");
CREATE UNIQUE INDEX "ChatCommunityChannel_projectId_key" ON "ChatCommunityChannel"("projectId");
CREATE UNIQUE INDEX "ChatCommunityChannel_conversationId_key" ON "ChatCommunityChannel"("conversationId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatCommunityChannel" ADD CONSTRAINT "ChatCommunityChannel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatCommunityChannel" ADD CONSTRAINT "ChatCommunityChannel_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
