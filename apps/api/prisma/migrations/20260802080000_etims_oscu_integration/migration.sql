-- eTIMS OSCU: seller config, buyer PIN on clients, fiscal fields on invoices
CREATE TABLE IF NOT EXISTS "OrgEtimsConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tin" TEXT NOT NULL,
    "taxpayerName" TEXT,
    "bhfId" TEXT NOT NULL DEFAULT '00',
    "dvcSrlNo" TEXT NOT NULL,
    "cmcKey" TEXT,
    "sdcId" TEXT,
    "mrcNo" TEXT,
    "dvcId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSubmit" BOOLEAN NOT NULL DEFAULT true,
    "defaultTaxTyCd" TEXT NOT NULL DEFAULT 'B',
    "vatInclusive" BOOLEAN NOT NULL DEFAULT false,
    "lastInvcNo" INTEGER NOT NULL DEFAULT 0,
    "lastInitAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgEtimsConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgEtimsConfig_orgId_key" ON "OrgEtimsConfig"("orgId");

ALTER TABLE "OrgEtimsConfig" DROP CONSTRAINT IF EXISTS "OrgEtimsConfig_orgId_fkey";
ALTER TABLE "OrgEtimsConfig" ADD CONSTRAINT "OrgEtimsConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "kraPin" TEXT;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "buyerKraPin" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsStatus" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsInvcNo" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsSdcId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsMrcNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsRcptNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsInternalData" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsReceiptSign" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsQrCodeUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsResultCd" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsResultMsg" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "etimsRawResponse" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_orgId_etimsStatus_idx" ON "Invoice"("orgId", "etimsStatus");
