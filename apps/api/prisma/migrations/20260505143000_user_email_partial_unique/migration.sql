-- Allow re-using email after soft-delete or full removal: uniqueness only for active rows.
DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_email_active_key" ON "User" ("email") WHERE "deletedAt" IS NULL;
