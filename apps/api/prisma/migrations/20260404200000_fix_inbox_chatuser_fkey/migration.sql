-- Inbox.userId must reference User.id only; drop invalid second FK to ChatUser.id.
ALTER TABLE "Inbox" DROP CONSTRAINT IF EXISTS "Inbox_chatUserId_fkey";
