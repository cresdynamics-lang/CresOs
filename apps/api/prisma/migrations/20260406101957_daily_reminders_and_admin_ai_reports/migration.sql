-- CreateTable
CREATE TABLE "DailyReminderSent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAiReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReminderSent_orgId_dateKey_idx" ON "DailyReminderSent"("orgId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReminderSent_orgId_userId_dateKey_kind_key" ON "DailyReminderSent"("orgId", "userId", "dateKey", "kind");

-- CreateIndex
CREATE INDEX "AdminAiReport_orgId_dateKey_idx" ON "AdminAiReport"("orgId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAiReport_orgId_dateKey_key" ON "AdminAiReport"("orgId", "dateKey");

-- AddForeignKey
ALTER TABLE "DailyReminderSent" ADD CONSTRAINT "DailyReminderSent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReminderSent" ADD CONSTRAINT "DailyReminderSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAiReport" ADD CONSTRAINT "AdminAiReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
