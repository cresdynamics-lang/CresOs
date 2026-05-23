-- Director team assignment + capability flags + director reports to admin
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reportsToDirectorId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "capabilityFlags" JSONB;

CREATE INDEX IF NOT EXISTS "User_reportsToDirectorId_idx" ON "User"("reportsToDirectorId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_reportsToDirectorId_fkey"
    FOREIGN KEY ("reportsToDirectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DirectorReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DirectorReport_orgId_submittedById_status_idx" ON "DirectorReport"("orgId", "submittedById", "status");
CREATE INDEX IF NOT EXISTS "DirectorReport_orgId_reviewStatus_idx" ON "DirectorReport"("orgId", "reviewStatus");

DO $$ BEGIN
  ALTER TABLE "DirectorReport" ADD CONSTRAINT "DirectorReport_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DirectorReport" ADD CONSTRAINT "DirectorReport_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DirectorReport" ADD CONSTRAINT "DirectorReport_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
