-- Per-user hide ("delete for me") and conversation-wide revoke ("delete for everyone")
ALTER TABLE "Message" ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE TABLE "MessageHide" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageHide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageHide_messageId_userId_key" ON "MessageHide"("messageId", "userId");
CREATE INDEX "MessageHide_userId_idx" ON "MessageHide"("userId");

ALTER TABLE "MessageHide" ADD CONSTRAINT "MessageHide_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageHide" ADD CONSTRAINT "MessageHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
