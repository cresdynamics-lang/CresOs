-- Management billing: director-controlled enrollment, per-month paid tracking, finance invoicing.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "managementActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "managementStartedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "managementProgressPercent" INTEGER;

CREATE TABLE IF NOT EXISTS "ProjectManagementMonth" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "markedByUserId" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectManagementMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectManagementMonth_projectId_year_month_key" ON "ProjectManagementMonth"("projectId", "year", "month");
CREATE INDEX IF NOT EXISTS "ProjectManagementMonth_orgId_idx" ON "ProjectManagementMonth"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectManagementMonth_projectId_idx" ON "ProjectManagementMonth"("projectId");

ALTER TABLE "ProjectManagementMonth" ADD CONSTRAINT "ProjectManagementMonth_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectManagementMonth" ADD CONSTRAINT "ProjectManagementMonth_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectManagementMonth" ADD CONSTRAINT "ProjectManagementMonth_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectManagementMonth" ADD CONSTRAINT "ProjectManagementMonth_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
