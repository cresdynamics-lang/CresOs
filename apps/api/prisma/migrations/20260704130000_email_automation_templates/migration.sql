-- AlterTable
ALTER TABLE "EmailAutomationConfig" ADD COLUMN IF NOT EXISTS "templates" JSONB;
