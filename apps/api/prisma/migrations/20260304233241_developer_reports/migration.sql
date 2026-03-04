-- CreateTable
CREATE TABLE "DeveloperReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "whatWorked" TEXT,
    "blockers" TEXT,
    "needsAttention" TEXT,
    "implemented" TEXT,
    "pending" TEXT,
    "nextPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperReport_orgId_submittedById_idx" ON "DeveloperReport"("orgId", "submittedById");

-- CreateIndex
CREATE INDEX "DeveloperReport_orgId_reportDate_idx" ON "DeveloperReport"("orgId", "reportDate");

-- AddForeignKey
ALTER TABLE "DeveloperReport" ADD CONSTRAINT "DeveloperReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperReport" ADD CONSTRAINT "DeveloperReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
