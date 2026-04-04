-- CreateTable
CREATE TABLE "DeveloperDailyDigestSent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperDailyDigestSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperDailyDigestSent_orgId_dateKey_idx" ON "DeveloperDailyDigestSent"("orgId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperDailyDigestSent_orgId_userId_dateKey_key" ON "DeveloperDailyDigestSent"("orgId", "userId", "dateKey");

-- AddForeignKey
ALTER TABLE "DeveloperDailyDigestSent" ADD CONSTRAINT "DeveloperDailyDigestSent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperDailyDigestSent" ADD CONSTRAINT "DeveloperDailyDigestSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
