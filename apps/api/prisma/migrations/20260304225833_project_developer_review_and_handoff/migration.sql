-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "developerReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProjectHandoffRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectHandoffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectHandoffRequest_projectId_idx" ON "ProjectHandoffRequest"("projectId");

-- CreateIndex
CREATE INDEX "ProjectHandoffRequest_toUserId_status_idx" ON "ProjectHandoffRequest"("toUserId", "status");

-- AddForeignKey
ALTER TABLE "ProjectHandoffRequest" ADD CONSTRAINT "ProjectHandoffRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectHandoffRequest" ADD CONSTRAINT "ProjectHandoffRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectHandoffRequest" ADD CONSTRAINT "ProjectHandoffRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectHandoffRequest" ADD CONSTRAINT "ProjectHandoffRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
