-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "account" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "transactionCode" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "account" TEXT,
ADD COLUMN     "howToProceed" TEXT,
ADD COLUMN     "source" TEXT;
