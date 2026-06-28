-- Project Management workspace
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "successCriteria" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectManagerUserId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "agileSprintNotes" TEXT;

ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerUserId_fkey"
  FOREIGN KEY ("projectManagerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PmDeveloperCheckIn" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "developerId" TEXT NOT NULL,
  "sentById" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "response" TEXT,
  "respondedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dayKey" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmDeveloperCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PmDeveloperCheckIn_projectId_developerId_dayKey_key"
  ON "PmDeveloperCheckIn"("projectId", "developerId", "dayKey");
CREATE INDEX IF NOT EXISTS "PmDeveloperCheckIn_orgId_projectId_idx" ON "PmDeveloperCheckIn"("orgId", "projectId");
CREATE INDEX IF NOT EXISTS "PmDeveloperCheckIn_developerId_status_idx" ON "PmDeveloperCheckIn"("developerId", "status");
CREATE INDEX IF NOT EXISTS "PmDeveloperCheckIn_dayKey_idx" ON "PmDeveloperCheckIn"("dayKey");

ALTER TABLE "PmDeveloperCheckIn" ADD CONSTRAINT "PmDeveloperCheckIn_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmDeveloperCheckIn" ADD CONSTRAINT "PmDeveloperCheckIn_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmDeveloperCheckIn" ADD CONSTRAINT "PmDeveloperCheckIn_developerId_fkey"
  FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmDeveloperCheckIn" ADD CONSTRAINT "PmDeveloperCheckIn_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
