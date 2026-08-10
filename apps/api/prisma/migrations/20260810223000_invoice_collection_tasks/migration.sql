-- Finance → sales invoice collection follow-ups
CREATE TABLE "InvoiceCollectionTask" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "escalatedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "reachedAt" TIMESTAMP(3),
    "clientNote" TEXT,
    "source" TEXT NOT NULL DEFAULT 'invoice_created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCollectionTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceCollectionNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceCollectionNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceCollectionTask_invoiceId_assignedToId_key" ON "InvoiceCollectionTask"("invoiceId", "assignedToId");
CREATE INDEX "InvoiceCollectionTask_orgId_assignedToId_status_idx" ON "InvoiceCollectionTask"("orgId", "assignedToId", "status");
CREATE INDEX "InvoiceCollectionTask_orgId_invoiceId_idx" ON "InvoiceCollectionTask"("orgId", "invoiceId");
CREATE INDEX "InvoiceCollectionTask_orgId_dueAt_status_idx" ON "InvoiceCollectionTask"("orgId", "dueAt", "status");
CREATE INDEX "InvoiceCollectionNote_taskId_createdAt_idx" ON "InvoiceCollectionNote"("taskId", "createdAt");
CREATE INDEX "InvoiceCollectionNote_orgId_authorId_idx" ON "InvoiceCollectionNote"("orgId", "authorId");

ALTER TABLE "InvoiceCollectionTask" ADD CONSTRAINT "InvoiceCollectionTask_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceCollectionTask" ADD CONSTRAINT "InvoiceCollectionTask_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceCollectionTask" ADD CONSTRAINT "InvoiceCollectionTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceCollectionTask" ADD CONSTRAINT "InvoiceCollectionTask_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceCollectionNote" ADD CONSTRAINT "InvoiceCollectionNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceCollectionNote" ADD CONSTRAINT "InvoiceCollectionNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "InvoiceCollectionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceCollectionNote" ADD CONSTRAINT "InvoiceCollectionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
