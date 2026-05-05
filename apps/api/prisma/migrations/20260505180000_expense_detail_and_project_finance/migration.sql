-- Richer expense tracking (transport, tools, developer payments + acknowledgment)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "beneficiaryUserId" TEXT,
ADD COLUMN IF NOT EXISTS "expenseSubtype" TEXT,
ADD COLUMN IF NOT EXISTS "purposeCode" TEXT,
ADD COLUMN IF NOT EXISTS "purposeDetail" TEXT,
ADD COLUMN IF NOT EXISTS "toolOrServiceName" TEXT,
ADD COLUMN IF NOT EXISTS "subscriptionValidUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "developerAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "developerAcknowledgedById" TEXT;

CREATE INDEX IF NOT EXISTS "Expense_beneficiaryUserId_idx" ON "Expense"("beneficiaryUserId");
CREATE INDEX IF NOT EXISTS "Expense_orgId_category_idx" ON "Expense"("orgId", "category");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_developerAcknowledgedById_fkey" FOREIGN KEY ("developerAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
