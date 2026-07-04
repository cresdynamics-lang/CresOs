-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN "draftError" TEXT;
ALTER TABLE "EmailThread" ADD COLUMN "hasAttachments" BOOLEAN NOT NULL DEFAULT false;
