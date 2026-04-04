-- Backfill accepted assignments for legacy single assigned developer
INSERT INTO "ProjectDeveloperAssignment" ("id", "orgId", "projectId", "userId", "status", "createdAt")
SELECT gen_random_uuid()::text, "orgId", "id", "assignedDeveloperId", 'accepted', NOW()
FROM "Project"
WHERE "assignedDeveloperId" IS NOT NULL AND "deletedAt" IS NULL;
