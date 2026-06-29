-- Structured role-based project check-ins (PM vs Director), separate daily sends per role
ALTER TABLE "PmDeveloperCheckIn" ADD COLUMN IF NOT EXISTS "senderRole" TEXT NOT NULL DEFAULT 'project_manager';
ALTER TABLE "PmDeveloperCheckIn" ADD COLUMN IF NOT EXISTS "questionsJson" JSONB;
ALTER TABLE "PmDeveloperCheckIn" ADD COLUMN IF NOT EXISTS "answersJson" JSONB;

DROP INDEX IF EXISTS "PmDeveloperCheckIn_projectId_developerId_dayKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PmDeveloperCheckIn_projectId_developerId_dayKey_senderRole_key"
  ON "PmDeveloperCheckIn"("projectId", "developerId", "dayKey", "senderRole");
