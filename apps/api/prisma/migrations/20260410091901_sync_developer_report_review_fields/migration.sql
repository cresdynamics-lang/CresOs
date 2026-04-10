-- AlterTable
ALTER TABLE "DeveloperReport" ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateIndex
CREATE INDEX "DeveloperReport_orgId_reviewStatus_idx" ON "DeveloperReport"("orgId", "reviewStatus");

-- CreateIndex
CREATE INDEX "SalesReport_orgId_reviewStatus_idx" ON "SalesReport"("orgId", "reviewStatus");

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperReport" ADD CONSTRAINT "DeveloperReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
