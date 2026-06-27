-- Developer report comments & questions (mirror sales report threads)
CREATE TABLE "DeveloperReportComment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperReportComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeveloperReportComment_reportId_idx" ON "DeveloperReportComment"("reportId");
CREATE INDEX "DeveloperReportComment_parentId_idx" ON "DeveloperReportComment"("parentId");

ALTER TABLE "DeveloperReportComment" ADD CONSTRAINT "DeveloperReportComment_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "DeveloperReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeveloperReportComment" ADD CONSTRAINT "DeveloperReportComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeveloperReportComment" ADD CONSTRAINT "DeveloperReportComment_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "DeveloperReportComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
