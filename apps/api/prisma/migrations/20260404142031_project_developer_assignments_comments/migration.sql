-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "audience" TEXT DEFAULT 'all',
ADD COLUMN     "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ProjectDeveloperAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectDeveloperAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDeveloperAssignment_userId_status_idx" ON "ProjectDeveloperAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX "ProjectDeveloperAssignment_projectId_idx" ON "ProjectDeveloperAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDeveloperAssignment_projectId_userId_key" ON "ProjectDeveloperAssignment"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectDeveloperAssignment" ADD CONSTRAINT "ProjectDeveloperAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeveloperAssignment" ADD CONSTRAINT "ProjectDeveloperAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeveloperAssignment" ADD CONSTRAINT "ProjectDeveloperAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeveloperAssignment" ADD CONSTRAINT "ProjectDeveloperAssignment_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
