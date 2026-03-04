-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'pending_approval',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "assignedDeveloperId" TEXT,
ADD COLUMN     "clientOrOwnerName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "price" DECIMAL(14,2),
ADD COLUMN     "projectDetails" TEXT,
ADD COLUMN     "timeline" JSONB,
ADD COLUMN     "type" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_assignedDeveloperId_fkey" FOREIGN KEY ("assignedDeveloperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
