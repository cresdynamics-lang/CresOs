-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN     "reminderMinutesBefore" INTEGER,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
