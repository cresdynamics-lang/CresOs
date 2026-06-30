-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "userId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_orgId_sourceType_sourceId_key" ON "KnowledgeChunk"("orgId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_orgId_projectId_occurredAt_idx" ON "KnowledgeChunk"("orgId", "projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_orgId_kind_occurredAt_idx" ON "KnowledgeChunk"("orgId", "kind", "occurredAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_orgId_actorId_occurredAt_idx" ON "KnowledgeChunk"("orgId", "actorId", "occurredAt");

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
