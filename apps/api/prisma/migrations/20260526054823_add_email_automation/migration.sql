-- AlterTable
ALTER TABLE "ProjectManagementMonth" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '(no subject)',
    "body" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftReply" TEXT,
    "revisionNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_draft',
    "senderType" TEXT NOT NULL DEFAULT 'external',
    "waMessageSid" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAutomationConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailThread_orgId_status_idx" ON "EmailThread"("orgId", "status");

-- CreateIndex
CREATE INDEX "EmailThread_orgId_receivedAt_idx" ON "EmailThread"("orgId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_orgId_uid_key" ON "EmailThread"("orgId", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAutomationConfig_orgId_key" ON "EmailAutomationConfig"("orgId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAutomationConfig" ADD CONSTRAINT "EmailAutomationConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DeveloperProgressReminderSent_orgId_userId_reminderKey_bucketKe" RENAME TO "DeveloperProgressReminderSent_orgId_userId_reminderKey_buck_key";
