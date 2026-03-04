-- Replace ops role with developer: update existing Role rows
UPDATE "Role" SET key = 'developer', name = 'Developer' WHERE key = 'ops';
