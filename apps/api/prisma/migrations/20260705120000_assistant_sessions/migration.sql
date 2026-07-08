-- CreateTable
CREATE TABLE "AssistantSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assistantKind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "focus" TEXT,
    "message" TEXT NOT NULL,
    "transcript" TEXT,
    "reply" TEXT,
    "proposedActions" JSONB,
    "executedResults" JSONB,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantSession_orgId_createdAt_idx" ON "AssistantSession"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantSession_orgId_userId_createdAt_idx" ON "AssistantSession"("orgId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
