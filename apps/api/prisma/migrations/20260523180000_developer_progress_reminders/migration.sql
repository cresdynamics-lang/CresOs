-- Developer progress reminder snooze + send deduplication
CREATE TABLE IF NOT EXISTS "DeveloperReminderSnooze" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "snoozeUntil" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperReminderSnooze_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperReminderSnooze_orgId_userId_reminderKey_key"
    ON "DeveloperReminderSnooze"("orgId", "userId", "reminderKey");

CREATE INDEX IF NOT EXISTS "DeveloperReminderSnooze_orgId_userId_snoozeUntil_idx"
    ON "DeveloperReminderSnooze"("orgId", "userId", "snoozeUntil");

CREATE TABLE IF NOT EXISTS "DeveloperProgressReminderSent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperProgressReminderSent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperProgressReminderSent_orgId_userId_reminderKey_bucketKey_key"
    ON "DeveloperProgressReminderSent"("orgId", "userId", "reminderKey", "bucketKey");

CREATE INDEX IF NOT EXISTS "DeveloperProgressReminderSent_orgId_userId_idx"
    ON "DeveloperProgressReminderSent"("orgId", "userId");

DO $$ BEGIN
  ALTER TABLE "DeveloperReminderSnooze" ADD CONSTRAINT "DeveloperReminderSnooze_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeveloperReminderSnooze" ADD CONSTRAINT "DeveloperReminderSnooze_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeveloperProgressReminderSent" ADD CONSTRAINT "DeveloperProgressReminderSent_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeveloperProgressReminderSent" ADD CONSTRAINT "DeveloperProgressReminderSent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
