-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "financeProjectSeq" INTEGER,
ADD COLUMN     "financeRefYear" INTEGER,
ADD COLUMN     "nextInvoiceOrdinal" INTEGER NOT NULL DEFAULT 1;

-- Backfill: stable per-org project order by creation time; year from project createdAt.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "orgId" ORDER BY "createdAt" ASC, id ASC) AS rn,
    EXTRACT(YEAR FROM "createdAt")::integer AS y
  FROM "Project"
)
UPDATE "Project" AS p
SET
  "financeProjectSeq" = r.rn,
  "financeRefYear" = r.y
FROM ranked AS r
WHERE p.id = r.id;

-- Next invoice slot: one more than existing invoices per project (preserves CD-INV history).
UPDATE "Project" AS p
SET "nextInvoiceOrdinal" = COALESCE(inv.cnt, 0) + 1
FROM (
  SELECT "projectId", COUNT(*)::integer AS cnt
  FROM "Invoice"
  WHERE "projectId" IS NOT NULL
  GROUP BY "projectId"
) AS inv
WHERE inv."projectId" = p.id;
