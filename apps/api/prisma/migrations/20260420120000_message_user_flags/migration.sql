-- CreateTable
CREATE TABLE "MessageUserFlag" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageUserFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageUserFlag_messageId_userId_key" ON "MessageUserFlag"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MessageUserFlag_userId_updatedAt_idx" ON "MessageUserFlag"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "MessageUserFlag_messageId_idx" ON "MessageUserFlag"("messageId");

-- AddForeignKey
ALTER TABLE "MessageUserFlag" ADD CONSTRAINT "MessageUserFlag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUserFlag" ADD CONSTRAINT "MessageUserFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

