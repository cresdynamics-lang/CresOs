-- CreateTable
CREATE TABLE "ProjectPlanningNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "source" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorUserId" TEXT,
    "rawText" TEXT NOT NULL,
    "aiSummary" TEXT,
    "roleBriefs" JSONB,
    "planJson" JSONB,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPlanningNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPlanningNote_orgId_projectId_idx" ON "ProjectPlanningNote"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectPlanningNote_projectId_createdAt_idx" ON "ProjectPlanningNote"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectPlanningNote" ADD CONSTRAINT "ProjectPlanningNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlanningNote" ADD CONSTRAINT "ProjectPlanningNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlanningNote" ADD CONSTRAINT "ProjectPlanningNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
