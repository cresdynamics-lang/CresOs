-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderDayOfMonth" INTEGER;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "notes" TEXT;
