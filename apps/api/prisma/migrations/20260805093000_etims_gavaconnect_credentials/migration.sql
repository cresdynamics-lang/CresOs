-- GavaConnect OAuth fields for eTIMS OSCU gateway
ALTER TABLE "OrgEtimsConfig" ADD COLUMN IF NOT EXISTS "apigeeAppId" TEXT;
ALTER TABLE "OrgEtimsConfig" ADD COLUMN IF NOT EXISTS "consumerKey" TEXT;
ALTER TABLE "OrgEtimsConfig" ADD COLUMN IF NOT EXISTS "consumerSecret" TEXT;
